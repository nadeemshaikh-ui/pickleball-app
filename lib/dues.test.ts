import { describe, it, expect } from 'vitest';
import { computeDuesSplit } from './duesSplit';

describe('computeDuesSplit', () => {
  it('splits total cost evenly across players', () => {
    const split = computeDuesSplit(800, 200, ['A', 'B', 'C', 'D']);
    expect(split).toEqual([
      { name: 'A', amount: 250 },
      { name: 'B', amount: 250 },
      { name: 'C', amount: 250 },
      { name: 'D', amount: 250 },
    ]);
  });

  it('rounds to the nearest rupee', () => {
    const split = computeDuesSplit(1000, 200, ['A', 'B', 'C']);
    // 1200 / 3 = 400 exactly
    expect(split.every(s => s.amount === 400)).toBe(true);
  });

  it('returns empty for no players', () => {
    expect(computeDuesSplit(500, 200, [])).toEqual([]);
  });
});
