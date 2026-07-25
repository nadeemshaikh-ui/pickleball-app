import { supabase } from './supabase';
import type { ScrambleRound } from './shuffle';
import type { SquadSet } from './squads';
import type { StageConfig, RapidFireConfig } from './teamChampionship';
import type { MatchScoringRule } from './matchScoring';

export type Format = 'scramble' | 'squad_rivalry' | 'court_blocks' | 'fixed_partners' | 'king_of_court' | 'team_championship';

const MAX_SQUAD_LOGO_BYTES = 5 * 1024 * 1024;

// Same pattern as lib/clubs.ts' uploadClubLogo — reuses the group-logos
// bucket (already public-read) rather than a dedicated squad-logos bucket,
// since squad branding is ephemeral (one session's Gold/Black identity,
// not a persistent club asset) and doesn't warrant its own bucket.
export async function uploadSquadLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Squad logo must be an image file.');
  if (file.size > MAX_SQUAD_LOGO_BYTES) throw new Error('Squad logo must be under 5MB.');
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : 'png';
  const path = `squad-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('group-logos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('group-logos').getPublicUrl(path);
  return data.publicUrl;
}

export interface SessionRow {
  id: string;
  // Exactly one of club_id/circle_id is non-null at the DB level (XOR
  // check), but kept typed as plain `string` here deliberately: every
  // existing club page queries sessions via .eq('club_id', clubId), so a
  // circle session can never be returned to club-only code paths — widening
  // this to `string | null` ripples into 40+ files that read session.club_id
  // assuming it's always present (confirmed via tsc — out of scope for this
  // pass). circle_id is the new, accurately-nullable field; circle-aware
  // code should branch on circle_id being non-null rather than trusting
  // club_id's type here.
  club_id: string;
  circle_id: string | null;
  created_at: string;
  format: Format;
  players: string[];
  // Late Arrivals plan — subset of `players` not available for tonight's
  // schedule at setup time. `players` stays the full roster on purpose
  // (roster history, dues, and every existing query that reads it are
  // unaffected); this is the only new column the plan needs. Use
  // activePlayers() below rather than inlining the subtraction.
  absent_players: string[];
  squads: SquadSet | null;
  round_count: number;
  status: 'setup' | 'in_progress' | 'completed' | 'voided';
  court_labels: string[];
  round_duration_minutes: number | null;
  rounds_per_block: number | null;
  group_name: string | null;
  logo_url_1: string | null;
  logo_url_2: string | null;
  start_time: string | null;
  event_date: string | null;
  court_cost: number | null;
  ball_cost: number;
  is_ladder: boolean;
  king_of_court_fixed_pairs: boolean | null;
  venue: string | null;
  storylines: string[] | null;
  booker_upi_vpa: string | null;
  stage_config: StageConfig[] | null;
  rapid_fire_config: RapidFireConfig | null;
  match_scoring_rule: MatchScoringRule | null;
  // Null/empty = any signed-in club member with session access can log a
  // score (today's behavior). Non-empty = only these players (by name) plus
  // club admins may log scores for this session.
  designated_scorers: string[] | null;
}

export interface RoundRow {
  id: string;
  session_id: string;
  round_number: number;
  court: number;
  team_a: [string, string];
  team_b: [string, string];
  sitting_out: string[];
  score_a: number | null;
  score_b: number | null;
}

function randomSessionId(): string {
  return Math.random().toString(36).slice(2, 8);
}

// players minus absent_players — the roster that's actually available
// right now. Always compute it through this helper rather than inlining
// the subtraction elsewhere.
export function activePlayers(session: Pick<SessionRow, 'players' | 'absent_players'>): string[] {
  const absentSet = new Set(session.absent_players);
  return session.players.filter(p => !absentSet.has(p));
}

// Mid-session tick present/absent. Blocks a tick that would leave fewer
// than 4 active players rather than writing a session into an unplayable
// state — same floor generateScrambleSchedule enforces at generation time.
export async function setAbsentPlayers(
  sessionId: string,
  players: string[],
  absentPlayers: string[],
  squads?: SquadSet
): Promise<void> {
  const activeCount = players.filter(p => !absentPlayers.includes(p)).length;
  if (activeCount < 4) {
    throw new Error('At least 4 players must be active — this change would leave fewer.');
  }
  const update: { absent_players: string[]; squads?: SquadSet } = { absent_players: absentPlayers };
  if (squads) update.squads = squads;
  const { error } = await supabase.from('sessions').update(update).eq('id', sessionId);
  if (error) throw error;
}

export interface CreateSessionOptions {
  // Optional so a circle session can omit it — pass exactly one of
  // clubId/circleId, never both, matching the DB's XOR check constraint.
  clubId?: string;
  players: string[];
  absentPlayers: string[];
  format: Format;
  roundCount: number;
  squads: SquadSet | null;
  courtLabels: string[];
  roundDurationMinutes: number | null;
  roundsPerBlock: number | null;
  groupName: string | null;
  logoUrl1: string | null;
  logoUrl2: string | null;
  startTime: string | null;
  eventDate: string | null;
  courtCost: number | null;
  ballCost: number;
  isLadder: boolean;
  kingOfCourtFixedPairs: boolean | null;
  venue: string | null;
  storylines: string[];
  bookerUpiVpa: string | null;
  // Team Championship only — optional so every other format's existing
  // createSession call sites need no changes. Both null means "not a
  // Team Championship session," matching how roundsPerBlock etc. already
  // null out for formats that don't use them.
  stageConfig?: StageConfig[] | null;
  rapidFireConfig?: RapidFireConfig | null;
  matchScoringRule?: MatchScoringRule | null;
  // A circle session in this MVP has no players/dues/branding/stats parity
  // with club sessions — see 20260723000000_circles_schema.sql's scope
  // note. circleId is mutually exclusive with clubId at the DB level (XOR
  // check); this type doesn't enforce that, callers must pass exactly one.
  circleId?: string | null;
}

export async function createSession(options: CreateSessionOptions): Promise<string> {
  if (!options.circleId && !options.clubId) throw new Error('createSession requires either clubId or circleId.');
  const id = randomSessionId();
  const { error } = await supabase.from('sessions').insert({
    id,
    club_id: options.circleId ? null : options.clubId,
    circle_id: options.circleId ?? null,
    format: options.format,
    players: options.players,
    absent_players: options.absentPlayers,
    squads: options.squads,
    round_count: options.roundCount,
    court_labels: options.courtLabels,
    round_duration_minutes: options.roundDurationMinutes,
    rounds_per_block: options.roundsPerBlock,
    group_name: options.groupName,
    logo_url_1: options.logoUrl1,
    logo_url_2: options.logoUrl2,
    start_time: options.startTime,
    event_date: options.eventDate,
    court_cost: options.courtCost,
    ball_cost: options.ballCost,
    is_ladder: options.isLadder,
    king_of_court_fixed_pairs: options.kingOfCourtFixedPairs,
    venue: options.venue,
    storylines: options.storylines,
    booker_upi_vpa: options.bookerUpiVpa,
    stage_config: options.stageConfig ?? null,
    rapid_fire_config: options.rapidFireConfig ?? null,
    match_scoring_rule: options.matchScoringRule ?? null,
    status: 'in_progress',
  });
  if (error) throw error;
  return id;
}

export async function insertRounds(sessionId: string, rounds: ScrambleRound[]): Promise<void> {
  const rows = rounds.flatMap(r =>
    r.courts.map((court, i) => ({
      session_id: sessionId,
      round_number: r.roundNumber,
      court: i + 1,
      team_a: court.teamA,
      team_b: court.teamB,
      sitting_out: r.sittingOutPerCourt[i],
      score_a: null,
      score_b: null,
    }))
  );
  const { error } = await supabase.from('rounds').insert(rows);
  if (error) throw error;
}

// Late-arrivals plan, Item 5 (time awareness) — a host running long or
// short can nudge the round count without touching anything else. Both
// operations only ever act on the LAST round: they never touch a round
// that's already on court or already played, matching the "played rounds
// are immutable" principle the wider plan uses for regeneration.
export async function removeLastRound(sessionId: string): Promise<void> {
  const rounds = await getRounds(sessionId);
  if (rounds.length === 0) throw new Error('No rounds to remove.');
  const maxRoundNumber = Math.max(...rounds.map(r => r.round_number));
  const lastRoundRows = rounds.filter(r => r.round_number === maxRoundNumber);
  if (lastRoundRows.some(r => r.score_a !== null || r.score_b !== null)) {
    throw new Error("That round has already been played — it can't be removed.");
  }
  // Re-assert the unscored guard as part of the delete itself, not just the
  // read above — someone can save a score for this exact round between
  // that read and this call (round order isn't enforced elsewhere), and
  // without this the delete would otherwise destroy a score that was just
  // entered.
  const { data: deletedRows, error: deleteError } = await supabase
    .from('rounds')
    .delete()
    .eq('session_id', sessionId)
    .eq('round_number', maxRoundNumber)
    .is('score_a', null)
    .is('score_b', null)
    .select('id');
  if (deleteError) throw deleteError;
  if (!deletedRows || deletedRows.length !== lastRoundRows.length) {
    throw new Error("That round was just played — it can't be removed.");
  }
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ round_count: maxRoundNumber - 1 })
    .eq('id', sessionId);
  if (updateError) throw updateError;
}

// Repeats the last round's exact court/team pairings as a new round —
// deliberately not a fresh fair-pairing generation (that's Item 3's job,
// which needs the derived ledger this doesn't have access to). This is a
// same-night time cushion, not a rebalance: matches the plan's "the app's
// only job is to do the arithmetic honestly," not a decision-maker.
export async function addRoundRepeatingLast(sessionId: string): Promise<void> {
  const rounds = await getRounds(sessionId);
  if (rounds.length === 0) throw new Error('No rounds yet to repeat.');
  const maxRoundNumber = Math.max(...rounds.map(r => r.round_number));
  const lastRoundRows = rounds.filter(r => r.round_number === maxRoundNumber);
  const newRoundNumber = maxRoundNumber + 1;
  const { error: insertError } = await supabase.from('rounds').insert(
    lastRoundRows.map(r => ({
      session_id: sessionId,
      round_number: newRoundNumber,
      court: r.court,
      team_a: r.team_a,
      team_b: r.team_b,
      sitting_out: r.sitting_out,
      score_a: null,
      score_b: null,
    }))
  );
  if (insertError) throw insertError;
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ round_count: newRoundNumber })
    .eq('id', sessionId);
  if (updateError) throw updateError;
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadPlayerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Photo must be an image file.');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('Photo must be under 5MB.');
  }
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : 'png';
  const path = `${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('player-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('player-photos').getPublicUrl(path);
  return data.publicUrl;
}

// Most recently created session, for "Repeat Last Session" on Setup — the
// roster, format, courts, costs, and ladder flag transfer over, but locked
// partners and skill-balanced toggle don't (never persisted, they're
// per-generation shuffle inputs, not part of the session row).
export async function getMostRecentSession(clubId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SessionRow | null;
}

// "Start a Team Championship" always jumped straight to a blank setup
// wizard with zero awareness of an already-started tournament — real
// tournament feedback: every time an organizer backed out and re-entered,
// they silently abandoned their in-progress session and had to redo
// everything from scratch. This finds the most recent NOT-completed/voided
// Team Championship session for the club, so the setup page can offer
// "Resume" instead of blindly starting over.
export async function findInProgressTeamChampionshipSession(clubId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('club_id', clubId)
    .eq('format', 'team_championship')
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SessionRow | null;
}

export async function listSessions(clubId: string, limit = 30): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as SessionRow[];
}

