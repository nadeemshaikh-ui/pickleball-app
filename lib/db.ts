import { supabase } from './supabase';
import type { ScrambleRound, Squads } from './shuffle';

export type Format = 'scramble' | 'squad_rivalry' | 'court_blocks' | 'fixed_partners' | 'king_of_court';

export interface SessionRow {
  id: string;
  club_id: string;
  created_at: string;
  format: Format;
  players: string[];
  squads: Squads | null;
  round_count: number;
  status: 'setup' | 'in_progress' | 'completed' | 'voided';
  court_labels: string[];
  round_duration_minutes: number | null;
  rounds_per_block: number | null;
  group_name: string | null;
  logo_url_1: string | null;
  logo_url_2: string | null;
  start_time: string | null;
  court_cost: number | null;
  ball_cost: number;
  is_ladder: boolean;
  king_of_court_fixed_pairs: boolean | null;
  venue: string | null;
  squad_gold_label: string | null;
  squad_black_label: string | null;
  storylines: string[] | null;
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

export interface CreateSessionOptions {
  clubId: string;
  players: string[];
  format: Format;
  roundCount: number;
  squads: Squads | null;
  courtLabels: string[];
  roundDurationMinutes: number | null;
  roundsPerBlock: number | null;
  groupName: string | null;
  logoUrl1: string | null;
  logoUrl2: string | null;
  startTime: string | null;
  courtCost: number | null;
  ballCost: number;
  isLadder: boolean;
  kingOfCourtFixedPairs: boolean | null;
  venue: string | null;
  squadGoldLabel: string | null;
  squadBlackLabel: string | null;
  storylines: string[];
}

export async function createSession(options: CreateSessionOptions): Promise<string> {
  const id = randomSessionId();
  const { error } = await supabase.from('sessions').insert({
    id,
    club_id: options.clubId,
    format: options.format,
    players: options.players,
    squads: options.squads,
    round_count: options.roundCount,
    court_labels: options.courtLabels,
    round_duration_minutes: options.roundDurationMinutes,
    rounds_per_block: options.roundsPerBlock,
    group_name: options.groupName,
    logo_url_1: options.logoUrl1,
    logo_url_2: options.logoUrl2,
    start_time: options.startTime,
    court_cost: options.courtCost,
    ball_cost: options.ballCost,
    is_ladder: options.isLadder,
    king_of_court_fixed_pairs: options.kingOfCourtFixedPairs,
    venue: options.venue,
    squad_gold_label: options.squadGoldLabel,
    squad_black_label: options.squadBlackLabel,
    storylines: options.storylines,
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

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadGroupLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Logo must be an image file.');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('Logo must be under 5MB.');
  }
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : 'png';
  const path = `${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('group-logos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('group-logos').getPublicUrl(path);
  return data.publicUrl;
}

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

export async function markSessionCompleted(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
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
    ? {
        gold: session.squads.gold.map(p => (p === oldName ? newName : p)),
        black: session.squads.black.map(p => (p === oldName ? newName : p)),
      }
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

  const results = await Promise.all([
    supabase.from('sessions').update({ players: newPlayers, squads: newSquads }).eq('id', sessionId),
    ...roundUpdates,
  ]);
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}
