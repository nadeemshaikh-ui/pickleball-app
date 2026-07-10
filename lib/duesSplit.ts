// Equal split across everyone who played, rounded to the nearest rupee —
// paise-level precision isn't worth the UI complexity for a friend group.
// Dependency-free so it's unit-testable without Supabase env vars.
export function computeDuesSplit(courtCost: number, ballCost: number, players: string[]): { name: string; amount: number }[] {
  if (players.length === 0) return [];
  const total = courtCost + ballCost;
  const perHead = Math.round(total / players.length);
  return players.map(name => ({ name, amount: perHead }));
}