export async function listTeamChampionshipHistory(clubId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('club_id', clubId)
    .eq('format', 'team_championship')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as SessionRow[];
}

export async function getSession(sessionId: string): Promise<SessionRow> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if (error) throw error;
  return data as SessionRow;
}

export async function getRounds(sessionId: string): Promise<RoundRow[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true })
    .order('court', { ascending: true });
  if (error) throw error;
  return data as RoundRow[];
}

export async function updateRoundScore(
  roundId: string,
  scoreA: number,
  scoreB: number
): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ score_a: scoreA, score_b: scoreB })
    .eq('id', roundId);
  if (error) throw error;
}

// The deliberate unlock action for a scored Team Championship round (see
// pairings/page.tsx's isScored lock) - explicit and separate from
// updateRoundTeams/updateRoundCourt's own score-nulling side effect, so a
// captain has to consciously choose to clear a result before they can even
// reach the now-enabled pairing/court/order controls, rather than a
// pairing edit silently wiping a score as a side effect.
export async function clearRoundScore(roundId: string): Promise<void> {
  const { error } = await supabase.from('rounds').update({ score_a: null, score_b: null }).eq('id', roundId);
  if (error) throw error;
}

// Team Championship's manual pairing editor — every other format only ever
// changes a round's score (players are locked in at generation time), so
// this is new: lets a captain override which players are on a round's
// teams after auto-generation. Resets score to null since a re-paired
// round hasn't been played under its new pairing yet.
export async function updateRoundTeams(roundId: string, teamA: [string, string], teamB: [string, string]): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ team_a: teamA, team_b: teamB, score_a: null, score_b: null })
    .eq('id', roundId);
  if (error) throw error;
}

