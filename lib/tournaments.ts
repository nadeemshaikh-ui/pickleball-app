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

// Zero-stages-only by design, checked here rather than trusting `status`
// alone — nothing in this codebase ever sets status to 'active', so every
// working tournament stays 'draft' for its entire life including after
// real stages/matches/results exist. Gating on status='draft' alone would
// let real generated data get silently deleted. A tournament with just a
// name and maybe some teams (no stages yet) is safe to remove outright.
export async function deleteTournament(tournamentId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('tournament_stages')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);
  if (countError) throw countError;
  if (count && count > 0) {
    throw new Error('This tournament already has stages generated — deleting it would destroy real match data. Not allowed.');
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
