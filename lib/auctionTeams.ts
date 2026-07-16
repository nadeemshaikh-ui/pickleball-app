import { supabase } from './supabase';

export interface AuctionTeamRow {
  id: string;
  auction_id: string;
  club_id: string;
  name: string;
  logo_url: string | null;
  owner_user_id: string | null;
  purse_remaining: number;
  created_at: string;
}

const MAX_TEAM_LOGO_BYTES = 5 * 1024 * 1024;

// Reuses the group-logos bucket, same pattern as uploadSquadLogo (lib/db.ts)
// and uploadTournamentTeamLogo (lib/tournamentTeams.ts) — already
// public-read, no dedicated bucket needed for a third kind of team logo.
export async function uploadAuctionTeamLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Team logo must be an image file.');
  if (file.size > MAX_TEAM_LOGO_BYTES) throw new Error('Team logo must be under 5MB.');
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : 'png';
  const path = `auction-team-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('group-logos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('group-logos').getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchAuctionTeams(auctionId: string): Promise<AuctionTeamRow[]> {
  const { data, error } = await supabase.from('auction_teams').select('*').eq('auction_id', auctionId).order('created_at', { ascending: true });
  if (error) throw error;
  return data as AuctionTeamRow[];
}

// Goes through create_auction_team RPC — derives club_id and purse_remaining
// (from the auction's own purse_amount) server-side, same cross-tenant-trust
// fix already applied to the tournament engine's team creation.
export async function createAuctionTeam(auctionId: string, name: string, logoUrl: string | null, ownerUserId: string | null): Promise<void> {
  const { error } = await supabase.rpc('create_auction_team', {
    p_auction_id: auctionId,
    p_name: name,
    p_logo_url: logoUrl,
    p_owner_user_id: ownerUserId,
  });
  if (error) throw error;
}

export async function updateAuctionTeamLogo(teamId: string, logoUrl: string): Promise<void> {
  const { error } = await supabase.from('auction_teams').update({ logo_url: logoUrl }).eq('id', teamId);
  if (error) throw error;
}
