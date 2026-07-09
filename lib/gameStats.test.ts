import { describe, it, expect } from 'vitest';
import {
  findClosestGame,
  findBiggestBlowout,
  computeBestPartnership,
  computeLongestWinStreak,
  computeSessionTotals,
  computeTopScorer,
  computeSitOutChampion,
  computePerfectRecord,
  computeNailBiters,
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

  it('computes average score margin across scored games', () => {
    const totals = computeSessionTotals(rounds);
    expect(totals.averageMargin).toBeCloseTo((1 + 13 + 5) / 3);
  });
});

describe('computeTopScorer', () => {
  it('finds the player with the most total points scored', () => {
    const top = computeTopScorer(rounds);
    expect(top?.name).toBe('A');
    expect(top?.points).toBe(30);
  });
});

describe('computeSitOutChampion', () => {
  const sitOutRounds: RoundRow[] = [
    { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: ['I', 'J'], score_a: 15, score_b: 14 },
    { id: '2', session_id: 's', round_number: 1, court: 2, team_a: ['E', 'F'], team_b: ['G', 'H'], sitting_out: ['I', 'J'], score_a: 15, score_b: 2 },
    { id: '3', session_id: 's', round_number: 2, court: 1, team_a: ['A', 'C'], team_b: ['E', 'G'], sitting_out: ['J', 'K'], score_a: 10, score_b: 8 },
    { id: '4', session_id: 's', round_number: 2, court: 2, team_a: ['B', 'D'], team_b: ['F', 'H'], sitting_out: ['J', 'K'], score_a: 9, score_b: 15 },
  ];

  it('counts each player once per round even though sit-out repeats across both court rows', () => {
    const champion = computeSitOutChampion(sitOutRounds);
    expect(champion?.name).toBe('J');
    expect(champion?.count).toBe(2);
  });
});

describe('computePerfectRecord', () => {
  it('lists players with zero losses across at least one game', () => {
    const perfect = computePerfectRecord(rounds);
    const names = perfect.map(p => p.name).sort();
    expect(names).toEqual(['A', 'B']);
  });
});

describe('computeNailBiters', () => {
  it('counts scored games decided by 2 points or fewer', () => {
    expect(computeNailBiters(rounds)).toBe(1);
  });
});
