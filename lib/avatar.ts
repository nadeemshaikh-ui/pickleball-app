// Kept within the app's strict navy/white/yellow identity — no leftover
// green/orange from the old palette.
const PALETTE = ['#121a2f', '#3a4a6b', '#5c2a4a', '#2f4f4f', '#5a3d1f', '#3d2f5a', '#1f4d4d', '#4a2f2f'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
