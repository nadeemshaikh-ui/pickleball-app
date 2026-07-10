// Ladder League: each player holds an individual rung (1 = top). Doubles
// matches are scored as a challenge between the two sides' average rungs.
// Movement is a single pairwise swap, not a cascade: if the better-ranked
// side wins (expected outcome), nothing moves. If the worse-ranked side
// wins (an upset), the two sides trade rung numbers, better-vs-better so
// each foursome's internal ordering carries over rather than scrambling.
export const LADDER_CHALLENGE_RANGE = 3;

export interface LadderPlayer {
  name: string;
  rung: number;
}

export function sideRung(rungs: [number, number]): number {
  return (rungs[0] + rungs[1]) / 2;
}

export function isValidLadderChallenge(sideARung: number, sideBRung: number): boolean {
  return Math.abs(sideARung - sideBRung) <= LADDER_CHALLENGE_RANGE;
}

export interface LadderRungChange {
  name: string;
  rung: number;
}

// Returns the rung changes to apply, or [] if the result didn't upset the
// existing order (winners were already ranked equal-or-better).
export function applyLadderMovement(
  winners: [LadderPlayer, LadderPlayer],
  losers: [LadderPlayer, LadderPlayer]
): LadderRungChange[] {
  const winnerAvg = sideRung([winners[0].rung, winners[1].rung]);
  const loserAvg = sideRung([losers[0].rung, losers[1].rung]);
  if (!isValidLadderChallenge(winnerAvg, loserAvg)) return [];
  if (winnerAvg <= loserAvg) return [];

  const sortedWinners = [...winners].sort((a, b) => a.rung - b.rung);
  const sortedLosers = [...losers].sort((a, b) => a.rung - b.rung);

  return [
    { name: sortedWinners[0].name, rung: sortedLosers[0].rung },
    { name: sortedWinners[1].name, rung: sortedLosers[1].rung },
    { name: sortedLosers[0].name, rung: sortedWinners[0].rung },
    { name: sortedLosers[1].name, rung: sortedWinners[1].rung },
  ];
}