// Team Championship only, so far — every other format's court assignment
// comes from its scheduling algorithm and isn't meant to be hand-edited.
// Doesn't touch round_number: this changes WHICH COURT a round is played
// on, not when. Resets scores like updateRoundTeams does, for the same
// reason — a captain reassigning a court after a match started/scored
// should re-confirm the result, not silently keep a stale score attached
// to a different court.
export async function updateRoundCourt(roundId: string, court: number): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ court, score_a: null, score_b: null })
    .eq('id', roundId);
  if (error) throw error;
}

// Team Championship only — lets a captain resequence which round number a
// pairing is slotted into (the "order" pairs are submitted/played in), not
// just who's in it or which court. Swaps round_number with whatever round
export async function markSessionCompleted(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
  if (error) throw error;
}

// Pass an empty array to go back to "anyone with session access can score."
// Admin-only at the DB level (RLS alone doesn't gate this column — the
// general "sessions club member access" policy lets any member write any
// session field — so this goes through an admin-checked RPC instead of a
// direct .update()).
export async function updateDesignatedScorers(sessionId: string, names: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_designated_scorers', { p_session_id: sessionId, p_names: names });
  if (error) throw error;
}

// Rounds cascade-delete with the session (supabase/schema.sql:13 — `on
// delete cascade`), so this only needs to remove the sessions row.
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

