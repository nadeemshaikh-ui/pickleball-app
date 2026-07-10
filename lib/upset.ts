import { flightForRating, flightRank } from './flights';

export interface UpsetResult {
  winnerFlight: string;
  loserFlight: string;
}

// Side rating = average of the two teammates' elo. An upset is a lower-flight
// side beating a higher-flight side — same-flight or expected wins return null.
export function detectUpset(winnerRatings: [number, number], loserRatings: [number, number]): UpsetResult | null {
  const winnerFlight = flightForRating((winnerRatings[0] + winnerRatings[1]) / 2);
  const loserFlight = flightForRating((loserRatings[0] + loserRatings[1]) / 2);
  if (flightRank(winnerFlight) >= flightRank(loserFlight)) return null;
  return { winnerFlight, loserFlight };
}
