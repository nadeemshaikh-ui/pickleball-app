// Standard single-elimination bracket seeding: next power of 2 >= team count,
// byes fill the remaining slots. Byes are placed via the same recursive
// seed-order construction real brackets use (seed 1 vs seed N, seed 2 vs
// seed N-1, etc.) so a bye always lands opposite the highest remaining seed
// rather than randomly, keeping the bracket fair.

export function computeBracketSize(teamCount: number): number {
  if (teamCount < 2) throw new Error(`A knockout bracket needs at least 2 teams, got ${teamCount}`);
  let size = 2;
  while (size < teamCount) size *= 2;
  return size;
}

// Canonical seed order for a bracket of `size` slots — e.g. size=8 yields
// [1,8,4,5,2,7,3,6], so seed 1 faces seed 8 in round 1, and the bracket stays
// internally consistent every subsequent round (top-half winner always meets
// bottom-half winner).
export function standardSeedOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`Bracket size must be a power of 2, got ${size}`);
  }
  let seeds = [1, 2];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    seeds = seeds.flatMap(s => [s, n + 1 - s]);
  }
  return seeds;
}

export interface SeededSlot {
  bracketSlot: number; // 0-based position in the first round
  seed: number;
  teamId: string | null;
  isBye: boolean;
}

// `teams` must already be ordered by seed ascending (best seed first) —
// callers derive that order from `tournament_teams.seed`, falling back to
// signup order for unseeded teams, before calling this.
export function seedKnockoutBracket(teams: { id: string }[]): SeededSlot[] {
  if (teams.length < 2) throw new Error(`A knockout bracket needs at least 2 teams, got ${teams.length}`);
  const size = computeBracketSize(teams.length);
  const order = standardSeedOrder(size);
  return order.map((seed, bracketSlot) => {
    const team = seed <= teams.length ? teams[seed - 1] : null;
    return { bracketSlot, seed, teamId: team?.id ?? null, isBye: team === null };
  });
}
