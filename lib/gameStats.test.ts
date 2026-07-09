import { describe, it, expect } from 'vitest';
import {
  findClosestGame,
  findBiggestBlowout,
  computeBestPartnership,
  computeLongestWinStreak,
  computeSessionTotals,
} from './gameStats';
import type { RoundRow } from './db';

const rounds: RoundRow[] = [
  { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: [], score_a: 15, score_b: 14 },
  { id: '2', session_id: 's', round_number: 1, court: 2, team_a: ['E', 'F'], team_b: ['G', 'H'], sitting_out: [], score_a: 15, score_b: 2 },
  { id: '3', session_id: 's', round_number: 2, court: 1, team_a: ['A', 'B'], team_b: ['E', 'F'], sitting_out: [], score_a: 15, score_b: 10 },
  { id: '4', session_id: 's', round_number: 2, court: 2, team_a: ['C', 'D'], team_b: ['G', 'H'], sitting_out: [], score_a: null, score_b: null },
];

describe('findClosestGame', () => {
  it('finds the round with the smallest score difference among scored rounds', () => {
    const closest = findClosestGame(rounds);
    expect(closest?.id).toBe('1');
  });

  it('returns null when no rounds are scored', () => {
    expect(findClosestGame([])).toBeNull();
  });
});

describe('findBiggestBlowout', () => {
  it('finds the round with the largest score difference', () => {
    const blowout = findBiggestBlowout(rounds);
    expect(blowout?.id).toBe('2');
  });
});

describe('computeBestPartnership', () => {
  it('finds the pair with the best win rate (min 1 game together)', () => {
    const best = computeBestPartnership(rounds);
    expect(best?.players.sort()).toEqual(['A', 'B']);
    expect(best?.wins).toBe(2);
    expect(best?.gamesPlayed).toBe(2);
  });
});

describe('computeLongestWinStreak', () => {
  it('finds the player with the longest consecutive win streak across their own games', () => {
    const best = computeLongestWinStreak(rounds);
    expect(best?.streak).toBeGreaterThanOrEqual(2);
  });
});

describe('computeSessionTotals', () => {
  it('sums total points scored and total games completed', () => {
    const totals = computeSessionTotals(rounds);
    expect(totals.totalGames).toBe(3);
    expect(totals.totalPoints).toBe(15 + 14 + 15 + 2 + 15 + 10);
  });
});
