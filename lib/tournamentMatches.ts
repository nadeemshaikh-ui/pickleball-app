import { supabase } from './supabase';

export interface TournamentMatchRow {
  id: string;
  stage_id: string;
  club_id: string;
  round_label: string | null;
  group_label: string | null;
  match_order: number;
  bracket_round: number | null;
  bracket_slot: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_next_match_id: string | null;
  winner_next_slot: 'a' | 'b' | null;
  loser_next_match_id: string | null;
  loser_next_slot: 'a' | 'b' | null;
  is_bye: boolean;
  scheduled_at: string | null;
  score_a: number | null;
  score_b: number | null;
  status: 'scheduled' | 'in_progress' | 'completed';
  created_at: string;
}

export async function fetchStageMatches(stageId: string): Promise<TournamentMatchRow[]> {
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('stage_id', stageId)
    .order('match_order', { ascending: true });
  if (error) throw error;
  return data as TournamentMatchRow[];
}

// Atomic: writes the score AND advances the winner (and loser, for Page
// Playoff's 2nd-chance bracket) into whatever match(es) this one feeds, all
// inside one Postgres function — mirrors the enroll_in_ladder/reset_ladder
// rationale (client-side read-then-write here caused a real race-condition
// bug in the ladder trigger before; same risk shape applies to bracket
// advancement).
export async function recordTournamentMatchScore(matchId: string, scoreA: number, scoreB: number): Promise<void> {
  const { error } = await supabase.rpc('record_tournament_match_score', {
    p_match_id: matchId,
    p_score_a: scoreA,
    p_score_b: scoreB,
  });
  if (error) throw error;
}
