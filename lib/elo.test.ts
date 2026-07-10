import { describe, it, expect } from 'vitest';
import { eloDelta, expectedScore, marginMultiplier } from './elo';

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
  });

  it('is higher for the higher-rated side', () => {
    expect(expectedScore(1600, 1400)).toBeGreaterThan(0.5);
    expect(expectedScore(1400, 1600)).toBeLessThan(0.5);
  });
});

describe('marginMultiplier', () => {
  it('is 1 for a 1-point margin', () => {
    expect(marginMultiplier(1)).toBeCloseTo(1, 1);
  });

  it('increases with margin but stays capped', () => {
    const small = marginMultiplier(2);
    const big = marginMultiplier(13);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThanOrEqual(1.5);
  });
});

describe('eloDelta', () => {
  it('is positive for an underdog win, negative for a favorite loss', () => {
    expect(eloDelta(1400, 1600, true, 5)).toBeGreaterThan(0);
    expect(eloDelta(1600, 1400, false, 5)).toBeLessThan(0);
  });

  it('gives a bigger swing for a blowout than a nail-biter, same result', () => {
    const blowout = Math.abs(eloDelta(1500, 1500, true, 13));
    const nailBiter = Math.abs(eloDelta(1500, 1500, true, 1));
    expect(blowout).toBeGreaterThan(nailBiter);
  });

  it('is symmetric: winner gain roughly equals loser loss for equal ratings', () => {
    const winnerGain = eloDelta(1500, 1500, true, 5);
    const loserLoss = eloDelta(1500, 1500, false, 5);
    expect(winnerGain).toBe(-loserLoss);
  });
});
