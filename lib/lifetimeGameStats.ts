import { supabase } from './supabase';

export interface LifetimeGameStats {
  maxMargin: number;
  nailBiters: number; // games decided by <=2 points
  shutouts: number; // games won with the opponent scoring 0
  perfectSessions: number; // sessions (3+ games) with a 100% win record
  formats: Set<string>;
  squadRivalryWins: number;
  nightSessions: number; // sessions started at/after 20:00
  firstSessionDate: string | null; // earliest session (YYYY-MM-DD) this player appeared in
  hadComebackFromLoss: boolean; // won a game right after a 5+ game losing streak, anywhere in history
  winsByFormat: Map<string, number>;
  gamesByFormat: Map<string, number>;
  earlySessions: number; // sessions started before 08:00
  weekendSessions: number; // sessions on a Saturday or Sunday
  monsoonSessions: number; // sessions played June-September
  diwaliSessions: number; // sessions played during a known Diwali week
  iplFinalSessions: number; // sessions played on a known IPL final date
  playedFullHouseSession: boolean; // ever played in a session with 12+ total players
}

const NIGHT_OWL_START_TIME = '20:00';
const EARLY_BIRD_END_TIME = '08:00';
const FULL_HOUSE_MIN_PLAYERS = 12;
const COMEBACK_LOSS_STREAK = 5;

// Diwali is a lunar-calendar holiday and shifts every year; IPL final dates
// are set by the league each season — neither can be computed, only looked
// up. Deliberately left sparse rather than guessing dates we're not
// confident about; add each new year's range/date as it's confirmed.
const DIWALI_WEEKS: [string, string][] = [
  ['2024-10-29', '2024-11-04'],
  ['2025-10-17', '2025-10-23'],
  ['2026-11-05', '2026-11-11'], // Diwali falls Sun Nov 8, 2026
];
const IPL_FINAL_DATES: string[] = ['2024-05-26', '2025-06-03', '2026-05-31'];

function inDateRange(dateStr: string, ranges: [string, string][]): boolean {
  return ranges.some(([start, end]) => dateStr >= start && dateStr <= end);
}

