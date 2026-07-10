import { describe, it, expect } from 'vitest';
import { sideRung, isValidLadderChallenge, applyLadderMovement, LADDER_CHALLENGE_RANGE, type LadderPlayer } from './ladder';

describe('sideRung', () => {
  it('averages the two rungs', () => {
    expect(sideRung([2, 4])).toBe(3);
    expect(sideRung([1, 2])).toBe(1.5);
  });
});

describe('isValidLadderChallenge', () => {
  it('accepts sides within the challenge range', () => {
    expect(isValidLadderChallenge(5, 5)).toBe(true);
    expect(isValidLadderChallenge(5, 5 + LADDER_CHALLENGE_RANGE)).toBe(true);
    expect(isValidLadderChallenge(5, 5 - LADDER_CHALLENGE_RANGE)).toBe(true);
  });

  it('rejects sides outside the challenge range', () => {
    expect(isValidLadderChallenge(5, 5 + LADDER_CHALLENGE_RANGE + 0.5)).toBe(false);
  });

  it('is symmetric', () => {
    expect(isValidLadderChallenge(8, 3)).toBe(isValidLadderChallenge(3, 8));
  });
});

describe('applyLadderMovement', () => {
  it('does nothing when the better-ranked side wins', () => {
    const winners: [LadderPlayer, LadderPlayer] = [{ name: 'A', rung: 1 }, { name: 'B', rung: 2 }];
    const losers: [LadderPlayer, LadderPlayer] = [{ name: 'C', rung: 3 }, { name: 'D', rung: 4 }];
    expect(applyLadderMovement(winners, losers)).toEqual([]);
  });

  it('does nothing on an exact tie in average rung', () => {
    const winners: [LadderPlayer, LadderPlayer] = [{ name: 'A', rung: 2 }, { name: 'B', rung: 4 }];
    const losers: [LadderPlayer, LadderPlayer] = [{ name: 'C', rung: 1 }, { name: 'D', rung: 5 }];
    expect(applyLadderMovement(winners, losers)).toEqual([]);
  });

  it('swaps rungs pairwise, better-vs-better, on an in-range upset', () => {
    const winners: [LadderPlayer, LadderPlayer] = [{ name: 'A', rung: 4 }, { name: 'B', rung: 5 }];
    const losers: [LadderPlayer, LadderPlayer] = [{ name: 'C', rung: 1 }, { name: 'D', rung: 2 }];
    // winnerAvg=4.5, loserAvg=1.5, gap=3 — exactly at LADDER_CHALLENGE_RANGE, still valid.
    const changes = applyLadderMovement(winners, losers);
    expect(changes).toEqual(
      expect.arrayContaining([
        { name: 'A', rung: 1 },
        { name: 'B', rung: 2 },
        { name: 'C', rung: 4 },
        { name: 'D', rung: 5 },
      ])
    );
    expect(changes).toHaveLength(4);
  });

  it('does nothing when sides are outside the challenge range, even on an upset', () => {
    const winners: [LadderPlayer, LadderPlayer] = [{ name: 'A', rung: 8 }, { name: 'B', rung: 9 }];
    const losers: [LadderPlayer, LadderPlayer] = [{ name: 'C', rung: 1 }, { name: 'D', rung: 2 }];
    // winnerAvg=8.5, loserAvg=1.5, gap=7 > LADDER_CHALLENGE_RANGE — not a valid challenge.
    expect(applyLadderMovement(winners, losers)).toEqual([]);
  });

  it('handles an interleaved upset (winner ranks straddle loser ranks)', () => {
    const winners: [LadderPlayer, LadderPlayer] = [{ name: 'A', rung: 2 }, { name: 'B', rung: 8 }];
    const losers: [LadderPlayer, LadderPlayer] = [{ name: 'C', rung: 3 }, { name: 'D', rung: 4 }];
    // winnerAvg = 5, loserAvg = 3.5 — winners were worse-ranked on average, upset applies.
    const changes = applyLadderMovement(winners, losers);
    expect(changes).toEqual(
      expect.arrayContaining([
        { name: 'A', rung: 3 },
        { name: 'B', rung: 4 },
        { name: 'C', rung: 2 },
        { name: 'D', rung: 8 },
      ])
    );
  });
});
