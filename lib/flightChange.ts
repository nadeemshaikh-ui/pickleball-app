import { flightForRating, flightRank } from './flights';

export interface FlightChange {
  direction: 'promoted' | 'relegated';
  flight: string;
}

// Compares a player's flight before/after an ELO update — promotion is
// earned only by crossing a band threshold this round, same-flight rating
// movement is not a change.
export function detectFlightChange(beforeElo: number, afterElo: number): FlightChange | null {
  const before = flightForRating(beforeElo);
  const after = flightForRating(afterElo);
  if (before === after) return null;
  return { direction: flightRank(after) > flightRank(before) ? 'promoted' : 'relegated', flight: after };
}
