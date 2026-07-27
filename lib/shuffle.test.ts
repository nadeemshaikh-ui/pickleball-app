import { describe, it, expect } from 'vitest';
import {
  seededRandom,
  generateScrambleSchedule,
  generateSquadRivalrySchedule,
  generateCourtBlocksSchedule,
  generateFixedPartnersSchedule,
  resolveCourtCount,
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

  it('no longer throws if requested courtCount is less than 1 — self-heals to 1 court', () => {
    const rounds = generateScrambleSchedule(players10, 0, 4, 'seed-a');
    expect(rounds.courtCount).toBe(1);
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

  it('no longer throws for an odd total player count — squads split 6/5 instead', () => {
    const { squads, courtCount } = generateSquadRivalrySchedule(['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11'], 2, 4, 'seed-b');
    const sizes = [squads.gold.length, squads.black.length].sort((a, b) => a - b);
    expect(sizes).toEqual([5, 6]);
    expect(courtCount).toBe(2);
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

  it('rejects locked pairs (not yet supported)', () => {
    const players10 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
    expect(() =>
      generateCourtBlocksSchedule(players10, 2, 6, 2, 'seed-c', undefined, [['P1', 'P2']])
    ).toThrow(/not yet supported/);
  });
});

describe('locked pairs — Scramble', () => {
  const players10 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('keeps a locked pair together as a team whenever both are playing', () => {
    const rounds = generateScrambleSchedule(players10, 2, 12, 'seed-lock', [['P1', 'P2']]);
    for (const round of rounds) {
      for (const court of round.courts) {
        const aHasP1 = court.teamA.includes('P1');
        const aHasP2 = court.teamA.includes('P2');
        const bHasP1 = court.teamB.includes('P1');
        const bHasP2 = court.teamB.includes('P2');
        if (aHasP1 || aHasP2) expect(aHasP1).toBe(aHasP2);
        if (bHasP1 || bHasP2) expect(bHasP1).toBe(bHasP2);
      }
    }
  });

  it('never splits a locked pair between playing and sitting out', () => {
    const rounds = generateScrambleSchedule(players10, 2, 12, 'seed-lock', [['P1', 'P2']]);
    for (const round of rounds) {
      const sittingOut = round.sittingOutPerCourt[0];
      const p1Sitting = sittingOut.includes('P1');
      const p2Sitting = sittingOut.includes('P2');
      expect(p1Sitting).toBe(p2Sitting);
    }
  });

  it('rejects a player appearing in more than one locked pair', () => {
    expect(() =>
      generateScrambleSchedule(players10, 2, 12, 'seed-lock', [
        ['P1', 'P2'],
        ['P1', 'P3'],
      ])
    ).toThrow(/more than one locked pair/);
  });

  it('rejects a locked pair referencing a player not in the roster', () => {
    expect(() => generateScrambleSchedule(players10, 2, 12, 'seed-lock', [['P1', 'Ghost']])).toThrow(/not in the roster/);
  });
});

describe('locked pairs — Squad Rivalry', () => {
  const players10 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('keeps a locked pair on the same squad', () => {
    const { squads } = generateSquadRivalrySchedule(players10, 2, 12, 'seed-lock', [['P1', 'P2']]);
    const p1InGold = squads.gold.includes('P1');
    const p2InGold = squads.gold.includes('P2');
    expect(p1InGold).toBe(p2InGold);
  });

  it('keeps a locked pair together as a team whenever both are playing', () => {
    const { rounds } = generateSquadRivalrySchedule(players10, 2, 12, 'seed-lock', [['P1', 'P2']]);
    for (const round of rounds) {
      for (const court of round.courts) {
        const aHasP1 = court.teamA.includes('P1');
        const aHasP2 = court.teamA.includes('P2');
        const bHasP1 = court.teamB.includes('P1');
        const bHasP2 = court.teamB.includes('P2');
        if (aHasP1 || aHasP2) expect(aHasP1).toBe(aHasP2);
        if (bHasP1 || bHasP2) expect(bHasP1).toBe(bHasP2);
      }
    }
  });
});

describe('generateFixedPartnersSchedule', () => {
  const players10 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('no longer throws for an odd number of players — one player is benched for the whole night', () => {
    const players11 = [...players10, 'P11'];
    const { teams, rounds, courtCount } = generateFixedPartnersSchedule(players11, 2, 4, 'seed-fp');
    expect(teams).toHaveLength(5);
    expect(courtCount).toBe(2);
    const paired = new Set(teams.flat());
    expect(paired.size).toBe(10);
    const benched = players11.find(p => !paired.has(p))!;
    for (const round of rounds) {
      expect(round.sittingOutPerCourt[0]).toContain(benched);
    }
  });

  it('keeps the same partner for every round all night', () => {
    const { teams, rounds } = generateFixedPartnersSchedule(players10, 2, 12, 'seed-fp');
    const partnerOf = new Map<string, string>();
    for (const [a, b] of teams) {
      partnerOf.set(a, b);
      partnerOf.set(b, a);
    }
    for (const round of rounds) {
      for (const court of round.courts) {
        expect(partnerOf.get(court.teamA[0])).toBe(court.teamA[1]);
        expect(partnerOf.get(court.teamB[0])).toBe(court.teamB[1]);
      }
    }
  });

  it('never sits the same team out two rounds in a row', () => {
    const players = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
    const { rounds } = generateFixedPartnersSchedule(players, 2, 12, 'seed-fp');
    for (let i = 1; i < rounds.length; i++) {
      const prevPlayers = new Set(rounds[i - 1].sittingOutPerCourt[0]);
      const currPlayers = rounds[i].sittingOutPerCourt[0];
      for (const p of currPlayers) {
        expect(prevPlayers.has(p)).toBe(false);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateFixedPartnersSchedule(players10, 2, 12, 'seed-fp');
    const b = generateFixedPartnersSchedule(players10, 2, 12, 'seed-fp');
    expect(a).toEqual(b);
  });
});

describe('skill-balanced matchmaking — Scramble', () => {
  const players8 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];

  it('rejects combining skill-balance with locked pairs', () => {
    const ratings = new Map(players8.map(p => [p, 1500]));
    expect(() => generateScrambleSchedule(players8, 2, 4, 'seed-skill', [['P1', 'P2']], ratings)).toThrow(
      /cannot be combined/
    );
  });

  it('produces valid, deterministic full-court matches with an extreme rating gap (no crash)', () => {
    const ratings = new Map<string, number>([
      ['P1', 2400], ['P2', 2350], ['P3', 900], ['P4', 850],
      ['P5', 1500], ['P6', 1490], ['P7', 1510], ['P8', 1480],
    ]);
    const rounds = generateScrambleSchedule(players8, 2, 6, 'seed-skill', [], ratings);
    expect(rounds).toHaveLength(6);
    for (const round of rounds) {
      const playing = round.courts.flatMap(c => [...c.teamA, ...c.teamB]);
      expect(new Set(playing).size).toBe(8);
    }
    const again = generateScrambleSchedule(players8, 2, 6, 'seed-skill', [], ratings);
    expect(again).toEqual(rounds);
  });

  it('keeps opposing team rating sums closer together than a random split, on average', () => {
    const ratings = new Map<string, number>([
      ['P1', 2000], ['P2', 1900], ['P3', 1000], ['P4', 1100],
      ['P5', 1500], ['P6', 1550], ['P7', 1450], ['P8', 1400],
    ]);
    const rounds = generateScrambleSchedule(players8, 2, 1, 'seed-skill', [], ratings);
    for (const court of rounds[0].courts) {
      const sumA = ratings.get(court.teamA[0])! + ratings.get(court.teamA[1])!;
      const sumB = ratings.get(court.teamB[0])! + ratings.get(court.teamB[1])!;
      // Balanced pairing should never produce a court with the two
      // strongest players (2000+1900) against the two weakest (1000+1100).
      expect(Math.abs(sumA - sumB)).toBeLessThan(1800);
    }
  });
});

describe('resolveCourtCount', () => {
  it('shrinks the requested court count to what the roster can fill', () => {
    expect(resolveCourtCount(9, 3)).toBe(2);
  });

  it('never drops below 1 court', () => {
    expect(resolveCourtCount(4, 3)).toBe(1);
  });

  it('never exceeds the requested count even with plenty of players', () => {
    expect(resolveCourtCount(40, 2)).toBe(2);
  });
});

describe('graceful degradation — never fail to produce a schedule', () => {
  it('Scramble: 9 players, 3 courts requested → runs 2 courts, no throw', () => {
    const players9 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
    const rounds = generateScrambleSchedule(players9, 3, 4, 'seed-degrade');
    expect(rounds.courtCount).toBe(2);
    for (const round of rounds) {
      expect(round.courts).toHaveLength(2);
    }
  });

  it('Scramble: 4 players, 3 courts requested → runs 1 court, no throw', () => {
    const rounds = generateScrambleSchedule(['A', 'B', 'C', 'D'], 3, 4, 'seed-degrade');
    expect(rounds.courtCount).toBe(1);
    for (const round of rounds) {
      expect(round.courts).toHaveLength(1);
    }
  });

  it('Scramble: 3 players throws with a readable message', () => {
    expect(() => generateScrambleSchedule(['A', 'B', 'C'], 1, 4, 'seed-degrade')).toThrow(/at least 4 players/);
  });

  it('Squad Rivalry: 3 players throws with a readable message', () => {
    expect(() => generateSquadRivalrySchedule(['A', 'B', 'C'], 1, 4, 'seed-degrade')).toThrow(/at least 4 players/);
  });

  it('Fixed Partners: 3 players throws with a readable message', () => {
    expect(() => generateFixedPartnersSchedule(['A', 'B', 'C'], 1, 4, 'seed-degrade')).toThrow(/at least 4 players/);
  });

  it('Court Swap: 3 players throws with a readable message', () => {
    expect(() => generateCourtBlocksSchedule(['A', 'B', 'C'], 1, 4, 1, 'seed-degrade')).toThrow(/at least 4 players/);
  });

  it('Court Swap: 9 players, 3 courts requested → runs 2 courts, no throw', () => {
    const players9 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
    const { rounds, courtCount } = generateCourtBlocksSchedule(players9, 3, 2, 1, 'seed-degrade');
    expect(courtCount).toBe(2);
    for (const round of rounds) {
      expect(round.courts).toHaveLength(2);
    }
  });
});

describe('generateSquadRivalrySchedule — regeneration support (startRound/initialLedger, fixed squads)', () => {
  it('numbers rounds starting from startRound and never moves an existing squad member', () => {
    const squads = { gold: ['G1', 'G2', 'G3', 'G4'], black: ['B1', 'B2', 'B3', 'B4'] };
    const ledger = {
      goldSitCounts: new Map(squads.gold.map(p => [p, 2])),
      blackSitCounts: new Map(squads.black.map(p => [p, 2])),
      partnerCounts: new Map<string, number>(),
      lastGoldSitOut: new Set<string>(),
      lastBlackSitOut: new Set<string>(),
    };
    const { rounds, squads: outSquads } = generateSquadRivalrySchedule(
      [...squads.gold, ...squads.black], 1, 3, 'seed-regen', [], squads, 5, ledger
    );
    expect(rounds.map(r => r.roundNumber)).toEqual([5, 6, 7]);
    expect(outSquads).toEqual(squads);
    for (const round of rounds) {
      const goldOnCourt = round.courts.flatMap(c => [...c.teamA, ...c.teamB]).filter(p => squads.gold.includes(p));
      // gold vs black structure preserved — every court still has one gold, one black team
      expect(goldOnCourt.length).toBeGreaterThan(0);
    }
  });
});

describe('generateFixedPartnersSchedule — regeneration support (startRound/initialLedger, manual teams)', () => {
  it('numbers rounds starting from startRound and keeps manual teams fixed', () => {
    const teams: [string, string][] = [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G', 'H']];
    const ledger = {
      sitOutCounts: new Map(teams.map(t => [t.join('|'), 1])),
      opponentCounts: new Map<string, number>(),
      lastSitOutTeams: new Set<string>(),
    };
    const { rounds, teams: outTeams } = generateFixedPartnersSchedule(
      teams.flat(), 1, 3, 'seed-regen', teams, undefined, 8, ledger
    );
    expect(rounds.map(r => r.roundNumber)).toEqual([8, 9, 10]);
    expect(outTeams).toEqual(teams);
    for (const round of rounds) {
      for (const court of round.courts) {
        const isKnownTeam = (t: [string, string]) => teams.some(([a, b]) => (a === t[0] && b === t[1]) || (a === t[1] && b === t[0]));
        expect(isKnownTeam(court.teamA)).toBe(true);
        expect(isKnownTeam(court.teamB)).toBe(true);
      }
    }
  });
});

describe('generateCourtBlocksSchedule — regeneration support (startBlock/initialGroupTogetherCounts)', () => {
  it('numbers rounds starting from the correct round for a mid-session startBlock', () => {
    const players8 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    // roundsPerBlock=3, starting at block 3 -> first round number = (3-1)*3+1 = 7
    const { rounds } = generateCourtBlocksSchedule(players8, 2, 3, 2, 'seed-regen', undefined, [], 3);
    expect(rounds.map(r => r.roundNumber)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('is deterministic for the same seed and startBlock', () => {
    const players8 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const a = generateCourtBlocksSchedule(players8, 2, 3, 2, 'seed-regen', undefined, [], 3);
    const b = generateCourtBlocksSchedule(players8, 2, 3, 2, 'seed-regen', undefined, [], 3);
    expect(a).toEqual(b);
  });
});

describe('Time-Scoped and Round-Scoped Locked Partners', () => {
  const players = ['Vikki', 'Suresh', 'Priyesh', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];

  it('pairs Vikki with Suresh in rounds 1-6, and Vikki with Priyesh in rounds 7-12', () => {
    const lockedPairs = [
      { playerA: 'Vikki', playerB: 'Suresh', startRound: 1, endRound: 6 },
      { playerA: 'Vikki', playerB: 'Priyesh', startRound: 7, endRound: 12 },
    ];

    const rounds = generateScrambleSchedule(players, 2, 12, 'seed-scoped-locks', lockedPairs);
    expect(rounds).toHaveLength(12);

    for (const round of rounds) {
      const allCourts = round.courts;
      const isVikkiPlaying = allCourts.some(c => [...c.teamA, ...c.teamB].includes('Vikki'));

      if (isVikkiPlaying) {
        const vikkiCourt = allCourts.find(c => [...c.teamA, ...c.teamB].includes('Vikki'))!;
        const vikkiTeam = vikkiCourt.teamA.includes('Vikki') ? vikkiCourt.teamA : vikkiCourt.teamB;
        const vikkiPartner = vikkiTeam.find(p => p !== 'Vikki');

        if (round.roundNumber <= 6) {
          expect(vikkiPartner).toBe('Suresh');
        } else {
          expect(vikkiPartner).toBe('Priyesh');
        }
      }
    }
  });

  it('throws an error if a player is in two active locked pairs in the same round', () => {
    const overlappingLocks = [
      { playerA: 'Vikki', playerB: 'Suresh', startRound: 1, endRound: 6 },
      { playerA: 'Vikki', playerB: 'Priyesh', startRound: 4, endRound: 9 },
    ];

    expect(() => generateScrambleSchedule(players, 2, 12, 'seed-overlap', overlappingLocks)).toThrow(
      /appears in more than one locked pair in round 4/
    );
  });
});

