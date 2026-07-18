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
