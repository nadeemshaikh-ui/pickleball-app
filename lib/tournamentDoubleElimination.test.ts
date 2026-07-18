import { describe, it, expect } from 'vitest';
import { generateDoubleEliminationFixtures } from './tournamentFixtures';

// Simulates the same propagation logic advance_tournament_match runs in
// Postgres (winner -> winnerNextMatchOrdinal, loser -> loserNextMatchOrdinal),
// purely client-side, to prove the fixture wiring is structurally correct
// before it ever touches real DB rows. `winners` picks team A for every
// match, deterministic and sufficient for structural checks.
function simulate(teamIds: string[]) {
  const fixtures = generateDoubleEliminationFixtures(teamIds.map(id => ({ id })));
  const teamA: (string | null)[] = fixtures.map(f => f.teamAId);
  const teamB: (string | null)[] = fixtures.map(f => f.teamBId);
  const winner: (string | null)[] = fixtures.map(() => null);

  // Matches must be resolved in an order where both teams are already
  // known — matchOrder already guarantees this (every match's feeders have
  // a strictly smaller ordinal), so a single forward pass suffices.
  for (let i = 0; i < fixtures.length; i++) {
    const a = teamA[i];
    const b = teamB[i];
    if (a === null || b === null) throw new Error(`Match ${i} (${fixtures[i].roundLabel}) never got both teams filled in — a === ${a}, b === ${b}`);
    const w = a; // team A always wins, deterministic
    const l = b;
    winner[i] = w;

    const f = fixtures[i];
    if (f.winnerNextMatchOrdinal !== null) {
      if (f.winnerNextSlot === 'a') teamA[f.winnerNextMatchOrdinal] = w;
      else teamB[f.winnerNextMatchOrdinal] = w;
    }
    if (f.loserNextMatchOrdinal !== null) {
      if (f.loserNextSlot === 'a') teamA[f.loserNextMatchOrdinal] = l;
      else teamB[f.loserNextMatchOrdinal] = l;
    }
  }

  return { fixtures, winner, teamA, teamB };
}

describe('generateDoubleEliminationFixtures', () => {
  it('rejects team counts that are not an exact power of 2', () => {
    expect(() => generateDoubleEliminationFixtures([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toThrow(/power-of-2/);
    expect(() => generateDoubleEliminationFixtures([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }])).toThrow(/power-of-2/);
  });

  it.each([4, 8, 16])('produces 2n-2 total matches for n=%i teams (n-1 winners bracket + n-1 losers/grand-final)', n => {
    const teamIds = Array.from({ length: n }, (_, i) => `t${i}`);
    const { fixtures } = simulate(teamIds);
    expect(fixtures).toHaveLength(2 * n - 2);
    expect(fixtures.filter(f => f.groupLabel === 'Winners Bracket')).toHaveLength(n - 1);
    expect(fixtures.filter(f => f.groupLabel === 'Grand Final')).toHaveLength(1);
    expect(fixtures.filter(f => f.groupLabel === 'Losers Bracket')).toHaveLength(n - 2);
  });

  it('never leaves a losers-bracket or grand-final match with a missing team once the whole bracket resolves (n=8)', () => {
    const teamIds = Array.from({ length: 8 }, (_, i) => `t${i}`);
    // Throws inside simulate() if any match is missing a team when its turn comes — the assertion IS that this doesn't throw.
    expect(() => simulate(teamIds)).not.toThrow();
  });

  it('every team appears in round 1 exactly once, and the grand final is the only match with no winnerNextMatchOrdinal (i.e. the true final)', () => {
    const teamIds = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const { fixtures } = simulate(teamIds);
    const round1 = fixtures.filter(f => f.groupLabel === 'Winners Bracket' && f.roundLabel === 'Winners Round 1');
    const round1Teams = round1.flatMap(f => [f.teamAId, f.teamBId]);
    expect(new Set(round1Teams).size).toBe(8);
    for (const id of teamIds) expect(round1Teams).toContain(id);

    const noNextWinner = fixtures.filter(f => f.winnerNextMatchOrdinal === null);
    expect(noNextWinner).toHaveLength(1);
    expect(noNextWinner[0].roundLabel).toBe('Grand Final');
  });

  it('a team that loses its very first match survives via the losers bracket instead of vanishing (n=8)', () => {
    // Team A always wins in simulate(), so t1 (loses round 1 to t0) must
    // reappear as teamA or teamB in some later losers-bracket match.
    const teamIds = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const { fixtures, teamA, teamB } = simulate(teamIds);
    const lbIndexes = fixtures.map((f, i) => (f.groupLabel === 'Losers Bracket' ? i : -1)).filter(i => i !== -1);
    const appearsInLB = lbIndexes.some(i => teamA[i] === 't1' || teamB[i] === 't1');
    expect(appearsInLB).toBe(true);
  });

  it('grand final is contested by the winners-bracket champion and the losers-bracket champion (n=4)', () => {
    const teamIds = ['t0', 't1', 't2', 't3'];
    const { fixtures, winner, teamA, teamB } = simulate(teamIds);
    const gfIdx = fixtures.findIndex(f => f.groupLabel === 'Grand Final');
    const wbFinalIdx = fixtures.findIndex(f => f.roundLabel === 'Winners Final');
    const lbFinalIdx = fixtures.findIndex(f => f.roundLabel === 'Losers Final');
    expect(winner[wbFinalIdx]).toBe(teamA[gfIdx]);
    expect(winner[lbFinalIdx]).toBe(teamB[gfIdx]);
  });
});
