// Standard ELO expected-score formula, doubles-adapted: each side's rating
// is the average of its two players. Margin-of-victory scales the update
// (a 15-2 blowout should move ratings more than a 15-13 nail-biter) but is
// capped so one lopsided game can't swing things wildly.
const BASE_K = 32;
const MAX_MARGIN_MULTIPLIER = 1.5;

export function marginMultiplier(marginAbs: number): number {
  return Math.min(MAX_MARGIN_MULTIPLIER, 1 + Math.log(Math.max(1, marginAbs)) / 10);
}

export function expectedScore(ownRating: number, oppRating: number): number {
  return 1 / (1 + Math.pow(10, (oppRating - ownRating) / 400));
}

// Rating delta for one team in a doubles match. `ownRating`/`oppRating` are
// each side's average (or a single player's rating for singles-style use).
// Returns the same delta for both players on a team — they won or lost
// together.
export function eloDelta(ownRating: number, oppRating: number, won: boolean, marginAbs: number): number {
  if (won) {
    const expected = expectedScore(ownRating, oppRating);
    const rawDelta = BASE_K * marginMultiplier(marginAbs) * (1 - expected);
    return Math.max(1, Math.round(rawDelta));
  } else {
    // Loser delta is the exact inverse of opponent's win delta to preserve zero-sum rating equilibrium
    const oppExpected = expectedScore(oppRating, ownRating);
    const oppRawDelta = BASE_K * marginMultiplier(marginAbs) * (1 - oppExpected);
    const oppWinDelta = Math.max(1, Math.round(oppRawDelta));
    return -oppWinDelta;
  }
}
