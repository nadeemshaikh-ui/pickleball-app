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
