import { supabase } from './supabase';

// Shared roster stored in Supabase (not localStorage) so it's the same on
// every device/phone, not just the one that last saved it.
const ROSTER_ID = 'default';

export async function saveRoster(names: string[]): Promise<void> {
  try {
    await supabase.from('saved_rosters').upsert({ id: ROSTER_ID, names, updated_at: new Date().toISOString() });
  } catch {
    // Losing the convenience save isn't worth failing session creation over.
  }
}

export async function loadRoster(): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.from('saved_rosters').select('names').eq('id', ROSTER_ID).maybeSingle();
    if (error || !data) return null;
    const names = data.names;
    return Array.isArray(names) && names.every(n => typeof n === 'string') ? names : null;
  } catch {
    return null;
  }
}
