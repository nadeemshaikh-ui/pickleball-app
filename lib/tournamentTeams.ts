import { supabase } from './supabase';

export interface TournamentTeamRow {
  id: string;
  tournament_id: string;
  club_id: string;
  name: string;
  player_names: [string, string];
  logo_url: string | null;
  seed: number | null;
  created_at: string;
}

const MAX_TEAM_LOGO_BYTES = 5 * 1024 * 1024;

// Reuses the group-logos bucket, same as uploadSquadLogo in lib/db.ts —
// already public-read, no need for a dedicated tournament-team bucket.
export async function uploadTournamentTeamLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Team logo must be an image file.');
  if (file.size > MAX_TEAM_LOGO_BYTES) throw new Error('Team logo must be under 5MB.');
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : 'png';
  const path = `tournament-team-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('group-logos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('group-logos').getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchTournamentTeams(tournamentId: string): Promise<TournamentTeamRow[]> {
  const { data, error } = await supabase
    .from('tournament_teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('seed', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as TournamentTeamRow[];
}

export interface CreateTournamentTeamInput {
  tournamentId: string;
  name: string;
  playerNames: [string, string];
  logoUrl?: string | null;
  seed?: number | null;
}

// Goes through the create_tournament_team RPC rather than a direct insert —
// the RPC derives club_id from tournamentId server-side, so a caller can
// never tag a team with a club_id that doesn't match its tournament's real
// owner (see the fix_cross_tenant_club_id_trust migration).
export async function createTournamentTeam(input: CreateTournamentTeamInput): Promise<void> {
  const { error } = await supabase.rpc('create_tournament_team', {
    p_tournament_id: input.tournamentId,
    p_name: input.name,
    p_player_names: input.playerNames,
    p_logo_url: input.logoUrl ?? null,
    p_seed: input.seed ?? null,
  });
  if (error) throw error;
}

export async function updateTournamentTeamSeed(teamId: string, seed: number | null): Promise<void> {
  const { error } = await supabase.from('tournament_teams').update({ seed }).eq('id', teamId);
  if (error) throw error;
}

export async function deleteTournamentTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('tournament_teams').delete().eq('id', teamId);
  if (error) throw error;
}

// Seed order for stage generation: explicit `seed` ascending, ties/nulls
// falling back to signup order (created_at) — matches fetchTournamentTeams'
// own ordering, so "first stage's input order" is always just this list.
export function orderedTeamIds(teams: TournamentTeamRow[]): string[] {
  return teams.map(t => t.id);
}
