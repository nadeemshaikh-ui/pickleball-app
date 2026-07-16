import { describe, it, expect } from 'vitest';
import {
  generateLeagueFixtures,
  generateGroupFixtures,
  generateKnockoutFixtures,
  generatePagePlayoffFixtures,
  generateSimpleSemifinalFixtures,
} from './tournamentFixtures';

describe('generateLeagueFixtures', () => {
  it('produces a single round-robin with no group labels', () => {
    const fixtures = generateLeagueFixtures(['a', 'b', 'c', 'd']);
    expect(fixtures).toHaveLength(6);
    expect(fixtures.every(f => f.groupLabel === null)).toBe(true);
  });
});

describe('generateGroupFixtures', () => {
  it('splits into groups and round-robins within each, tagging groupLabel', () => {
    const teams = Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}` }));
    const fixtures = generateGroupFixtures(teams, { groupCount: 2, doubleHeader: false });
    // 2 groups of 4 -> 6 matches each = 12 total
    expect(fixtures).toHaveLength(12);
    const labels = new Set(fixtures.map(f => f.groupLabel));
    expect(labels).toEqual(new Set(['Group A', 'Group B']));
    // no team plays a team from the other group
    const groupOf = new Map<string, string>();
    for (const f of fixtures) {
      groupOf.set(f.teamAId!, f.groupLabel!);
      groupOf.set(f.teamBId!, f.groupLabel!);
    }
    for (const f of fixtures) {
      expect(groupOf.get(f.teamAId!)).toBe(f.groupLabel);
      expect(groupOf.get(f.teamBId!)).toBe(f.groupLabel);
    }
  });
});

describe('generateKnockoutFixtures', () => {
  it('builds all rounds for a full power-of-2 bracket with correct forward-wiring', () => {
    const teams = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const fixtures = generateKnockoutFixtures(teams);
    // 4 teams -> round1 (2 matches) + final (1 match) = 3
    expect(fixtures).toHaveLength(3);
    const round1 = fixtures.filter(f => f.bracketRound === 1);
    const final = fixtures.find(f => f.roundLabel === 'Final')!;
    expect(round1).toHaveLength(2);
    expect(round1.every(f => !f.isBye)).toBe(true);
    // both round-1 matches should feed the single final match
    const finalOrdinal = fixtures.indexOf(final);
    expect(round1[0].winnerNextMatchOrdinal).toBe(finalOrdinal);
    expect(round1[1].winnerNextMatchOrdinal).toBe(finalOrdinal);
    expect(round1[0].winnerNextSlot).toBe('a');
    expect(round1[1].winnerNextSlot).toBe('b');
  });

  it('marks byes and still wires them forward for a non-power-of-2 count', () => {
    const teams = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; // -> bracket size 4
    const fixtures = generateKnockoutFixtures(teams);
    expect(fixtures).toHaveLength(3); // round1 (2 matches, 1 a bye) + final
    const byeMatch = fixtures.find(f => f.isBye)!;
    expect(byeMatch).toBeDefined();
    expect(byeMatch.teamAId === null || byeMatch.teamBId === null).toBe(true);
    expect(byeMatch.teamAId ?? byeMatch.teamBId).not.toBeNull();
  });

  it('throws for fewer than 2 teams', () => {
    expect(() => generateKnockoutFixtures([{ id: 'a' }])).toThrow();
  });
});

describe('generatePagePlayoffFixtures', () => {
  it('builds the fixed 4-match Qualifier/Eliminator/Final structure', () => {
    const fixtures = generatePagePlayoffFixtures(['s1', 's2', 's3', 's4']);
    expect(fixtures.map(f => f.roundLabel)).toEqual(['Qualifier 1', 'Eliminator', 'Qualifier 2', 'Final']);
    const q1 = fixtures[0];
    const elim = fixtures[1];
    const q2 = fixtures[2];
    const final = fixtures[3];
    expect(q1.teamAId).toBe('s1');
    expect(q1.teamBId).toBe('s2');
    expect(elim.teamAId).toBe('s3');
    expect(elim.teamBId).toBe('s4');
    // Q1 winner -> Final(a), Q1 loser -> Q2(a)
    expect(q1.winnerNextMatchOrdinal).toBe(fixtures.indexOf(final));
    expect(q1.loserNextMatchOrdinal).toBe(fixtures.indexOf(q2));
    // Eliminator winner -> Q2(b), loser eliminated (no loserNext)
    expect(elim.winnerNextMatchOrdinal).toBe(fixtures.indexOf(q2));
    expect(elim.loserNextMatchOrdinal).toBeNull();
    // Q2 winner -> Final(b)
    expect(q2.winnerNextMatchOrdinal).toBe(fixtures.indexOf(final));
    expect(final.winnerNextMatchOrdinal).toBeNull();
  });

  it('throws unless exactly 4 teams', () => {
    // @ts-expect-error intentional wrong-arity call to verify runtime guard
    expect(() => generatePagePlayoffFixtures(['a', 'b', 'c'])).toThrow();
  });
});

describe('generateSimpleSemifinalFixtures', () => {
  it('builds 1v4/2v3 semis feeding a single Final, no 2nd-chance bracket', () => {
    const fixtures = generateSimpleSemifinalFixtures(['s1', 's2', 's3', 's4']);
    expect(fixtures.map(f => f.roundLabel)).toEqual(['Semifinal 1', 'Semifinal 2', 'Final']);
    const [sf1, sf2, final] = fixtures;
    expect(sf1.teamAId).toBe('s1');
    expect(sf1.teamBId).toBe('s4');
    expect(sf2.teamAId).toBe('s2');
    expect(sf2.teamBId).toBe('s3');
    expect(sf1.winnerNextMatchOrdinal).toBe(2);
    expect(sf2.winnerNextMatchOrdinal).toBe(2);
    expect(sf1.loserNextMatchOrdinal).toBeNull();
    expect(sf2.loserNextMatchOrdinal).toBeNull();
    expect(final.winnerNextMatchOrdinal).toBeNull();
  });

  it('throws unless exactly 4 teams', () => {
    // @ts-expect-error intentional wrong-arity call to verify runtime guard
    expect(() => generateSimpleSemifinalFixtures(['a', 'b'])).toThrow();
  });
});
