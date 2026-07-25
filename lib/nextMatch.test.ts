import { describe, it, expect } from 'vitest';
import { pickCourtScorer, newPlayersOnCourt } from './nextMatch';

describe('pickCourtScorer', () => {
  const teamA: [string, string] = ['A1', 'A2'];
  const teamB: [string, string] = ['B1', 'B2'];
  const onCourt = new Set([...teamA, ...teamB]);

  it('always returns a player who is actually on that court', () => {
    for (let round = 1; round <= 12; round++) {
      expect(onCourt.has(pickCourtScorer(teamA, teamB, round))).toBe(true);
    }
  });

  it('is stable — same inputs, same output', () => {
    expect(pickCourtScorer(teamA, teamB, 5)).toBe(pickCourtScorer(teamA, teamB, 5));
  });

  it('rotates across rounds', () => {
    const picks = new Set(Array.from({ length: 4 }, (_, i) => pickCourtScorer(teamA, teamB, i + 1)));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('restricts to designated scorers who are on this court', () => {
    for (let round = 1; round <= 8; round++) {
      const scorer = pickCourtScorer(teamA, teamB, round, ['A2', 'B1', 'SomeoneElseNotOnCourt']);
      expect(['A2', 'B1']).toContain(scorer);
    }
  });

  it('falls back to the full court when no designated scorer is on this court', () => {
    const scorer = pickCourtScorer(teamA, teamB, 1, ['SomeoneElseNotOnCourt']);
    expect(onCourt.has(scorer)).toBe(true);
  });
});

describe('newPlayersOnCourt', () => {
  it('treats everyone as new when there is no previous round (e.g. round 1)', () => {
    const result = newPlayersOnCourt(['A', 'B', 'C', 'D'], null);
    expect([...result].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('only flags players who were not on this court last round', () => {
    const result = newPlayersOnCourt(['A', 'B', 'E', 'F'], ['A', 'B', 'C', 'D']);
    expect([...result].sort()).toEqual(['E', 'F']);
  });

  it('returns an empty set when the same four players stay on the court', () => {
    const result = newPlayersOnCourt(['A', 'B', 'C', 'D'], ['D', 'C', 'B', 'A']);
    expect(result.size).toBe(0);
  });
});
