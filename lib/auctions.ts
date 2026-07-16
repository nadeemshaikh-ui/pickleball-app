import { supabase } from './supabase';

export interface AuctionRow {
  id: string;
  club_id: string;
  name: string;
  status: 'draft' | 'registration_open' | 'registration_closed' | 'active' | 'completed';
  purse_amount: number;
  min_roster_size: number;
  created_by: string;
  created_at: string;
}

const DEFAULT_PURSE_AMOUNT = 1_00_00_000; // ₹1Cr per team, organizer-editable via updateAuction
const DEFAULT_MIN_ROSTER_SIZE = 5;

// Default categories seeded on every new auction, mirroring the existing
// Flight system (Bronze/Silver/Gold/Platinum) so there's zero setup work for
// a baseline auction — organizer can rename/re-price/add/remove afterward.
export const DEFAULT_CATEGORY_BASE_PRICES: { name: string; basePrice: number }[] = [
  { name: 'Bronze', basePrice: 1_00_000 },
  { name: 'Silver', basePrice: 2_00_000 },
  { name: 'Gold', basePrice: 5_00_000 },
  { name: 'Platinum', basePrice: 10_00_000 },
];

export async function fetchAuctions(clubId: string): Promise<AuctionRow[]> {
  const { data, error } = await supabase.from('auctions').select('*').eq('club_id', clubId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as AuctionRow[];
}

export async function fetchAuction(auctionId: string): Promise<AuctionRow> {
  const { data, error } = await supabase.from('auctions').select('*').eq('id', auctionId).single();
  if (error) throw error;
  return data as AuctionRow;
}

// Creates the auction (via RPC — club_id derivation isn't needed here since
// there's no parent to spoof, but the RPC still owns the is_club_admin
// check and auth.uid()-derived created_by, matching the create_tournament_*
// pattern) then seeds the 4 default categories.
export async function createAuction(
  clubId: string,
  name: string,
  purseAmount: number = DEFAULT_PURSE_AMOUNT,
  minRosterSize: number = DEFAULT_MIN_ROSTER_SIZE
): Promise<string> {
  const { data: auctionId, error } = await supabase.rpc('create_auction', {
    p_club_id: clubId,
    p_name: name,
    p_purse_amount: purseAmount,
    p_min_roster_size: minRosterSize,
  });
  if (error) throw error;

  for (let i = 0; i < DEFAULT_CATEGORY_BASE_PRICES.length; i++) {
    const { error: catError } = await supabase.rpc('create_auction_category', {
      p_auction_id: auctionId,
      p_name: DEFAULT_CATEGORY_BASE_PRICES[i].name,
      p_base_price: DEFAULT_CATEGORY_BASE_PRICES[i].basePrice,
      p_sort_order: i,
    });
    if (catError) throw catError;
  }

  return auctionId as string;
}
