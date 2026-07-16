import { describe, it, expect } from 'vitest';
import { computeBracketSize, standardSeedOrder, seedKnockoutBracket } from './tournamentBracket';

describe('computeBracketSize', () => {
  it('rounds up to the next power of 2', () => {
    expect(computeBracketSize(2)).toBe(2);
    expect(computeBracketSize(3)).toBe(4);
    expect(computeBracketSize(4)).toBe(4);
    expect(computeBracketSize(5)).toBe(8);
    expect(computeBracketSize(6)).toBe(8);
    expect(computeBracketSize(8)).toBe(8);
    expect(computeBracketSize(9)).toBe(16);
  });

  it('throws for fewer than 2 teams', () => {
    expect(() => computeBracketSize(1)).toThrow();
    expect(() => computeBracketSize(0)).toThrow();
  });
});

describe('standardSeedOrder', () => {
  it('produces the canonical order for size 2, 4, 8', () => {
    expect(standardSeedOrder(2)).toEqual([1, 2]);
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('throws for a non-power-of-2 size', () => {
    expect(() => standardSeedOrder(6)).toThrow();
    expect(() => standardSeedOrder(1)).toThrow();
  });
});

describe('seedKnockoutBracket', () => {
  it('seeds a full power-of-2 bracket with no byes', () => {
    const teams = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const slots = seedKnockoutBracket(teams);
    expect(slots).toHaveLength(4);
    expect(slots.every(s => !s.isBye)).toBe(true);
    // seed 1 (a) faces seed 4 (d), seed 2 (b) faces seed 3 (c), per the size-4 order [1,4,2,3]
    expect(slots.map(s => s.teamId)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('gives byes to the lowest seeds when team count is not a power of 2', () => {
    const teams = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; // 3 teams -> bracket size 4
    const slots = seedKnockoutBracket(teams);
    expect(slots).toHaveLength(4);
    const byes = slots.filter(s => s.isBye);
    expect(byes).toHaveLength(1);
    // size-4 order is [1,4,2,3]; seed 4 doesn't exist -> that slot is the bye
    expect(slots.find(s => s.seed === 4)!.isBye).toBe(true);
    expect(slots.find(s => s.seed === 1)!.teamId).toBe('a');
  });

  it('throws for fewer than 2 teams', () => {
    expect(() => seedKnockoutBracket([{ id: 'a' }])).toThrow();
  });
});
