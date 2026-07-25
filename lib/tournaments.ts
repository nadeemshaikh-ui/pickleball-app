import { supabase } from './supabase';

export interface TournamentRow {
  id: string;
  club_id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  share_token: string;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  registration_open: boolean;
  self_score_enabled: boolean;
  slot_count: number | null;
}

function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function fetchTournaments(clubId: string): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TournamentRow[];
}

export async function fetchTournament(tournamentId: string): Promise<TournamentRow> {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
  if (error) throw error;
  return data as TournamentRow;
}

export async function createTournament(clubId: string, name: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ club_id: clubId, name, share_token: generateShareToken(), created_by: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// Gated on SCORED matches, not on whether a stage exists at all — status
// can't be the gate (nothing in this codebase ever sets status to
// 'active', so every working tournament stays 'draft' forever, scored
// results and all). The old rule blocked on stage-count alone, which
// meant a tournament with a freshly generated but entirely UNSCORED stage
// (e.g. an abandoned test, or one you decided to redo) could never be
// deleted through the app — the exact "stuck in draft with no way to
// clear it" complaint. An unscored fixture list isn't real match data;
// once even one match has a result, it is, and deletion is refused.
export async function deleteTournament(tournamentId: string): Promise<void> {
  const { data: stages, error: stagesError } = await supabase.from('tournament_stages').select('id').eq('tournament_id', tournamentId);
  if (stagesError) throw stagesError;
  const stageIds = (stages ?? []).map(s => s.id);

  if (stageIds.length > 0) {
    const { count, error: countError } = await supabase
      .from('tournament_matches')
      .select('id', { count: 'exact', head: true })
      .in('stage_id', stageIds)
      .eq('status', 'completed');
    if (countError) throw countError;
    if (count && count > 0) {
      throw new Error('This tournament already has scored matches — deleting it would destroy real results. Not allowed.');
    }
    // tournament_matches -> tournament_teams isn't a cascading FK, so an
    // unscored-but-generated stage's matches must be cleared explicitly
    // before the tournaments row delete cascades stages/teams/registrations.
    const { error: matchesError } = await supabase.from('tournament_matches').delete().in('stage_id', stageIds);
    if (matchesError) throw matchesError;
  }

  const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);
  if (error) throw error;
}

export async function completeTournament(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', tournamentId);
  if (error) throw error;
}

export function watchUrlFor(shareToken: string): string {
  return `/watch/${shareToken}`;
}
