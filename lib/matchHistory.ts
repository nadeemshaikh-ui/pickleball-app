import { supabase } from './supabase';

export interface MatchHistoryEntry {
  sessionId: string;
  date: string;
  format: string;
  round: number;
  yourScore: number;
  opponentScore: number;
  won: boolean;
  yourPartner: string | null;
  opponentPartner: string | null;
}

// Full match-by-match log between two specific players — every prior stat
// in this app (league_rivalry_stats etc.) is an aggregate matview with no
// per-match detail. One full scan of scored rounds joined to their session
// (same approach as computeCurrentStreaks/fetchLifetimeGameStats), filtered
// to rounds where both players appear on OPPOSITE teams. Excludes voided
// sessions, same as every other stat in the app.
export async function fetchMatchHistory(clubId: string, playerA: string, playerB: string): Promise<MatchHistoryEntry[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('session_id, round_number, team_a, team_b, score_a, score_b, sessions!inner(club_id, created_at, format, status)')
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
    sessions: { created_at: string; format: string; status: string };
  };
  const rows = data as unknown as Row[];

  const entries: MatchHistoryEntry[] = [];
  for (const r of rows) {
    if (r.sessions.status === 'voided') continue;
    const aHasP1 = r.team_a.includes(playerA);
    const aHasP2 = r.team_a.includes(playerB);
    const bHasP1 = r.team_b.includes(playerA);
    const bHasP2 = r.team_b.includes(playerB);

    if (aHasP1 && bHasP2) {
      entries.push({
        sessionId: r.session_id,
        date: r.sessions.created_at,
        format: r.sessions.format,
        round: r.round_number,
        yourScore: r.score_a,
        opponentScore: r.score_b,
        won: r.score_a > r.score_b,
        yourPartner: r.team_a.find(n => n !== playerA) ?? null,
        opponentPartner: r.team_b.find(n => n !== playerB) ?? null,
      });
    } else if (bHasP1 && aHasP2) {
      entries.push({
        sessionId: r.session_id,
        date: r.sessions.created_at,
        format: r.sessions.format,
        round: r.round_number,
        yourScore: r.score_b,
        opponentScore: r.score_a,
        won: r.score_b > r.score_a,
        yourPartner: r.team_b.find(n => n !== playerA) ?? null,
        opponentPartner: r.team_a.find(n => n !== playerB) ?? null,
      });
    }
  }

  return entries.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
}
