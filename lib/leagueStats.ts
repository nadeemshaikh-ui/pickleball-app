import { supabase } from './supabase';
import { wilsonLowerBound } from './wilsonScore';
import { recordBadgeHolderChange } from './badgeHolders';

export const MIN_GAMES_FOR_RANKING = 10;
export const MIN_GAMES_FOR_DUO_RANKING = 5;
export const MIN_GAMES_FOR_RIVALRY = 5;

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

// Note: the `league_*` views (no `_mv` suffix) are thin club-scoped wrappers
// over the underlying `league_*_mv` materialized views — matviews can't
// carry RLS in Postgres, so the raw `_mv` tables are locked down and these
// views are what the client actually queries. Membership alone isn't
// enough to scope to the *current* club for a multi-club user, so every
// query here still needs an explicit `.eq('club_id', clubId)`.

export async function fetchLifetimeLeaderboard(clubId: string): Promise<LifetimePlayerStats[]> {
  const { data, error } = await supabase.from('league_player_stats').select('*').eq('club_id', clubId);
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

export async function fetchPlayerOfTheMonth(clubId: string): Promise<RankedPlayer | null> {
  const { data, error } = await supabase.from('league_player_month_stats').select('*').eq('club_id', clubId);
  if (error) throw error;
  const ranked = rankPlayers(data);
  const eligible = ranked.find(p => !p.provisional);
  return eligible ?? null;
}

export async function fetchPlayerOfTheMonthBoard(clubId: string): Promise<RankedPlayer[]> {
  const { data, error } = await supabase.from('league_player_month_stats').select('*').eq('club_id', clubId);
  if (error) throw error;
  return rankPlayers(data);
}

export async function fetchYearlyLeaderboard(clubId: string): Promise<RankedPlayer[]> {
  const { data, error } = await supabase.from('league_player_year_stats').select('*').eq('club_id', clubId);
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

export async function fetchBestDuos(clubId: string): Promise<RankedDuo[]> {
  const { data, error } = await supabase.from('league_duo_stats').select('*').eq('club_id', clubId);
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

export async function fetchMvpCounts(clubId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('league_mvp_stats').select('*').eq('club_id', clubId);
  if (error) throw error;
  return new Map(data.map((r: { name: string; mvp_count: number }) => [r.name, r.mvp_count]));
}

export async function fetchStreaks(clubId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('league_streak_stats').select('*').eq('club_id', clubId);
  if (error) throw error;
  return new Map(data.map((r: { name: string; current_win_streak: number }) => [r.name, r.current_win_streak]));
}

export interface Rivalry {
  players: [string, string];
  gamesTogether: number;
  record: [number, number]; // [p1 wins, p2 wins] — closest to even = biggest rivalry
  provisional: boolean;
}

// "Closest" rivalry = smallest win-count gap relative to games played —
// a 5-5 record over 10 games is a bigger rivalry than a 1-0 record.
export async function fetchClosestRivalries(clubId: string): Promise<Rivalry[]> {
  const { data, error } = await supabase.from('league_rivalry_stats').select('*').eq('club_id', clubId);
  if (error) throw error;
  return data
    .map((r: { p1: string; p2: string; p1_games: number; p1_wins: number; p2_games: number; p2_wins: number }) => ({
      players: [r.p1, r.p2] as [string, string],
      gamesTogether: r.p1_games + r.p2_games,
      record: [r.p1_wins, r.p2_wins] as [number, number],
      provisional: r.p1_games + r.p2_games < MIN_GAMES_FOR_RIVALRY,
    }))
    .sort((a, b) => {
      if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
      const gapA = Math.abs(a.record[0] - a.record[1]);
      const gapB = Math.abs(b.record[0] - b.record[1]);
      if (gapA !== gapB) return gapA - gapB;
      return b.gamesTogether - a.gamesTogether;
    });
}

// All head-to-head pairings where BOTH players are in the given roster —
// unoriented (players[0]/players[1] is just p1/p2 order), used for the
// Storylines pregame brief, not a specific-player lookup.
export async function fetchRivalriesAmongRoster(clubId: string, names: string[]): Promise<Rivalry[]> {
  if (names.length < 2) return [];
  const { data, error } = await supabase.from('league_rivalry_stats').select('*').eq('club_id', clubId).in('p1', names).in('p2', names);
  if (error) throw error;
  return data.map((r: { p1: string; p2: string; p1_games: number; p1_wins: number; p2_games: number; p2_wins: number }) => ({
    players: [r.p1, r.p2] as [string, string],
    gamesTogether: r.p1_games + r.p2_games,
    record: [r.p1_wins, r.p2_wins] as [number, number],
    provisional: r.p1_games + r.p2_games < MIN_GAMES_FOR_RIVALRY,
  }));
}

// Every head-to-head pairing involving `name`, oriented so `name` is always
// players[0]. Unlike fetchClosestRivalries, this has no MIN_GAMES threshold
// or top-N cutoff — it's a direct lookup for one player's full rivalry list
// (Nemesis Alert, Head-to-Head Card), not a leaderboard.
export async function fetchRivalriesForPlayer(clubId: string, name: string): Promise<Rivalry[]> {
  // Two separate .eq() queries rather than .or(`p1.eq.${name},p2.eq.${name}`)
  // — PostgREST's or= filter syntax breaks on a value containing a comma or
  // parenthesis, both of which are valid characters in a human name.
  const [asP1, asP2] = await Promise.all([
    supabase.from('league_rivalry_stats').select('*').eq('club_id', clubId).eq('p1', name),
    supabase.from('league_rivalry_stats').select('*').eq('club_id', clubId).eq('p2', name),
  ]);
  if (asP1.error) throw asP1.error;
  if (asP2.error) throw asP2.error;
  const data = [...asP1.data, ...asP2.data];
  return data
    .map((r: { p1: string; p2: string; p1_games: number; p1_wins: number; p2_games: number; p2_wins: number }) => {
      const isP1 = r.p1 === name;
      const opponent = isP1 ? r.p2 : r.p1;
      const yourWins = isP1 ? r.p1_wins : r.p2_wins;
      const oppWins = isP1 ? r.p2_wins : r.p1_wins;
      const gamesTogether = r.p1_games + r.p2_games;
      return {
        players: [name, opponent] as [string, string],
        gamesTogether,
        record: [yourWins, oppWins] as [number, number],
        provisional: gamesTogether < MIN_GAMES_FOR_RIVALRY,
      };
    })
    .sort((a, b) => b.gamesTogether - a.gamesTogether);
}

// Admin-only — enforced again at the DB level by refresh_league_stats()
// itself (raises if the caller isn't an admin of any club), this is just so
// the UI can surface the real error message instead of a generic RPC
// failure. Refreshing recomputes every club's stats at once (matviews can't
// be refreshed per-club) — harmless for any club admin to trigger.
export async function refreshLeagueStats(): Promise<void> {
  const { error } = await supabase.rpc('refresh_league_stats');
  if (error) throw error;
}

// Crowns whoever is now #1 (ranked, non-provisional) on the lifetime
// leaderboard as "The Real King" badge holder. refresh_league_stats() is
// club-agnostic (refreshes every club's matviews in one call, see above), so
// this is a separate club-scoped step the caller runs right after — not
// folded into refreshLeagueStats() itself.
export async function syncTheRealKing(clubId: string): Promise<void> {
  const leaderboard = await fetchLifetimeLeaderboard(clubId);
  const leader = leaderboard.find(p => !p.provisional);
  if (!leader) return;
  await recordBadgeHolderChange(clubId, 'the_real_king', leader.name);
}
