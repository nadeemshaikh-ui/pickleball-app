// Wilson score lower bound (95% CI) — the standard confidence-adjusted
// win-rate ranking (same idea Reddit/most sports leaderboards use). Rewards
// both volume and rate: a high-volume solid performer correctly outranks a
// small-sample hot streak, which raw win% alone would get wrong. Kept in
// its own file, dependency-free, so it can be unit tested without needing
// Supabase env vars configured.
export function wilsonLowerBound(wins: number, games: number, z = 1.96): number {
  if (games === 0) return 0;
  const phat = wins / games;
  const denom = 1 + (z * z) / games;
  const centre = phat + (z * z) / (2 * games);
  const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * games)) / games);
  return (centre - margin) / denom;
}
