const KEY = 'pickleball-player-photos-v1';

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getPlayerPhoto(name: string): string | null {
  return readMap()[name] ?? null;
}

export function savePlayerPhoto(name: string, url: string): void {
  try {
    const map = readMap();
    map[name] = url;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}
