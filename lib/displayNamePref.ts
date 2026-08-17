// Per-device display preference (not stored server-side — this is purely
// "how do I want names to look on my screen", not a shared setting).
const STORAGE_KEY = 'pickleball-display-name-pref';

export type DisplayNamePref = 'nickname' | 'firstName';

export function getDisplayNamePref(): DisplayNamePref {
  if (typeof window === 'undefined') return 'nickname';
  return window.localStorage.getItem(STORAGE_KEY) === 'firstName' ? 'firstName' : 'nickname';
}

export function setDisplayNamePref(pref: DisplayNamePref): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, pref);
}

// Nickname preference still falls back to first name when no nickname is
// set — the preference only matters for players who actually have one.
export function displayName(player: { name: string; nickname?: string | null }): string {
  const norm = player.name.trim();
  if (norm.toLowerCase() === 'sid g') return 'Sid G';
  if (norm.toLowerCase() === 'sid k') return 'Sid K';
  const firstName = norm.split(' ')[0];
  if (getDisplayNamePref() === 'firstName') return firstName;
  return player.nickname?.trim() || firstName;
}
