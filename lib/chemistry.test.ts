import { describe, it, expect } from 'vitest';
import { computeChemistryScore } from './chemistry';

describe('computeChemistryScore', () => {
  it('is positive when the duo outperforms both players\' solo form', () => {
    // Duo: 8/10 together (80%). A solo: 5/10 outside (50%). B solo: 4/10 outside (40%).
    const duo = { wins: 8, gamesPlayed: 10 };
    const playerA = { wins: 13, gamesPlayed: 20 }; // 13-8=5 solo wins / 20-10=10 solo games = 50%
    const playerB = { wins: 12, gamesPlayed: 20 }; // 12-8=4 solo wins / 10 solo games = 40%
    expect(computeChemistryScore(duo, playerA, playerB)).toBeCloseTo(0.8 - (0.5 + 0.4) / 2, 5);
  });

  it('is negative when the duo underperforms both players\' solo form', () => {
    const duo = { wins: 2, gamesPlayed: 10 };
    const playerA = { wins: 12, gamesPlayed: 20 }; // solo 10/10 = 100%
    const playerB = { wins: 12, gamesPlayed: 20 };
    expect(computeChemistryScore(duo, playerA, playerB)).toBeLessThan(0);
  });

  it('returns null when a player has no games outside the duo', () => {
    const duo = { wins: 5, gamesPlayed: 10 };
    const playerA = { wins: 5, gamesPlayed: 10 }; // all their games are with B
    const playerB = { wins: 8, gamesPlayed: 20 };
    expect(computeChemistryScore(duo, playerA, playerB)).toBeNull();
  });

  it('returns null when the duo has zero games together', () => {
    const duo = { wins: 0, gamesPlayed: 0 };
    const playerA = { wins: 5, gamesPlayed: 10 };
    const playerB = { wins: 5, gamesPlayed: 10 };
    expect(computeChemistryScore(duo, playerA, playerB)).toBeNull();
  });
});
