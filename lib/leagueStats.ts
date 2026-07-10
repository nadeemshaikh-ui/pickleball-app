import { supabase } from './supabase';
import { wilsonLowerBound } from './wilsonScore';

export const MIN_GAMES_FOR_RANKING = 10;
export const MIN_GAMES_FOR_DUO_RANKING = 5;

export { wilsonLowerBound };

export interface RankedPlayer {
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  wilsonScore: number;
  provisional: boolean; // true if below MIN_GAMES_FOR_RANKING — shown but not eligible for Top-N/POTM
}

function rankPlayers(rows: { name: string; games_played: number; wins: number; losses: number }[]): RankedPlayer[] {
  return rows
    .map(r => ({
      name: r.name,
      gamesPlayed: r.games_played,
      wins: r.wins,
      losses: r.losses,
      winPct: r.games_played > 0 ? r.wins / r.games_played : 0,
      wilsonScore: wilsonLowerBound(r.wins, r.games_played),
      provisional: r.games_played < MIN_GAMES_FOR_RANKING,
    }))
    .sort((a, b) => {
      // Provisional players sort after ranked ones regardless of score.
      if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
      if (b.wilsonScore !== a.wilsonScore) return b.wilsonScore - a.wilsonScore;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.gamesPlayed - a.gamesPlayed;
    });
}

export interface LifetimePlayerStats extends RankedPlayer {
  pointsFor: number;
  pointsAgainst: number;
  lastPlayedAt: string;
}

export async function fetchLifetimeLeaderboard(): Promise<LifetimePlayerStats[]> {
  const { data, error } = await supabase.from('league_player_stats_mv').select('*');
  if (error) throw error;
  const ranked = rankPlayers(data);
  const byName = new Map(data.map(r => [r.name, r]));
  return ranked.map(r => ({
    ...r,
    pointsFor: byName.get(r.name)!.points_for,
    pointsAgainst: byName.get(r.name)!.points_against,
    lastPlayedAt: byName.get(r.name)!.last_played_at,
  }));
}

export async function fetchPlayerOfTheMonth(): Promise<RankedPlayer | null> {
  const { data, error } = await supabase.from('league_player_month_stats_mv').select('*');
  if (error) throw error;
  const ranked = rankPlayers(data);
  const eligible = ranked.find(p => !p.provisional);
  return eligible ?? null;
}

export async function fetchPlayerOfTheMonthBoard(): Promise<RankedPlayer[]> {
  const { data, error } = await supabase.from('league_player_month_stats_mv').select('*');
  if (error) throw error;
  return rankPlayers(data);
}

export interface RankedDuo {
  players: [string, string];
  gamesPlayed: number;
  wins: number;
  winPct: number;
  provisional: boolean;
}

export async function fetchBestDuos(): Promise<RankedDuo[]> {
  const { data, error } = await supabase.from('league_duo_stats_mv').select('*');
  if (error) throw error;
  return data
    .map(r => ({
      players: [r.p1, r.p2] as [string, string],
      gamesPlayed: r.games_played,
      wins: r.wins,
      winPct: r.games_played > 0 ? r.wins / r.games_played : 0,
      provisional: r.games_played < MIN_GAMES_FOR_DUO_RANKING,
    }))
    .sort((a, b) => {
      if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.gamesPlayed - a.gamesPlayed;
    });
}

export interface MvpStats {
  name: string;
  mvpCount: number;
}

export async function fetchMvpCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('league_mvp_stats_mv').select('*');
  if (error) throw error;
  return new Map(data.map((r: { name: string; mvp_count: number }) => [r.name, r.mvp_count]));
}

// Admin-only — enforced again at the DB level by refresh_league_stats()
// itself (raises if the caller isn't in admins), this is just so the UI
// can surface the real error message instead of a generic RPC failure.
export async function refreshLeagueStats(): Promise<void> {
  const { error } = await supabase.rpc('refresh_league_stats');
  if (error) throw error;
}
