import { supabase } from './supabase';
import { wilsonLowerBound } from './wilsonScore';
import { recordBadgeHolderChange, fetchCurrentBadgeHolders, type BadgeHolder } from './badgeHolders';
import { computeCurrentStreaks, fetchStreakRecords } from './streakRecords';
import { fetchLadderStandings } from './ladderStandings';

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

const COURT_REGULAR_WINDOW_DAYS = 90;

export async function fetchSessionCounts90Days(clubId: string): Promise<Map<string, number>> {
  const since = new Date(Date.now() - COURT_REGULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .select('players')
    .eq('club_id', clubId)
    .gte('created_at', since);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data as { players: string[] }[]) {
    for (const name of row.players) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

// Same rotating-crown shape as syncTheRealKing — whoever's attended the
// most distinct sessions in the trailing 90 days holds "Court Regular"
// until someone overtakes them. Reads directly off sessions.players (no
// matview involved), so this doesn't depend on refresh_league_stats()
// having run first — still called alongside it from the same "Refresh
// Stats Now" trigger for one predictable place admins reconcile crowns.
export async function syncCourtRegular(clubId: string): Promise<void> {
  const counts = await fetchSessionCounts90Days(clubId);
  let winner: string | null = null;
  let winnerCount = 0;
  for (const [name, count] of counts) {
    if (count > winnerCount) {
      winner = name;
      winnerCount = count;
    }
  }
  if (!winner) return;
  await recordBadgeHolderChange(clubId, 'court_regular', winner, winnerCount);
}

// Forward-only elo history for the Glow-Up badge — there's no backfill, so
// a player's trend only becomes meaningful after they've played a few
// scored rounds since this shipped. Called once per participant right
// after a round score save (see session/[id]/play/page.tsx), the same
// point that already re-fetches fresh elo for the flight-change check.
export async function recordEloSnapshot(clubId: string, playerName: string, eloRating: number): Promise<void> {
  const { error } = await supabase.from('player_elo_snapshots').insert({ club_id: clubId, player_name: playerName, elo_rating: eloRating });
  if (error) throw error;
}

const GLOW_UP_WINDOW_DAYS = 90;

// Earliest snapshot within the trailing window — the closest thing to
// "elo 90 days ago" we have without a backfill. With less than 90 days of
// tracking history so far, this is just the first sample ever recorded,
// which understates any real gain rather than overstating it.
export async function fetchEloBaseline(clubId: string, playerName: string): Promise<number | null> {
  const since = new Date(Date.now() - GLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('player_elo_snapshots')
    .select('elo_rating')
    .eq('club_id', clubId)
    .eq('player_name', playerName)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.elo_rating ?? null;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Best-effort POTM history — there's no cron in this app, everything is
// admin-refresh-triggered, so this captures "whoever's leading the current
// month right now" every time an admin hits Refresh Stats Now, upserting
// over the same month's row as the lead changes. It settles on the real
// final winner as long as someone refreshes at all near month-end, which
// matches how every other synced crown in this app already works — not a
// guarantee, but not a guess either.
export async function recordPotmProgress(clubId: string): Promise<void> {
  const board = await fetchPlayerOfTheMonthBoard(clubId);
  const leader = board.find(p => !p.provisional);
  if (!leader) return;
  const { error } = await supabase
    .from('league_potm_history')
    .upsert(
      { club_id: clubId, period_key: currentMonthKey(), period_type: 'month', winner_name: leader.name, recorded_at: new Date().toISOString() },
      { onConflict: 'club_id,period_key,period_type' }
    );
  if (error) throw error;
}

export async function fetchPotmWinCount(clubId: string, playerName: string): Promise<number> {
  const { count, error } = await supabase
    .from('league_potm_history')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('period_type', 'month')
    .eq('winner_name', playerName);
  if (error) throw error;
  return count ?? 0;
}

// True if this player owns the 3 most recent recorded months outright —
// not necessarily 3 calendar-consecutive months, since a month an admin
// never refreshed during just has no row at all rather than a false one.
export async function hasThreePeat(clubId: string, playerName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('league_potm_history')
    .select('winner_name')
    .eq('club_id', clubId)
    .eq('period_type', 'month')
    .order('period_key', { ascending: false })
    .limit(3);
  if (error) throw error;
  return data.length === 3 && data.every(r => r.winner_name === playerName);
}

// ---------------------------------------------------------------------
// Exclusive Crowns — the 10 club-wide contestable badges (5 pre-existing:
// streak_king/wooden_spoon/ladder_champion/the_real_king/court_regular,
// plus 5 new: iron_throne/head_honcho/undisputed/the_gatekeeper/
// the_untouchable). One function assembles every crown's full ranked
// standings so both the "who to crown" sync and the "how close are the
// chasers" UI read off the same numbers — computing it twice would risk
// the crowned holder and the displayed #1 silently disagreeing.
// ---------------------------------------------------------------------

export interface CrownEntry {
  name: string;
  value: number;
}

export interface CrownBoard {
  badgeId: string;
  label: string;
  unit: string;
  standings: CrownEntry[]; // sorted descending, index 0 is the rightful holder
}

const UNDISPUTED_MIN_GAMES = MIN_GAMES_FOR_RANKING;

export async function fetchCrownBoards(clubId: string): Promise<CrownBoard[]> {
  const [playersRes, lifetime, mvpCounts, winStreaks, ladder, fullStreaks, sessionCounts90d, streakRecords] = await Promise.all([
    supabase.from('players').select('name, elo_rating').eq('club_id', clubId),
    fetchLifetimeLeaderboard(clubId),
    fetchMvpCounts(clubId),
    fetchStreaks(clubId),
    fetchLadderStandings(clubId),
    computeCurrentStreaks(clubId),
    fetchSessionCounts90Days(clubId),
    fetchStreakRecords(clubId),
  ]);
  if (playersRes.error) throw playersRes.error;
  const players = playersRes.data as { name: string; elo_rating: number }[];

  const desc = (entries: CrownEntry[]) => entries.sort((a, b) => b.value - a.value);

  const ironThrone = desc(players.map(p => ({ name: p.name, value: Math.round(p.elo_rating) })));
  const headHoncho = desc(lifetime.map(p => ({ name: p.name, value: p.wins })));
  const undisputed = desc(
    lifetime.filter(p => p.gamesPlayed >= UNDISPUTED_MIN_GAMES).map(p => ({ name: p.name, value: Math.round(p.winPct * 100) }))
  );
  const gatekeeper = desc([...mvpCounts.entries()].map(([name, value]) => ({ name, value })));
  const untouchable = desc([...winStreaks.entries()].filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })));

  const winRecord = streakRecords.find(r => r.streakType === 'win')?.recordLength ?? 0;
  const lossRecord = streakRecords.find(r => r.streakType === 'loss')?.recordLength ?? 0;
  const activeWinStreaks = desc([...fullStreaks.entries()].filter(([, s]) => s.type === 'win').map(([name, s]) => ({ name, value: s.length })));
  const activeLossStreaks = desc([...fullStreaks.entries()].filter(([, s]) => s.type === 'loss').map(([name, s]) => ({ name, value: s.length })));
  // Record crowns don't have "standings" in the normal sense (there's only
  // one all-time record) — chasers are whoever's currently closing in on it
  // with an active streak of their own, capped at the record itself.
  const streakKingBoard = winRecord > 0 ? [{ name: streakRecords.find(r => r.streakType === 'win')!.holderName, value: winRecord }, ...activeWinStreaks] : activeWinStreaks;
  const woodenSpoonBoard = lossRecord > 0 ? [{ name: streakRecords.find(r => r.streakType === 'loss')!.holderName, value: lossRecord }, ...activeLossStreaks] : activeLossStreaks;

  const ladderBoard = ladder.map(s => ({ name: s.player_name, value: 1000 - s.rung })).sort((a, b) => b.value - a.value);
  const realKingBoard = desc(lifetime.filter(p => !p.provisional).map(p => ({ name: p.name, value: Math.round(p.wilsonScore * 1000) })));
  const courtRegularBoard = desc([...sessionCounts90d.entries()].map(([name, value]) => ({ name, value })));

  return [
    { badgeId: 'streak_king', label: 'The Streak King', unit: 'games', standings: dedupeByName(streakKingBoard) },
    { badgeId: 'wooden_spoon', label: 'Wooden Spoon', unit: 'games', standings: dedupeByName(woodenSpoonBoard) },
    { badgeId: 'ladder_champion', label: 'Ladder Champion', unit: 'rung', standings: ladderBoard },
    { badgeId: 'the_real_king', label: 'The Real King', unit: 'score', standings: realKingBoard },
    { badgeId: 'court_regular', label: 'Court Regular', unit: 'sessions', standings: courtRegularBoard },
    { badgeId: 'iron_throne', label: 'The Iron Throne', unit: 'rating', standings: ironThrone },
    { badgeId: 'head_honcho', label: 'Head Honcho', unit: 'wins', standings: headHoncho },
    { badgeId: 'undisputed', label: 'Undisputed', unit: '% wins', standings: undisputed },
    { badgeId: 'the_gatekeeper', label: 'The Gatekeeper', unit: 'MVPs', standings: gatekeeper },
    { badgeId: 'the_untouchable', label: 'The Untouchable', unit: 'game streak', standings: untouchable },
  ];
}

function dedupeByName(entries: CrownEntry[]): CrownEntry[] {
  const seen = new Set<string>();
  const out: CrownEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push(e);
  }
  return out;
}

// Crowns the top standing for each of the 5 new exclusive badges — same
// recordBadgeHolderChange pattern as syncTheRealKing/syncCourtRegular,
// called alongside them from the same "Refresh Stats Now" trigger.
export async function syncNewExclusiveCrowns(clubId: string): Promise<void> {
  const boards = await fetchCrownBoards(clubId);
  const newCrownIds = new Set(['iron_throne', 'head_honcho', 'undisputed', 'the_gatekeeper', 'the_untouchable']);
  await Promise.all(
    boards
      .filter(b => newCrownIds.has(b.badgeId) && b.standings.length > 0)
      .map(b => recordBadgeHolderChange(clubId, b.badgeId, b.standings[0].name, b.standings[0].value))
  );
}

export type { BadgeHolder };
export { fetchCurrentBadgeHolders };
