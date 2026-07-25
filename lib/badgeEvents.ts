import { supabase } from './supabase';

export interface BadgeEvent {
  badgeId: string;
  earnedAt: string;
}

async function fetchBadgeEvents(clubId: string, playerName: string): Promise<BadgeEvent[]> {
  const { data, error } = await supabase
    .from('league_badge_events')
    .select('badge_id, earned_at')
    .eq('club_id', clubId)
    .eq('player_name', playerName);
  if (error) throw error;
  return data.map((r: { badge_id: string; earned_at: string }) => ({ badgeId: r.badge_id, earnedAt: r.earned_at }));
}

// Compares currently-computed badge ids against previously-logged events and
// inserts rows for any that are new. Returns the newly-earned badge ids —
// the caller uses this list to trigger the unlock celebration.
export async function recordNewlyEarnedBadges(clubId: string, playerName: string, currentBadgeIds: string[]): Promise<string[]> {
  const known = await fetchBadgeEvents(clubId, playerName);
  const knownIds = new Set(known.map(k => k.badgeId));
  const newlyEarned = currentBadgeIds.filter(id => !knownIds.has(id));
  if (newlyEarned.length === 0) return [];

  const { error } = await supabase.from('league_badge_events').insert(
    newlyEarned.map(badgeId => ({ club_id: clubId, player_name: playerName, badge_id: badgeId }))
  );
  if (error) throw error;

  return newlyEarned;
}
