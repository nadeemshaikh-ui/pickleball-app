// Fixed ELO bands, not percentile — promotion is earned by performance,
// never lost just because other players joined or improved.
export interface FlightBand {
  name: string;
  minRating: number;
}

export const FLIGHT_BANDS: FlightBand[] = [
  { name: 'Bronze', minRating: 0 },
  { name: 'Silver', minRating: 1400 },
  { name: 'Gold', minRating: 1600 },
  { name: 'Platinum', minRating: 1800 },
];

export function flightForRating(elo: number): string {
  let current = FLIGHT_BANDS[0].name;
  for (const band of FLIGHT_BANDS) {
    if (elo >= band.minRating) current = band.name;
  }
  return current;
}

export function flightRank(flight: string): number {
  return FLIGHT_BANDS.findIndex(b => b.name === flight);
}
