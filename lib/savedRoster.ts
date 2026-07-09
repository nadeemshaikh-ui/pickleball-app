// Remembers the last-used player roster on this device (localStorage), so
// the same group doesn't need to retype every name each week.
const KEY = 'pickleball-saved-roster-v1';

export function saveRoster(names: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(names));
  } catch {
    // Private browsing / quota errors — losing the convenience save isn't
    // worth failing the whole session-creation flow over.
  }
}

export function loadRoster(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(n => typeof n === 'string') ? parsed : null;
  } catch {
    return null;
  }
}