// One full scan of every scored round, joined to its session for format/
// start_time/created_at/roster — mirrors computeCurrentStreaks' club-wide-
// scan approach rather than a dozen separate aggregate queries. Cheap at
// this club's data scale (low hundreds of rounds), and avoids new Postgres
// functions for what's a one-off per-player rollup used only by the badge
// catalog. Rows are sorted chronologically (session date, then round
// number) before scanning so per-player win/loss sequences — used for the
// comeback-streak detection — are built in true play order, not insertion
// order.
export async function fetchLifetimeGameStats(clubId: string): Promise<Map<string, LifetimeGameStats>> {
  const { data, error } = await supabase
    .from('rounds')
    .select('session_id, round_number, team_a, team_b, score_a, score_b, sessions!inner(club_id, format, start_time, created_at, players)')
    .eq('sessions.club_id', clubId)
    .not('score_a', 'is', null)
    .not('score_b', 'is', null);
  if (error) throw error;

  type Row = {
    session_id: string;
    round_number: number;
    team_a: string[];
    team_b: string[];
    score_a: number;
    score_b: number;
    sessions: { format: string; start_time: string | null; created_at: string; players: string[] };
  };
  const rows = (data as unknown as Row[]).slice().sort((a, b) => {
    const byDate = new Date(a.sessions.created_at).getTime() - new Date(b.sessions.created_at).getTime();
    return byDate !== 0 ? byDate : a.round_number - b.round_number;
  });

  const stats = new Map<string, LifetimeGameStats>();
  const perPlayerSession = new Map<string, Map<string, boolean[]>>(); // name -> sessionId -> [won,...]
  const nightSessionsByPlayer = new Map<string, Set<string>>();
  const earlySessionsByPlayer = new Map<string, Set<string>>();
  const weekendSessionsByPlayer = new Map<string, Set<string>>();
  const monsoonSessionsByPlayer = new Map<string, Set<string>>();
  const diwaliSessionsByPlayer = new Map<string, Set<string>>();
  const iplSessionsByPlayer = new Map<string, Set<string>>();
  const perPlayerOrderedResults = new Map<string, boolean[]>(); // chronological, oldest first

  function get(name: string): LifetimeGameStats {
    let s = stats.get(name);
    if (!s) {
      s = {
        maxMargin: 0,
        nailBiters: 0,
        shutouts: 0,
        perfectSessions: 0,
        formats: new Set(),
        squadRivalryWins: 0,
        nightSessions: 0,
        firstSessionDate: null,
        hadComebackFromLoss: false,
        winsByFormat: new Map(),
        gamesByFormat: new Map(),
        earlySessions: 0,
        weekendSessions: 0,
        monsoonSessions: 0,
        diwaliSessions: 0,
        iplFinalSessions: 0,
        playedFullHouseSession: false,
      };
      stats.set(name, s);
    }
    return s;
  }

  for (const r of rows) {
    const margin = Math.abs(r.score_a - r.score_b);
    const aWon = r.score_a > r.score_b;
    const startTime = r.sessions.start_time ?? '';
    const isNight = startTime >= NIGHT_OWL_START_TIME;
    const isEarly = startTime !== '' && startTime < EARLY_BIRD_END_TIME;
    const sessionDate = r.sessions.created_at.slice(0, 10);
    const dayOfWeek = new Date(r.sessions.created_at).getUTCDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const month = Number(sessionDate.slice(5, 7));
    const isMonsoon = month >= 6 && month <= 9;
    const isDiwali = inDateRange(sessionDate, DIWALI_WEEKS);
    const isIplFinal = IPL_FINAL_DATES.includes(sessionDate);
    const isFullHouse = r.sessions.players.length >= FULL_HOUSE_MIN_PLAYERS;

    for (const name of [...r.team_a, ...r.team_b]) {
      const s = get(name);
      s.formats.add(r.sessions.format);
      if (margin > s.maxMargin) s.maxMargin = margin;
      if (margin <= 2) s.nailBiters++;

      const won = r.team_a.includes(name) ? aWon : !aWon;
      if (won && (r.team_a.includes(name) ? r.score_b === 0 : r.score_a === 0)) s.shutouts++;
      if (won && r.sessions.format === 'squad_rivalry') s.squadRivalryWins++;

      s.gamesByFormat.set(r.sessions.format, (s.gamesByFormat.get(r.sessions.format) ?? 0) + 1);
      if (won) s.winsByFormat.set(r.sessions.format, (s.winsByFormat.get(r.sessions.format) ?? 0) + 1);

      if (!s.firstSessionDate || sessionDate < s.firstSessionDate) s.firstSessionDate = sessionDate;
      if (isFullHouse) s.playedFullHouseSession = true;

      const bySession = perPlayerSession.get(name) ?? perPlayerSession.set(name, new Map()).get(name)!;
      const list = bySession.get(r.session_id) ?? bySession.set(r.session_id, []).get(r.session_id)!;
      list.push(won);

      const ordered = perPlayerOrderedResults.get(name) ?? perPlayerOrderedResults.set(name, []).get(name)!;
      ordered.push(won);

      if (isNight) (nightSessionsByPlayer.get(name) ?? nightSessionsByPlayer.set(name, new Set()).get(name)!).add(r.session_id);
      if (isEarly) (earlySessionsByPlayer.get(name) ?? earlySessionsByPlayer.set(name, new Set()).get(name)!).add(r.session_id);
      if (isWeekend) (weekendSessionsByPlayer.get(name) ?? weekendSessionsByPlayer.set(name, new Set()).get(name)!).add(r.session_id);
      if (isMonsoon) (monsoonSessionsByPlayer.get(name) ?? monsoonSessionsByPlayer.set(name, new Set()).get(name)!).add(r.session_id);
      if (isDiwali) (diwaliSessionsByPlayer.get(name) ?? diwaliSessionsByPlayer.set(name, new Set()).get(name)!).add(r.session_id);
      if (isIplFinal) (iplSessionsByPlayer.get(name) ?? iplSessionsByPlayer.set(name, new Set()).get(name)!).add(r.session_id);
    }
  }

  for (const [name, bySession] of perPlayerSession) {
    const s = get(name);
    for (const results of bySession.values()) {
      if (results.length >= 3 && results.every(Boolean)) s.perfectSessions++;
    }
    s.nightSessions = nightSessionsByPlayer.get(name)?.size ?? 0;
    s.earlySessions = earlySessionsByPlayer.get(name)?.size ?? 0;
    s.weekendSessions = weekendSessionsByPlayer.get(name)?.size ?? 0;
    s.monsoonSessions = monsoonSessionsByPlayer.get(name)?.size ?? 0;
    s.diwaliSessions = diwaliSessionsByPlayer.get(name)?.size ?? 0;
    s.iplFinalSessions = iplSessionsByPlayer.get(name)?.size ?? 0;

    let lossStreak = 0;
    for (const won of perPlayerOrderedResults.get(name) ?? []) {
      if (!won) {
        lossStreak++;
      } else {
        if (lossStreak >= COMEBACK_LOSS_STREAK) s.hadComebackFromLoss = true;
        lossStreak = 0;
      }
    }
  }

  return stats;
}
