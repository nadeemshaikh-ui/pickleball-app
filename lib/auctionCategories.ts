import { supabase } from './supabase';

export interface AuctionCategoryRow {
  id: string;
  auction_id: string;
  club_id: string;
  name: string;
  base_price: number;
  sort_order: number;
}

export async function fetchAuctionCategories(auctionId: string): Promise<AuctionCategoryRow[]> {
  const { data, error } = await supabase.from('auction_categories').select('*').eq('auction_id', auctionId).order('sort_order', { ascending: true });
  if (error) throw error;
  return data as AuctionCategoryRow[];
}

export async function addAuctionCategory(auctionId: string, name: string, basePrice: number, sortOrder: number): Promise<void> {
  const { error } = await supabase.rpc('create_auction_category', {
    p_auction_id: auctionId,
    p_name: name,
    p_base_price: basePrice,
    p_sort_order: sortOrder,
  });
  if (error) throw error;
}

export async function updateAuctionCategoryPrice(categoryId: string, basePrice: number): Promise<void> {
  const { error } = await supabase.from('auction_categories').update({ base_price: basePrice }).eq('id', categoryId);
  if (error) throw error;
}

export async function deleteAuctionCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from('auction_categories').delete().eq('id', categoryId);
  if (error) throw error;
}
