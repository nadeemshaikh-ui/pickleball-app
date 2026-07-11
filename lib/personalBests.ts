import { supabase } from './supabase';

export interface PersonalBests {
  biggestMargin: number | null;
  biggestMarginOwnScore: number | null;
  biggestMarginOppScore: number | null;
  biggestMarginOpponents: string | null;
  longestStreak: number;
}

export interface StreakBest {
  name: string;
  longestWinStreak: number;
  longestLossStreak: number;
}

export async function fetchClubStreakBests(clubId: string): Promise<Map<string, StreakBest>> {
  const { data, error } = await supabase.rpc('club_streak_bests', { target_club_id: clubId });
  if (error) throw error;
  const map = new Map<string, StreakBest>();
  for (const row of data ?? []) {
    map.set(row.name, { name: row.name, longestWinStreak: row.longest_win_streak, longestLossStreak: row.longest_loss_streak });
  }
  return map;
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
