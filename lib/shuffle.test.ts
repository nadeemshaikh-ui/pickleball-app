import { describe, it, expect } from 'vitest';
import {
  seededRandom,
  generateScrambleSchedule,
  generateSquadRivalrySchedule,
  generateCourtBlocksSchedule,
} from './shuffle';

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
      expect(round.sittingOutCourt1).toHaveLength(2);
      expect(round.sittingOutCourt1).toEqual(round.sittingOutCourt2);
      const overlap = playing.filter(p => round.sittingOutCourt1.includes(p));
      expect(overlap).toHaveLength(0);
    }
  });

  it('balances sit-outs within 1 of each other across all rounds', () => {
    const rounds = generateScrambleSchedule(players, 12, 'seed-a');
    const sitCounts: Record<string, number> = Object.fromEntries(players.map(p => [p, 0]));
    for (const round of rounds) {
      for (const p of round.sittingOutCourt1) sitCounts[p]++;
    }
    const counts = Object.values(sitCounts);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('is deterministic for the same seed', () => {
    const a = generateScrambleSchedule(players, 12, 'seed-a');
    const b = generateScrambleSchedule(players, 12, 'seed-a');
    expect(a).toEqual(b);
  });

  it('throws if given fewer than 8 players', () => {
    expect(() => generateScrambleSchedule(['P1', 'P2'], 4, 'seed-a')).toThrow();
  });

  it('throws if given an odd number of players', () => {
    expect(() => generateScrambleSchedule([...players, 'P11'], 4, 'seed-a')).toThrow();
  });

  it('works with a different even player count (12), scaling sit-outs to 4', () => {
    const twelve = [...players, 'P11', 'P12'];
    const rounds = generateScrambleSchedule(twelve, 6, 'seed-a');
    for (const round of rounds) {
      const playing = [...round.court1.teamA, ...round.court1.teamB, ...round.court2.teamA, ...round.court2.teamB];
      expect(new Set(playing).size).toBe(8);
      expect(round.sittingOutCourt1).toHaveLength(4);
    }
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

describe('generateCourtBlocksSchedule', () => {
  const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('generates roundsPerBlock * blockCount total rounds', () => {
    const { rounds } = generateCourtBlocksSchedule(players, 6, 2, 'seed-c');
    expect(rounds).toHaveLength(12);
  });

  it('keeps each court group fixed for the whole block', () => {
    const { assignments, rounds } = generateCourtBlocksSchedule(players, 6, 2, 'seed-c');
    const block1Rounds = rounds.slice(0, 6);
    const groupA = new Set(assignments[0].courtA);
    for (const round of block1Rounds) {
      const court1Players = [...round.court1.teamA, ...round.court1.teamB, ...round.sittingOutCourt1];
      expect(new Set(court1Players)).toEqual(groupA);
    }
  });

  it('sitting-out differs independently per court (unlike Scramble/Squad)', () => {
    const { rounds } = generateCourtBlocksSchedule(players, 6, 2, 'seed-c');
    const differingRound = rounds.find(r => JSON.stringify(r.sittingOutCourt1) !== JSON.stringify(r.sittingOutCourt2));
    expect(differingRound).toBeDefined();
  });

  it('accepts manual block assignments instead of auto-splitting', () => {
    const manual = [
      { courtA: ['P1', 'P2', 'P3', 'P4', 'P5'], courtB: ['P6', 'P7', 'P8', 'P9', 'P10'] },
      { courtA: ['P6', 'P7', 'P8', 'P9', 'P10'], courtB: ['P1', 'P2', 'P3', 'P4', 'P5'] },
    ];
    const { assignments } = generateCourtBlocksSchedule(players, 6, 2, 'seed-c', manual);
    expect(assignments).toEqual(manual);
  });

  it('throws if manual assignments count does not match blockCount', () => {
    const manual = [{ courtA: ['P1', 'P2', 'P3', 'P4', 'P5'], courtB: ['P6', 'P7', 'P8', 'P9', 'P10'] }];
    expect(() => generateCourtBlocksSchedule(players, 6, 2, 'seed-c', manual)).toThrow();
  });

  it('is deterministic for the same seed (auto mode)', () => {
    const a = generateCourtBlocksSchedule(players, 6, 2, 'seed-c');
    const b = generateCourtBlocksSchedule(players, 6, 2, 'seed-c');
    expect(a).toEqual(b);
  });
});
