import { describe, it, expect } from 'vitest';
import { drawMysteryPairs } from './mysteryPartner';

describe('drawMysteryPairs', () => {
  it('pairs an even pool with every player appearing exactly once', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
    const pairs = drawMysteryPairs(pool);
    expect(pairs).toHaveLength(3);
    const allPlayers = pairs.flatMap(p => p.players);
    expect(allPlayers.sort()).toEqual([...pool].sort());
    expect(new Set(allPlayers).size).toBe(pool.length); // nobody paired twice
  });

  it('sits out the named bye player for an odd pool and pairs everyone else', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    const pairs = drawMysteryPairs(pool, 'e');
    expect(pairs).toHaveLength(2);
    const allPlayers = pairs.flatMap(p => p.players);
    expect(allPlayers).not.toContain('e');
    expect(allPlayers.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('throws for an odd pool with no bye player named', () => {
    expect(() => drawMysteryPairs(['a', 'b', 'c'])).toThrow(/odd number/i);
  });

  it('throws if the named bye player is not in the pool', () => {
    expect(() => drawMysteryPairs(['a', 'b', 'c'], 'z')).toThrow(/bye player must be part of the pool/i);
  });

  it('throws for fewer than 2 pairable players', () => {
    expect(() => drawMysteryPairs(['a'])).toThrow();
    expect(() => drawMysteryPairs(['a', 'b'], 'a')).toThrow(); // bye leaves only 1
  });

  it('produces a different pairing across repeated draws (statistically, not deterministic)', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(JSON.stringify(drawMysteryPairs(pool)));
    }
    expect(results.size).toBeGreaterThan(1); // extremely unlikely to collide 20x if truly random
  });
});
