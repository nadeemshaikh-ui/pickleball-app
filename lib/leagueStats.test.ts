import { describe, it, expect } from 'vitest';
import { wilsonLowerBound } from './wilsonScore';

describe('wilsonLowerBound', () => {
  it('returns 0 for 0 games (no NaN, no divide-by-zero)', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it('returns 0 for a player with 0 wins', () => {
    expect(wilsonLowerBound(0, 10)).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(wilsonLowerBound(0, 10))).toBe(false);
  });

  it('is between 0 and 1 for any valid input', () => {
    for (const [w, n] of [[5, 10], [1, 1], [0, 1], [50, 50]] as const) {
      const score = wilsonLowerBound(w, n);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('ranks a high-volume solid performer above a small-sample hot streak', () => {
    // 30/40 = 75% over a real sample vs 8/10 = 80% on a tiny sample —
    // the whole point of Wilson score is the volume win here.
    const highVolume = wilsonLowerBound(30, 40);
    const smallSample = wilsonLowerBound(8, 10);
    expect(highVolume).toBeGreaterThan(smallSample);
  });

  it('is monotonically increasing in win rate for a fixed sample size', () => {
    expect(wilsonLowerBound(8, 10)).toBeGreaterThan(wilsonLowerBound(5, 10));
    expect(wilsonLowerBound(5, 10)).toBeGreaterThan(wilsonLowerBound(2, 10));
  });
});
