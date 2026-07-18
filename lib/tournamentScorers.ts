import { supabase } from './supabase';

export interface CourtScorerCodeRow {
  id: string;
  tournament_id: string;
  club_id: string;
  court_label: string;
  code: string;
  created_by: string;
  created_at: string;
}

// Admin-only at the DB level (RLS + a raise inside the function itself).
// Re-creating a code for a court that already has one rotates it (old code
// stops working) rather than erroring — matches how a lost/leaked code
// should be handled: generate a fresh one, don't require deleting first.
export async function createCourtScorerCode(tournamentId: string, courtLabel: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_court_scorer_code', { p_tournament_id: tournamentId, p_court_label: courtLabel });
  if (error) throw error;
  return data as string;
}

export async function fetchCourtScorerCodes(tournamentId: string): Promise<CourtScorerCodeRow[]> {
  const { data, error } = await supabase
    .from('tournament_court_scorer_codes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('court_label', { ascending: true });
  if (error) throw error;
  return data as CourtScorerCodeRow[];
}

// Anon-reachable — a scorer holding a valid per-court code needs no account
// and no club membership. Authorization is the code match inside the RPC,
// not is_club_member; court scoping degrades gracefully until match rows
// actually carry a court_label (see Batch C, the court scheduling engine).
export async function recordScoreWithCode(matchId: string, scoreA: number, scoreB: number, courtLabel: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('record_tournament_match_score_with_code', {
    p_match_id: matchId,
    p_score_a: scoreA,
    p_score_b: scoreB,
    p_court_label: courtLabel,
    p_code: code,
  });
  if (error) throw error;
}
