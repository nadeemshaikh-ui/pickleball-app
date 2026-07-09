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
  const players10 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('generates the requested number of rounds', () => {
    const rounds = generateScrambleSchedule(players10, 2, 12, 'seed-a');
    expect(rounds).toHaveLength(12);
  });

  it('never sits the same player out two rounds in a row', () => {
    const rounds = generateScrambleSchedule(players10, 2, 12, 'seed-a');
    for (let i = 1; i < rounds.length; i++) {
      const prevSitOut = new Set(rounds[i - 1].sittingOutPerCourt[0]);
      const currSitOut = rounds[i].sittingOutPerCourt[0];
      for (const p of currSitOut) {
        expect(prevSitOut.has(p)).toBe(false);
      }
    }
  });

  it('each round has exactly courtCount*4 unique playing players, rest sitting, no overlap', () => {
    const rounds = generateScrambleSchedule(players10, 2, 12, 'seed-a');
    for (const round of rounds) {
      expect(round.courts).toHaveLength(2);
      const playing = round.courts.flatMap(c => [...c.teamA, ...c.teamB]);
      expect(new Set(playing).size).toBe(8);
      expect(round.sittingOutPerCourt[0]).toHaveLength(2);
      expect(round.sittingOutPerCourt[0]).toEqual(round.sittingOutPerCourt[1]);
      const overlap = playing.filter(p => round.sittingOutPerCourt[0].includes(p));
      expect(overlap).toHaveLength(0);
    }
  });

  it('balances sit-outs within 1 of each other across all rounds', () => {
    const rounds = generateScrambleSchedule(players10, 2, 12, 'seed-a');
    const sitCounts: Record<string, number> = Object.fromEntries(players10.map(p => [p, 0]));
    for (const round of rounds) {
      for (const p of round.sittingOutPerCourt[0]) sitCounts[p]++;
    }
    const counts = Object.values(sitCounts);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('is deterministic for the same seed', () => {
    const a = generateScrambleSchedule(players10, 2, 12, 'seed-a');
    const b = generateScrambleSchedule(players10, 2, 12, 'seed-a');
    expect(a).toEqual(b);
  });

  it('supports a single court with exactly 4 players (no sit-outs)', () => {
    const rounds = generateScrambleSchedule(['A', 'B', 'C', 'D'], 1, 4, 'seed-a');
    expect(rounds).toHaveLength(4);
    for (const round of rounds) {
      expect(round.courts).toHaveLength(1);
      expect(round.sittingOutPerCourt[0]).toHaveLength(0);
    }
  });

  it('supports 3 courts with an odd total player count', () => {
    const players = Array.from({ length: 13 }, (_, i) => `P${i + 1}`);
    const rounds = generateScrambleSchedule(players, 3, 6, 'seed-a');
    for (const round of rounds) {
      expect(round.courts).toHaveLength(3);
      const playing = round.courts.flatMap(c => [...c.teamA, ...c.teamB]);
      expect(new Set(playing).size).toBe(12);
      expect(round.sittingOutPerCourt[0]).toHaveLength(1);
    }
  });

  it('throws if there are not enough players to fill the requested courts', () => {
    expect(() => generateScrambleSchedule(['P1', 'P2'], 1, 4, 'seed-a')).toThrow();
  });

  it('throws if courtCount is less than 1', () => {
    expect(() => generateScrambleSchedule(players10, 0, 4, 'seed-a')).toThrow();
  });
});

describe('generateSquadRivalrySchedule', () => {
  const players10 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('splits players into two equal squads', () => {
    const { squads } = generateSquadRivalrySchedule(players10, 2, 12, 'seed-b');
    expect(squads.gold).toHaveLength(5);
    expect(squads.black).toHaveLength(5);
    const all = [...squads.gold, ...squads.black];
    expect(new Set(all).size).toBe(10);
  });

  it('every court match is gold vs black, never same-squad', () => {
    const { squads, rounds } = generateSquadRivalrySchedule(players10, 2, 12, 'seed-b');
    const goldSet = new Set(squads.gold);
    for (const round of rounds) {
      for (const court of round.courts) {
        const teamAIsGold = court.teamA.every(p => goldSet.has(p));
        const teamBIsGold = court.teamB.every(p => goldSet.has(p));
        expect(teamAIsGold).not.toBe(teamBIsGold);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateSquadRivalrySchedule(players10, 2, 12, 'seed-b');
    const b = generateSquadRivalrySchedule(players10, 2, 12, 'seed-b');
    expect(a).toEqual(b);
  });

  it('throws for an odd total player count', () => {
    expect(() => generateSquadRivalrySchedule([...players10, 'P11'], 2, 4, 'seed-b')).toThrow();
  });

  it('supports a single court', () => {
    const { rounds } = generateSquadRivalrySchedule(['A', 'B', 'C', 'D'], 1, 4, 'seed-b');
    for (const round of rounds) {
      expect(round.courts).toHaveLength(1);
    }
  });
});

describe('generateCourtBlocksSchedule', () => {
  const players10 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('generates roundsPerBlock * blockCount total rounds', () => {
    const { rounds } = generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c');
    expect(rounds).toHaveLength(12);
  });

  it('keeps each court group fixed for the whole block', () => {
    const { assignments, rounds } = generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c');
    const block1Rounds = rounds.slice(0, 6);
    const group0 = new Set(assignments[0].groups[0]);
    for (const round of block1Rounds) {
      const court0Players = [...round.courts[0].teamA, ...round.courts[0].teamB, ...round.sittingOutPerCourt[0]];
      expect(new Set(court0Players)).toEqual(group0);
    }
  });

  it('sitting-out differs independently per court (unlike Scramble/Squad)', () => {
    const { rounds } = generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c');
    const differingRound = rounds.find(
      r => JSON.stringify(r.sittingOutPerCourt[0]) !== JSON.stringify(r.sittingOutPerCourt[1])
    );
    expect(differingRound).toBeDefined();
  });

  it('accepts manual block assignments instead of auto-splitting', () => {
    const manual = [
      { groups: [['P1', 'P2', 'P3', 'P4', 'P5'], ['P6', 'P7', 'P8', 'P9', 'P10']] },
      { groups: [['P6', 'P7', 'P8', 'P9', 'P10'], ['P1', 'P2', 'P3', 'P4', 'P5']] },
    ];
    const { assignments } = generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c', manual);
    expect(assignments).toEqual(manual);
  });

  it('throws if manual assignments count does not match blockCount', () => {
    const manual = [{ groups: [['P1', 'P2', 'P3', 'P4', 'P5'], ['P6', 'P7', 'P8', 'P9', 'P10']] }];
    expect(() => generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c', manual)).toThrow();
  });

  it('is deterministic for the same seed (auto mode)', () => {
    const a = generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c');
    const b = generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c');
    expect(a).toEqual(b);
  });

  it('supports 3 courts with uneven group sizes', () => {
    const players = Array.from({ length: 14 }, (_, i) => `P${i + 1}`);
    const { assignments } = generateCourtBlocksSchedule(players, 3, 4, 1, 'seed-c');
    const sizes = assignments[0].groups.map(g => g.length).sort();
    expect(sizes).toEqual([4, 5, 5]);
  });
});
