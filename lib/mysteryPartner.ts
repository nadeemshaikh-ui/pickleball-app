export interface MysteryPair {
  players: [string, string];
}

// Fisher-Yates on Math.random directly — deliberately NOT the seeded PRNG in
// lib/shuffle.ts (seededRandom), which exists specifically so a session's
// schedule is reproducible from its id. A live Mystery Partner draw must be
// genuinely unpredictable and non-replayable, the opposite property.
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Randomly pairs up `pool`. If pool.length is odd, `byePlayer` (must be a
// member of pool) is required and sits out — an explicit organizer choice,
// never a silent drop of the last unpaired player, per the locked spec's
// required odd-pool-size fallback.
export function drawMysteryPairs(pool: string[], byePlayer?: string): MysteryPair[] {
  if (byePlayer && !pool.includes(byePlayer)) {
    throw new Error('The bye player must be part of the pool.');
  }
  const working = byePlayer ? pool.filter(p => p !== byePlayer) : [...pool];
  if (working.length < 2) throw new Error('Need at least 2 players (after any bye) to draw pairs.');
  if (working.length % 2 !== 0) {
    throw new Error('Pool has an odd number of players — pick someone to sit out this draw first.');
  }
  const shuffled = shuffle(working);
  const pairs: MysteryPair[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push({ players: [shuffled[i], shuffled[i + 1]] });
  }
  return pairs;
}
