import { supabase } from './supabase';
import type { ScrambleRound, Squads } from './shuffle';

export type Format = 'scramble' | 'squad_rivalry';

export interface SessionRow {
  id: string;
  created_at: string;
  format: Format;
  players: string[];
  squads: Squads | null;
  round_count: number;
  status: 'setup' | 'in_progress' | 'completed';
  court_labels: [string, string];
  round_duration_minutes: number | null;
}

export interface RoundRow {
  id: string;
  session_id: string;
  round_number: number;
  court: 1 | 2;
  team_a: [string, string];
  team_b: [string, string];
  sitting_out: string[];
  score_a: number | null;
  score_b: number | null;
}

function randomSessionId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function createSession(
  players: string[],
  format: Format,
  roundCount: number,
  squads: Squads | null,
  courtLabels: [string, string],
  roundDurationMinutes: number | null
): Promise<string> {
  const id = randomSessionId();
  const { error } = await supabase.from('sessions').insert({
    id,
    format,
    players,
    squads,
    round_count: roundCount,
    court_labels: courtLabels,
    round_duration_minutes: roundDurationMinutes,
    status: 'in_progress',
  });
  if (error) throw error;
  return id;
}

export async function insertRounds(sessionId: string, rounds: ScrambleRound[]): Promise<void> {
  const rows = rounds.flatMap(r => [
    {
      session_id: sessionId,
      round_number: r.roundNumber,
      court: 1,
      team_a: r.court1.teamA,
      team_b: r.court1.teamB,
      sitting_out: r.sittingOut,
      score_a: null,
      score_b: null,
    },
    {
      session_id: sessionId,
      round_number: r.roundNumber,
      court: 2,
      team_a: r.court2.teamA,
      team_b: r.court2.teamB,
      sitting_out: r.sittingOut,
      score_a: null,
      score_b: null,
    },
  ]);
  const { error } = await supabase.from('rounds').insert(rows);
  if (error) throw error;
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

  const { error: sessionError } = await supabase
    .from('sessions')
    .update({ players: newPlayers, squads: newSquads })
    .eq('id', sessionId);
  if (sessionError) throw sessionError;

  const rounds = await getRounds(sessionId);
  for (const round of rounds) {
    const touchesRound =
      round.team_a.includes(oldName) || round.team_b.includes(oldName) || round.sitting_out.includes(oldName);
    if (!touchesRound) continue;

    const team_a = round.team_a.map(p => (p === oldName ? newName : p)) as [string, string];
    const team_b = round.team_b.map(p => (p === oldName ? newName : p)) as [string, string];
    const sitting_out = round.sitting_out.map(p => (p === oldName ? newName : p));

    const { error: roundError } = await supabase
      .from('rounds')
      .update({ team_a, team_b, sitting_out })
      .eq('id', round.id);
    if (roundError) throw roundError;
  }
}
