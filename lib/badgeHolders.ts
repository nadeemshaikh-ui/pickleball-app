import { supabase } from './supabase';

// Generic "crown" tracking for contestable badges — a single current holder
// per (club, badge), with a full history log so "how many times has X held
// this badge" is answerable. league_streak_records stays the source of
// truth for the win/loss streak crowns' record_length (already has its own
// upsert-per-type shape and other readers); this table only layers a change
// log on top for badge purposes, and is the sole store for newer crowns
// (ladder_champion, the_real_king) that have no other table of their own.

export interface BadgeHolder {
  badgeId: string;
  holderName: string;
  recordValue: number | null;
  heldFrom: string;
}

export async function fetchCurrentBadgeHolders(clubId: string): Promise<Map<string, BadgeHolder>> {
  const { data, error } = await supabase
    .from('league_badge_holder_history')
    .select('badge_id, holder_name, record_value, held_from')
    .eq('club_id', clubId)
    .is('held_until', null);
  if (error) throw error;
  return new Map(
    (data as { badge_id: string; holder_name: string; record_value: number | null; held_from: string }[]).map(r => [
      r.badge_id,
      { badgeId: r.badge_id, holderName: r.holder_name, recordValue: r.record_value, heldFrom: r.held_from },
    ])
  );
}

// How many separate times each player has held a given badge — a repeat
// stretch (never lost + relogged) only counts once since we never close and
// reopen a row for the same consecutive holder.
export async function fetchBadgeHoldCounts(clubId: string, badgeId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('league_badge_holder_history').select('holder_name').eq('club_id', clubId).eq('badge_id', badgeId);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data as { holder_name: string }[]) {
    counts.set(row.holder_name, (counts.get(row.holder_name) ?? 0) + 1);
  }
  return counts;
}

// Crowns a new holder if the badge is currently unheld or held by someone
// else. No-op if `newHolderName` already holds it (avoids spurious history
// rows on every recompute). Not atomic across the close+insert — acceptable
// at this club's write scale (see resolveLadderChallenge for the same
// tradeoff reasoning).
export async function recordBadgeHolderChange(clubId: string, badgeId: string, newHolderName: string, recordValue?: number): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('league_badge_holder_history')
    .select('id, holder_name')
    .eq('club_id', clubId)
    .eq('badge_id', badgeId)
    .is('held_until', null)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (current?.holder_name === newHolderName) return;

  const now = new Date().toISOString();
  if (current) {
    const { error } = await supabase.from('league_badge_holder_history').update({ held_until: now }).eq('id', current.id);
    if (error) throw error;
  }
  const { error: insertError } = await supabase
    .from('league_badge_holder_history')
    .insert({ club_id: clubId, badge_id: badgeId, holder_name: newHolderName, record_value: recordValue ?? null, held_from: now });
  if (insertError) throw insertError;
}
