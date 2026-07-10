import { supabase } from './supabase';

export interface PersonalBests {
  biggestMargin: number | null;
  biggestMarginOwnScore: number | null;
  biggestMarginOppScore: number | null;
  biggestMarginOpponents: string | null;
  longestStreak: number;
}

export async function fetchPersonalBests(clubId: string, name: string): Promise<PersonalBests> {
  const { data, error } = await supabase.rpc('player_personal_bests', { target_club_id: clubId, target_name: name });
  if (error) throw error;
  const row = data?.[0];
  return {
    biggestMargin: row?.biggest_margin ?? null,
    biggestMarginOwnScore: row?.biggest_margin_own_score ?? null,
    biggestMarginOppScore: row?.biggest_margin_opp_score ?? null,
    biggestMarginOpponents: row?.biggest_margin_opponents ?? null,
    longestStreak: row?.longest_streak ?? 0,
  };
}
