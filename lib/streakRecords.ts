import { supabase } from './supabase';

export interface StreakRecord {
  streakType: 'win' | 'loss';
  recordLength: number;
  holderName: string;
  achievedAt: string;
}

export async function fetchStreakRecords(clubId: string): Promise<StreakRecord[]> {
  const { data, error } = await supabase.from('league_streak_records').select('*').eq('club_id', clubId);
  if (error) throw error;
  return data.map((r: { streak_type: 'win' | 'loss'; record_length: number; holder_name: string; achieved_at: string }) => ({
    streakType: r.streak_type,
    recordLength: r.record_length,
    holderName: r.holder_name,
    achievedAt: r.achieved_at,
  }));
}

// Computes each player's current streak directly from raw match history
// (not the league_streak_stats matview, which only updates on an
// admin-triggered refresh — too stale to drive a live dethrone check right
// after a score is saved). Small club-scale dataset, so one full scan per
// save is cheap.
export async function computeCurrentStreaks(clubId: string): Promise<Map<string, { type: 'win' | 'loss'; length: number }>> {
  const { data, error } = await supabase
    .from('rounds')
    .select('round_number, team_a, team_b, score_a, score_b, sessions!inner(created_at, club_id)')
    .eq('sessions.club_id', clubId)
    .not('score_a', 'is', null)
    .not('score_b', 'is', null);
  if (error) throw error;

  type Row = { round_number: number; team_a: string[]; team_b: string[]; score_a: number; score_b: number; sessions: { created_at: string } };
  const rows = (data as unknown as Row[]).slice().sort((a, b) => {
    const byDate = new Date(b.sessions.created_at).getTime() - new Date(a.sessions.created_at).getTime();
    return byDate !== 0 ? byDate : b.round_number - a.round_number;
  });

  const perPlayer = new Map<string, boolean[]>(); // most-recent-first list of "won"
  for (const r of rows) {
    for (const name of r.team_a) (perPlayer.get(name) ?? perPlayer.set(name, []).get(name)!).push(r.score_a > r.score_b);
    for (const name of r.team_b) (perPlayer.get(name) ?? perPlayer.set(name, []).get(name)!).push(r.score_b > r.score_a);
  }

  const streaks = new Map<string, { type: 'win' | 'loss'; length: number }>();
  for (const [name, results] of perPlayer) {
    if (results.length === 0) continue;
    const type: 'win' | 'loss' = results[0] ? 'win' : 'loss';
    let length = 0;
    for (const won of results) {
      if ((type === 'win') !== won) break;
      length++;
    }
    streaks.set(name, { type, length });
  }
  return streaks;
}

// Called after a match result is recorded. Compares the player's current
// streak (from league_streak_stats) against the club's stored record and
// upserts a new record — and a new crown holder — if it was just broken.
// Returns the new record if one was set, null if the existing record held.
export async function maybeSetStreakRecord(
  clubId: string,
  streakType: 'win' | 'loss',
  playerName: string,
  currentStreakLength: number
): Promise<StreakRecord | null> {
  const { data: existing, error: fetchError } = await supabase
    .from('league_streak_records')
    .select('record_length')
    .eq('club_id', clubId)
    .eq('streak_type', streakType)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing && existing.record_length >= currentStreakLength) return null;

  const achievedAt = new Date().toISOString();
  const { error: upsertError } = await supabase.from('league_streak_records').upsert(
    {
      club_id: clubId,
      streak_type: streakType,
      record_length: currentStreakLength,
      holder_name: playerName,
      achieved_at: achievedAt,
    },
    { onConflict: 'club_id,streak_type' }
  );
  if (upsertError) throw upsertError;

  return { streakType, recordLength: currentStreakLength, holderName: playerName, achievedAt };
}
