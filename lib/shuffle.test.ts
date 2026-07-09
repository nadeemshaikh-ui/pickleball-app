import { describe, it, expect } from 'vitest';
import { seededRandom, generateScrambleSchedule, generateSquadRivalrySchedule } from './shuffle';

describe('seededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRandom('session-123');
    const b = seededRandom('session-123');
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = seededRandom('session-123');
    const b = seededRandom('session-456');
    expect(a()).not.toEqual(b());
  });
});

describe('generateScrambleSchedule', () => {
  const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('generates the requested number of rounds', () => {
    const rounds = generateScrambleSchedule(players, 12, 'seed-a');
    expect(rounds).toHaveLength(12);
  });

  it('each round has exactly 8 unique playing players and 2 sitting out, no overlap', () => {
    const rounds = generateScrambleSchedule(players, 12, 'seed-a');
    for (const round of rounds) {
      const playing = [...round.court1.teamA, ...round.court1.teamB, ...round.court2.teamA, ...round.court2.teamB];
      expect(new Set(playing).size).toBe(8);
      expect(round.sittingOut).toHaveLength(2);
      const overlap = playing.filter(p => round.sittingOut.includes(p));
      expect(overlap).toHaveLength(0);
    }
  });

  it('balances sit-outs within 1 of each other across all rounds', () => {
    const rounds = generateScrambleSchedule(players, 12, 'seed-a');
    const sitCounts: Record<string, number> = Object.fromEntries(players.map(p => [p, 0]));
    for (const round of rounds) {
      for (const p of round.sittingOut) sitCounts[p]++;
    }
    const counts = Object.values(sitCounts);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('is deterministic for the same seed', () => {
    const a = generateScrambleSchedule(players, 12, 'seed-a');
    const b = generateScrambleSchedule(players, 12, 'seed-a');
    expect(a).toEqual(b);
  });

  it('throws if given fewer than 10 players', () => {
    expect(() => generateScrambleSchedule(['P1', 'P2'], 4, 'seed-a')).toThrow();
  });
});

describe('generateSquadRivalrySchedule', () => {
  const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('splits players into two squads of 5', () => {
    const { squads } = generateSquadRivalrySchedule(players, 12, 'seed-b');
    expect(squads.gold).toHaveLength(5);
    expect(squads.black).toHaveLength(5);
    const all = [...squads.gold, ...squads.black];
    expect(new Set(all).size).toBe(10);
  });

  it('every court match is gold vs black, never same-squad', () => {
    const { squads, rounds } = generateSquadRivalrySchedule(players, 12, 'seed-b');
    const goldSet = new Set(squads.gold);
    for (const round of rounds) {
      for (const court of [round.court1, round.court2]) {
        const teamAIsGold = court.teamA.every(p => goldSet.has(p));
        const teamBIsGold = court.teamB.every(p => goldSet.has(p));
        expect(teamAIsGold).not.toBe(teamBIsGold);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateSquadRivalrySchedule(players, 12, 'seed-b');
    const b = generateSquadRivalrySchedule(players, 12, 'seed-b');
    expect(a).toEqual(b);
  });
});
