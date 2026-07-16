import { supabase } from './supabase';

export async function updateAuctionStatus(auctionId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('update_auction_status', { p_auction_id: auctionId, p_status: status });
  if (error) throw error;
}

export async function startAuctionLot(auctionId: string, auctionPlayerId: string): Promise<void> {
  const { error } = await supabase.rpc('start_auction_lot', { p_auction_id: auctionId, p_auction_player_id: auctionPlayerId });
  if (error) throw error;
}

// The atomic core lives entirely server-side (place_bid RPC) — this is
// just the client call. Never trust a client-computed "is this a valid
// bid" check for anything beyond UI hinting; the RPC re-validates
// everything (current-lot check, expiry, self-outbid, floor, price cap)
// against live state under a row lock.
export async function placeBid(auctionPlayerId: string, teamId: string, amount: number): Promise<void> {
  const { error } = await supabase.rpc('place_bid', { p_auction_player_id: auctionPlayerId, p_team_id: teamId, p_amount: amount });
  if (error) throw error;
}

// Safely callable by any club member — idempotent, checks its own timing.
// The client opportunistically calls this the instant its local countdown
// hits zero (near-instant resolution when someone's watching); the
// pg_cron sweep is purely the backstop for an unwatched lot.
export async function resolveLot(auctionPlayerId: string, force = false): Promise<void> {
  const { error } = await supabase.rpc('resolve_lot', { p_auction_player_id: auctionPlayerId, p_force: force });
  if (error) throw error;
}

export async function relistAuctionPlayer(auctionPlayerId: string): Promise<void> {
  const { error } = await supabase.rpc('relist_auction_player', { p_auction_player_id: auctionPlayerId });
  if (error) throw error;
}

// Mirrors place_bid's server-side cap formula exactly, for live display
// only ("Your max bid right now: ₹X") — the RPC is what actually enforces
// it, this is never trusted as validation.
export function computeMaxBid(purseRemaining: number, minRosterSize: number, wonCount: number, minCategoryPrice: number): number {
  const remainingSlots = Math.max(minRosterSize - wonCount, 1);
  return purseRemaining - (remainingSlots - 1) * minCategoryPrice;
}

export interface AuctionBidRow {
  id: string;
  auction_player_id: string;
  team_id: string;
  amount: number;
  created_at: string;
}

export async function fetchRecentBids(auctionPlayerId: string, limit = 10): Promise<AuctionBidRow[]> {
  const { data, error } = await supabase
    .from('auction_bids')
    .select('*')
    .eq('auction_player_id', auctionPlayerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AuctionBidRow[];
}

// Live updates for the current lot (bid amount/team, countdown) and for
// which player is currently on the block — via Supabase's postgres_changes
// Realtime subscriptions, not polling. Unlike Mystery Partner's reveal
// pacing, a competitive live auction genuinely needs low-latency updates:
// polling every few seconds would create real, unfair timing gaps between
// owners. This is the one place in the app where Realtime is the right
// tool, not a default.
export function subscribeToAuction(auctionId: string, onChange: () => void) {
  const channel = supabase
    .channel(`auction:${auctionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_players', filter: `auction_id=eq.${auctionId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
