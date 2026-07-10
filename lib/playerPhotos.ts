import { supabase } from './supabase';

// In-memory cache of name -> photo_url, populated from the players table.
// Kept sync-readable (getPlayerPhoto) so Avatar doesn't need to become
// async everywhere it's used — callers preload once per page via
// preloadPlayerPhotos() alongside their other data fetches.
let cache: Record<string, string> = {};

export async function preloadPlayerPhotos(): Promise<void> {
  const { data, error } = await supabase.from('players').select('name, photo_url').not('photo_url', 'is', null);
  if (error || !data) return;
  cache = Object.fromEntries(data.filter(p => p.photo_url).map(p => [p.name, p.photo_url as string]));
}

export function getPlayerPhoto(name: string): string | null {
  return cache[name] ?? null;
}

// Updates the local cache immediately for UI feedback. Does not persist —
// persistence happens via lib/players.ts upsertOwnPlayer (self-or-admin
// only, enforced by RLS), which the caller is responsible for calling too.
export function savePlayerPhoto(name: string, url: string): void {
  cache[name] = url;
}
