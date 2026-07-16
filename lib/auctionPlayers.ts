import { supabase } from './supabase';
import { flightForRating } from './flights';
import type { AuctionCategoryRow } from './auctionCategories';

// Public pool-browsing shape — deliberately excludes whatsapp_number/
// instagram_handle. Reads from the auction_players_public view, which has
// its own RLS-equivalent column exclusion (see the schema migration);
// contact info is only ever fetched via fetchAuctionPlayerContact, gated to
// club admins and the player themselves.
export interface AuctionPlayerPublicRow {
  id: string;
  auction_id: string;
  club_id: string;
  player_name: string;
  category_id: string;
  status: 'pooled' | 'sold' | 'unsold';
  sold_price: number | null;
  winning_team_id: string | null;
  created_at: string;
  current_bid_amount: number | null;
  current_bid_team_id: string | null;
  lot_closes_at: string | null;
}

export interface AuctionPlayerContact {
  whatsappNumber: string | null;
  instagramHandle: string | null;
}

export async function fetchAuctionPlayersPublic(auctionId: string): Promise<AuctionPlayerPublicRow[]> {
  const { data, error } = await supabase
    .from('auction_players_public')
    .select('*')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as AuctionPlayerPublicRow[];
}

// Only returns a row for players the caller is allowed to see contact info
// for (club admin, or the player themselves) — auction_player_contacts' own
// restrictive RLS enforces this (auction_players itself is broadly
// readable by every club member so Realtime works, but contact info lives
// in this separate table specifically so it stays gated). A non-admin,
// non-self caller simply gets `null` back, not an error, since the row is
// invisible to them rather than access-denied.
export async function fetchAuctionPlayerContact(auctionId: string, playerName: string): Promise<AuctionPlayerContact | null> {
  const { data: playerRow, error: playerError } = await supabase
    .from('auction_players_public')
    .select('id')
    .eq('auction_id', auctionId)
    .eq('player_name', playerName)
    .maybeSingle();
  if (playerError) throw playerError;
  if (!playerRow) return null;

  const { data, error } = await supabase
    .from('auction_player_contacts')
    .select('whatsapp_number, instagram_handle')
    .eq('auction_player_id', playerRow.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { whatsappNumber: data.whatsapp_number, instagramHandle: data.instagram_handle };
}

// Suggests a default category by matching the player's Flight (elo-derived)
// to a category of the same name — organizer can still override in the UI.
// Falls back to null (no preselection) if the auction's categories were
// renamed/customized away from the Bronze/Silver/Gold/Platinum defaults.
export function suggestCategoryForRating(elo: number, categories: AuctionCategoryRow[]): string | null {
  const flight = flightForRating(elo);
  return categories.find(c => c.name === flight)?.id ?? null;
}

export interface AddAuctionPlayerInput {
  auctionId: string;
  playerName: string;
  playerUserId: string | null;
  categoryId: string;
  whatsappNumber?: string | null;
  instagramHandle?: string | null;
}

export async function addAuctionPlayer(input: AddAuctionPlayerInput): Promise<void> {
  const { error } = await supabase.rpc('create_auction_player', {
    p_auction_id: input.auctionId,
    p_player_name: input.playerName,
    p_player_user_id: input.playerUserId,
    p_category_id: input.categoryId,
    p_whatsapp_number: input.whatsappNumber ?? null,
    p_instagram_handle: input.instagramHandle ?? null,
  });
  if (error) throw error;
}

export async function updateAuctionPlayerCategory(auctionPlayerId: string, categoryId: string): Promise<void> {
  const { error } = await supabase.from('auction_players').update({ category_id: categoryId }).eq('id', auctionPlayerId);
  if (error) throw error;
}

export async function removeAuctionPlayer(auctionPlayerId: string): Promise<void> {
  const { error } = await supabase.from('auction_players').delete().eq('id', auctionPlayerId);
  if (error) throw error;
}
