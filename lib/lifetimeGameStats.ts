import { supabase } from './supabase';

export interface LifetimeGameStats {
  maxMargin: number;
  nailBiters: number; // games decided by <=2 points
  shutouts: number; // games won with the opponent scoring 0
  perfectSessions: number; // sessions (3+ games) with a 100% win record
  formats: Set<string>;
  squadRivalryWins: number;
  nightSessions: number; // sessions started at/after 20:00
}

const NIGHT_OWL_START_TIME = '20:00';

// One full scan of every scored round, joined to its session for format/
// start_time — mirrors computeCurrentStreaks' club-wide-scan approach rather
// than six separate aggregate queries. Cheap at this club's data scale
// (low hundreds of rounds), and avoids new Postgres functions for what's a
// one-off per-player rollup used only by the badge catalog.
export async function fetchLifetimeGameStats(clubId: string): Promise<Map<string, LifetimeGameStats>> {
  const { data, error } = await supabase
    .from('rounds')
    .select('session_id, team_a, team_b, score_a, score_b, sessions!inner(club_id, format, start_time)')
    .eq('sessions.club_id', clubId)
    .not('score_a', 'is', null)
    .not('score_b', 'is', null);
  if (error) throw error;

  type Row = {
    session_id: string;
    team_a: string[];
    team_b: string[];
    score_a: number;
    score_b: number;
    sessions: { format: string; start_time: string | null };
  };
  const rows = data as unknown as Row[];

  const stats = new Map<string, LifetimeGameStats>();
  const perPlayerSession = new Map<string, Map<string, boolean[]>>(); // name -> sessionId -> [won,...]
  const nightSessionsByPlayer = new Map<string, Set<string>>();

  function get(name: string): LifetimeGameStats {
    let s = stats.get(name);
    if (!s) {
      s = { maxMargin: 0, nailBiters: 0, shutouts: 0, perfectSessions: 0, formats: new Set(), squadRivalryWins: 0, nightSessions: 0 };
      stats.set(name, s);
    }
    return s;
  }

  for (const r of rows) {
    const margin = Math.abs(r.score_a - r.score_b);
    const aWon = r.score_a > r.score_b;
    const isNight = (r.sessions.start_time ?? '') >= NIGHT_OWL_START_TIME;

    for (const name of [...r.team_a, ...r.team_b]) {
      const s = get(name);
      s.formats.add(r.sessions.format);
      if (margin > s.maxMargin) s.maxMargin = margin;
      if (margin <= 2) s.nailBiters++;

      const won = r.team_a.includes(name) ? aWon : !aWon;
      if (won && (r.team_a.includes(name) ? r.score_b === 0 : r.score_a === 0)) s.shutouts++;
      if (won && r.sessions.format === 'squad_rivalry') s.squadRivalryWins++;

      const bySession = perPlayerSession.get(name) ?? perPlayerSession.set(name, new Map()).get(name)!;
      const list = bySession.get(r.session_id) ?? bySession.set(r.session_id, []).get(r.session_id)!;
      list.push(won);

      if (isNight) {
        const nights = nightSessionsByPlayer.get(name) ?? nightSessionsByPlayer.set(name, new Set()).get(name)!;
        nights.add(r.session_id);
      }
    }
  }

  for (const [name, bySession] of perPlayerSession) {
    const s = get(name);
    for (const results of bySession.values()) {
      if (results.length >= 3 && results.every(Boolean)) s.perfectSessions++;
    }
    s.nightSessions = nightSessionsByPlayer.get(name)?.size ?? 0;
  }

  return stats;
}
