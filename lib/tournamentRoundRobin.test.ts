import { describe, it, expect } from 'vitest';
import { generateRoundRobinFixtures, assignTeamsToGroups, groupLabelFor } from './tournamentRoundRobin';

describe('generateRoundRobinFixtures', () => {
  it('generates n*(n-1)/2 matches for an even team count, each team playing every other exactly once', () => {
    const teams = ['a', 'b', 'c', 'd'];
    const fixtures = generateRoundRobinFixtures(teams);
    expect(fixtures).toHaveLength(6); // 4*3/2

    const playCounts = new Map<string, number>();
    const pairsSeen = new Set<string>();
    for (const f of fixtures) {
      playCounts.set(f.teamAId!, (playCounts.get(f.teamAId!) ?? 0) + 1);
      playCounts.set(f.teamBId!, (playCounts.get(f.teamBId!) ?? 0) + 1);
      pairsSeen.add([f.teamAId, f.teamBId].sort().join('|'));
    }
    for (const t of teams) expect(playCounts.get(t)).toBe(3); // plays every other team once
    expect(pairsSeen.size).toBe(6); // no duplicate pairings
  });

  it('handles an odd team count via a bye rotation with no bye match rows', () => {
    const teams = ['a', 'b', 'c'];
    const fixtures = generateRoundRobinFixtures(teams);
    expect(fixtures).toHaveLength(3); // 3*2/2
    expect(fixtures.every(f => f.teamAId !== null && f.teamBId !== null)).toBe(true);
    const playCounts = new Map<string, number>();
    for (const f of fixtures) {
      playCounts.set(f.teamAId!, (playCounts.get(f.teamAId!) ?? 0) + 1);
      playCounts.set(f.teamBId!, (playCounts.get(f.teamBId!) ?? 0) + 1);
    }
    for (const t of teams) expect(playCounts.get(t)).toBe(2);
  });

  it('doubles every fixture as two legs when doubleHeader is set', () => {
    const teams = ['a', 'b', 'c', 'd'];
    const fixtures = generateRoundRobinFixtures(teams, { doubleHeader: true });
    expect(fixtures).toHaveLength(12); // 6 pairings * 2 legs
    const leg2 = fixtures.filter(f => f.roundLabel.includes('Leg 2'));
    expect(leg2).toHaveLength(6);
  });

  it('throws for fewer than 2 teams', () => {
    expect(() => generateRoundRobinFixtures(['a'])).toThrow();
  });
});

describe('assignTeamsToGroups', () => {
  it('distributes teams into balanced groups via snake draft', () => {
    const teams = Array.from({ length: 9 }, (_, i) => ({ id: `t${i + 1}` }));
    const groups = assignTeamsToGroups(teams, 3);
    expect(Object.keys(groups)).toEqual(['Group A', 'Group B', 'Group C']);
    expect(groups['Group A']).toEqual(['t1', 't6', 't7']);
    expect(groups['Group B']).toEqual(['t2', 't5', 't8']);
    expect(groups['Group C']).toEqual(['t3', 't4', 't9']);
  });

  it('handles uneven group sizes (differ by at most 1)', () => {
    const teams = Array.from({ length: 7 }, (_, i) => ({ id: `t${i + 1}` }));
    const groups = assignTeamsToGroups(teams, 3);
    const sizes = Object.values(groups).map(g => g.length).sort();
    expect(sizes).toEqual([2, 2, 3]);
  });

  it('throws when there are fewer teams than groups', () => {
    expect(() => assignTeamsToGroups([{ id: 'a' }], 2)).toThrow();
  });
});

describe('groupLabelFor', () => {
  it('labels groups A, B, C...', () => {
    expect(groupLabelFor(0)).toBe('Group A');
    expect(groupLabelFor(1)).toBe('Group B');
    expect(groupLabelFor(25)).toBe('Group Z');
  });
});