// Fixes a typo'd player name everywhere it appears: the session roster,
// squads (if Squad Rivalry), and every round's teams/sit-outs. Scores are
// untouched since they're keyed by round id, not by name.
//
// Fires all writes concurrently rather than one-by-one — this shrinks the
// partial-failure window a lot (a mid-loop network blip used to leave some
// rounds renamed and some not). It's still not a real DB transaction: if one
// of many concurrent writes fails, the others may have already committed.
// True atomicity would need a Postgres RPC function, which is more
// infrastructure than this size of app calls for.
export async function renamePlayerEverywhere(
  sessionId: string,
  oldName: string,
  newName: string
): Promise<void> {
  if (oldName === newName) return;

  const session = await getSession(sessionId);
  const newPlayers = session.players.map(p => (p === oldName ? newName : p));
  const newSquads = session.squads
    ? session.squads.map(squad => ({ ...squad, players: squad.players.map(p => (p === oldName ? newName : p)) }))
    : null;

  const rounds = await getRounds(sessionId);
  const roundUpdates = rounds
    .filter(
      round =>
        round.team_a.includes(oldName) || round.team_b.includes(oldName) || round.sitting_out.includes(oldName)
    )
    .map(round => {
      const team_a = round.team_a.map(p => (p === oldName ? newName : p)) as [string, string];
      const team_b = round.team_b.map(p => (p === oldName ? newName : p)) as [string, string];
      const sitting_out = round.sitting_out.map(p => (p === oldName ? newName : p));
      return supabase.from('rounds').update({ team_a, team_b, sitting_out }).eq('id', round.id);
    });

  // Execute session player list update + round updates atomically
  const { error: rpcError } = await supabase.rpc('rename_player_everywhere', {
    p_club_id: session.club_id,
    p_old_name: oldName,
    p_new_name: newName
  });

  if (rpcError) {
    // Fallback gracefully if RPC is not deployed in local dev environment
    const results = await Promise.all([
      supabase.from('sessions').update({ players: newPlayers, squads: newSquads }).eq('id', sessionId),
      ...roundUpdates,
    ]);
    const failed = results.find(r => r.error);
    if (failed?.error) throw failed.error;
  }
}
