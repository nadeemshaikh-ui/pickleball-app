import { seededRandom, shuffleArray, type CourtMatch } from './shuffle';

// King of the Court: court 1 is the top. Each round, the WINNING side of
// court K rises to court K-1, the LOSING side drops to court K+1. Court K's
// next-round occupants are therefore the losing side that dropped from
// court K-1, plus the winning side that rose from court K+1. Court 1's
// winner has nowhere to rise to, so it stays and defends; the bottom
// court's loser has nowhere to drop to, so it also stays. Every side ends
// up in exactly one court next round — no queue/bench, this only works
// for exactly 4 x courtCount players (v1 scope).
//
// Fixed-pairs mode keeps each side's two players together as they move.
// Rotating mode dissolves pairing on arrival — the four players landing on
// a court (two from the side that rose, two from the side that dropped)
// get freshly repaired, so who partners whom changes round to round even
// though the underlying movement rule is identical.

export interface ScoredCourt {
  court: number;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number;
  scoreB: number;
}

export function generateInitialKingOfCourtRound(
  players: string[],
  courtCount: number,
  seed: string,
  fixedPairs: boolean
): CourtMatch[] {
  void fixedPairs; // round 1 has no prior pairing to preserve or dissolve — random either way
  const rand = seededRandom(seed);
  const shuffled = shuffleArray(players, rand);
  const courts: CourtMatch[] = [];
  for (let c = 0; c < courtCount; c++) {
    const four = shuffled.slice(c * 4, c * 4 + 4);
    courts.push({ teamA: [four[0], four[1]], teamB: [four[2], four[3]] });
  }
  return courts;
}

export function computeNextKingOfCourtRound(
  previousCourts: ScoredCourt[],
  fixedPairs: boolean,
  seed: string
): CourtMatch[] {
  const sorted = [...previousCourts].sort((a, b) => a.court - b.court);
  const courtCount = sorted.length;
  const rand = seededRandom(seed);

  function winnerOf(c: ScoredCourt): [string, string] {
    return c.scoreA > c.scoreB ? c.teamA : c.teamB;
  }
  function loserOf(c: ScoredCourt): [string, string] {
    return c.scoreA > c.scoreB ? c.teamB : c.teamA;
  }

  if (courtCount === 1) {
    // No court to rise or drop to — same matchup runs back.
    return [{ teamA: sorted[0].teamA, teamB: sorted[0].teamB }];
  }

  return sorted.map((court, i) => {
    const isTop = i === 0;
    const isBottom = i === courtCount - 1;
    // isTop: no court above to drop from, so this court's own winner stays.
    // isBottom: no court below to rise from, so this court's own loser stays.
    const sideA = isTop ? winnerOf(court) : loserOf(sorted[i - 1]);
    const sideB = isBottom ? loserOf(court) : winnerOf(sorted[i + 1]);

    if (fixedPairs) {
      return { teamA: sideA, teamB: sideB };
    }
    const four = shuffleArray([...sideA, ...sideB], rand);
    return { teamA: [four[0], four[1]], teamB: [four[2], four[3]] };
  });
}
