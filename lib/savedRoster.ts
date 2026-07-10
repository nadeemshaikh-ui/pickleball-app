import { supabase } from './supabase';

// Shared roster stored in Supabase (not localStorage) so it's the same on
// every device/phone, not just the one that last saved it. One roster row
// per club — the club's id doubles as this table's primary key.

export async function saveRoster(clubId: string, names: string[]): Promise<void> {
  try {
    await supabase.from('saved_rosters').upsert({ id: clubId, club_id: clubId, names, updated_at: new Date().toISOString() });
  } catch {
    // Losing the convenience save isn't worth failing session creation over.
  }
}

export async function loadRoster(clubId: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.from('saved_rosters').select('names').eq('club_id', clubId).maybeSingle();
    if (error || !data) return null;
    const names = data.names;
    return Array.isArray(names) && names.every(n => typeof n === 'string') ? names : null;
  } catch {
    return null;
  }
}
