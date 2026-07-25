import { describe, it, expect } from 'vitest';
import { splitIntoNSquadsRespectingLocks, generateSquadRivalryScheduleN } from './squads';
import { generateSquadRivalrySchedule, seededRandom } from './shuffle';

// NOTE on "equivalence at N=2": the new generator consumes one extra
// seeded-random draw per round (shuffling the 2-element squad-id list
// before pairing them, via the same pairIntoPairs primitive used for
// player pairing) that the old 2-squad-only generator never did. So the
// exact seeded sequence — which specific players land on which team —
// will NOT be byte-identical to the old function's output at the same
// seed, even though both are equally "fair." What must hold, and is
// tested below, is STRUCTURAL equivalence: same match/court/sit-out
// counts, gold always plays black every round (never a squad-level bye
// at N=2), same fairness guarantees. Byte-identical seeded output was
// never a real product requirement — nothing depends on the literal
// random sequence being stable across a schedule-generator rewrite,
// only on "regenerate with the same seed gives the same result" within
// one version, which N=2 still satisfies on its own.

function makePlayers(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i}`);
}

describe('splitIntoNSquadsRespectingLocks', () => {
  it.each([2, 3, 4, 5])('splits into N=%i squads balanced within 1 player, covering every player exactly once', n => {
    const players = makePlayers(17); // deliberately not evenly divisible by most of these
    const rand = seededRandom('seed-a');
    const squads = splitIntoNSquadsRespectingLocks(players, n, [], rand);
    expect(squads).toHaveLength(n);
    const sizes = squads.map(s => s.players.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

    const allAssigned = squads.flatMap(s => s.players);
    expect(new Set(allAssigned).size).toBe(players.length); // no duplicates
    expect(allAssigned).toHaveLength(players.length); // no one dropped
    for (const p of players) expect(allAssigned).toContain(p);
  });

  it('keeps every locked pair on the same squad across N=2..5', () => {
    const players = makePlayers(20);
    const lockedPairs: [string, string][] = [
      ['p0', 'p1'],
      ['p2', 'p3'],
    ];
    for (const n of [2, 3, 4, 5]) {
      const rand = seededRandom(`lock-seed-${n}`);
      const squads = splitIntoNSquadsRespectingLocks(players, n, lockedPairs, rand);
      for (const [a, b] of lockedPairs) {
        const squadOfA = squads.find(s => s.players.includes(a));
        const squadOfB = squads.find(s => s.players.includes(b));
        expect(squadOfA?.id).toBe(squadOfB?.id);
      }
    }
  });

  it('squads[0]/squads[1] always get the stable ids gold/black; squads beyond 2 get a plain generated id', () => {
    const rand = seededRandom('ids');
    const squads = splitIntoNSquadsRespectingLocks(makePlayers(15), 4, [], rand);
    expect(squads[0].id).toBe('gold');
    expect(squads[1].id).toBe('black');
    expect(squads[2].id).toBe('squad3');
    expect(squads[3].id).toBe('squad4');
  });
});

describe('generateSquadRivalryScheduleN', () => {
  it('rejects fewer than 2 squads', () => {
    expect(() => generateSquadRivalryScheduleN(makePlayers(8), 1, 1, 3, 'x')).toThrow(/at least 2 squads/);
  });

  it('no longer throws for a requested court count below 1 — self-heals to 1 court', () => {
    const { courtCount } = generateSquadRivalryScheduleN(makePlayers(8), 2, 0, 3, 'x');
    expect(courtCount).toBe(1);
  });

  it('N=2 structural equivalence: every round is gold-vs-black, squads never sit out a whole round, and match/sit-out counts match the old 2-squad generator for the same inputs', () => {
    const players = makePlayers(12);
    const courtCount = 2;
    const roundCount = 6;
    const seed = 'equiv-seed';

    const oldSchedule = generateSquadRivalrySchedule(players, courtCount, roundCount, seed);
    const newSchedule = generateSquadRivalryScheduleN(players, 2, courtCount, roundCount, seed);

    expect(newSchedule.squads).toHaveLength(2);
    expect(newSchedule.squads[0].id).toBe('gold');
    expect(newSchedule.squads[1].id).toBe('black');
    expect(newSchedule.rounds).toHaveLength(oldSchedule.rounds.length);

    for (let i = 0; i < roundCount; i++) {
      const oldRound = oldSchedule.rounds[i];
      const newRound = newSchedule.rounds[i];
      expect(newRound.courts).toHaveLength(oldRound.courts.length); // same court count every round
      expect(newRound.sittingOutPerCourt[0]?.length ?? 0).toBe(oldRound.sittingOutPerCourt[0]?.length ?? 0); // same sit-out count

      // Every court is gold-vs-black, never gold-vs-gold or a squad-level bye.
      const goldSet = new Set(newSchedule.squads[0].players);
      const blackSet = new Set(newSchedule.squads[1].players);
      for (const court of newRound.courts) {
        const aIsGold = court.teamA.every(p => goldSet.has(p));
        const bIsGold = court.teamB.every(p => goldSet.has(p));
        const aIsBlack = court.teamA.every(p => blackSet.has(p));
        const bIsBlack = court.teamB.every(p => blackSet.has(p));
        expect((aIsGold && bIsBlack) || (aIsBlack && bIsGold)).toBe(true);
      }
    }
  });

  it.each([
    { squads: 3, courts: 1, expectedCourtsUsed: 1 },
    // 3 squads can only ever form 1 disjoint pair (never 2), but that one
    // pairing gets BOTH courts (each squad fields 2 doubles teams) rather
    // than leaving the 2nd court idle — courtsPerMatchup scaling.
    { squads: 3, courts: 2, expectedCourtsUsed: 2 },
    { squads: 4, courts: 2, expectedCourtsUsed: 2 },
    { squads: 5, courts: 2, expectedCourtsUsed: 2 },
  ])('N=$squads squads, $courts requested court(s) → uses exactly $expectedCourtsUsed court(s) per round (courtsPerMatchup gives every court to whichever squad-pairs are actually playing)', ({ squads, courts, expectedCourtsUsed }) => {
    const players = makePlayers(squads * 6); // plenty of players per squad
    const schedule = generateSquadRivalryScheduleN(players, squads, courts, 4, `cap-${squads}-${courts}`);
    for (const round of schedule.rounds) {
      expect(round.courts).toHaveLength(expectedCourtsUsed);
    }
  });

  it('max consecutive whole-squad byes is at most 1, for N=3 and N=5 across many rounds', () => {
    for (const n of [3, 5]) {
      const players = makePlayers(n * 6);
      const schedule = generateSquadRivalryScheduleN(players, n, 2, 20, `bye-${n}`);
      const squadIds = schedule.squads.map(s => s.id);
      const goldSquadPlayers = new Map(schedule.squads.map(s => [s.id, new Set(s.players)]));

      // Reconstruct which squads actually played each round from the courts.
      const consecutiveByes = new Map(squadIds.map(id => [id, 0]));
      for (const round of schedule.rounds) {
        const playedThisRound = new Set<string>();
        for (const court of round.courts) {
          for (const [id, playerSet] of goldSquadPlayers) {
            if (court.teamA.every(p => playerSet.has(p)) || court.teamB.every(p => playerSet.has(p))) {
              playedThisRound.add(id);
            }
          }
        }
        for (const id of squadIds) {
          if (playedThisRound.has(id)) {
            consecutiveByes.set(id, 0);
          } else {
            const next = (consecutiveByes.get(id) ?? 0) + 1;
            consecutiveByes.set(id, next);
            expect(next).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('every player belongs to exactly one squad (disjoint + complete membership invariant)', () => {
    const players = makePlayers(23);
    for (const n of [2, 3, 4, 5]) {
      const schedule = generateSquadRivalryScheduleN(players, n, 1, 2, `disjoint-${n}`);
      const allPlayers = schedule.squads.flatMap(s => s.players);
      expect(new Set(allPlayers).size).toBe(players.length);
      expect(allPlayers).toHaveLength(players.length);
    }
  });

  it('rejects manual squads with the wrong count, missing/duplicate players, or an imbalance greater than 1', () => {
    const players = makePlayers(9);
    expect(() =>
      generateSquadRivalryScheduleN(players, 3, 1, 2, 'manual', [], [
        { id: 'a', players: players.slice(0, 3) },
        { id: 'b', players: players.slice(3, 6) },
      ])
    ).toThrow(/Expected 3 manual squads/);

    expect(() =>
      generateSquadRivalryScheduleN(players, 3, 1, 2, 'manual', [], [
        { id: 'a', players: players.slice(0, 3) },
        { id: 'b', players: players.slice(3, 6) },
        { id: 'c', players: [players[6]] }, // missing 2 players
      ])
    ).toThrow(/every player exactly once/);

    expect(() =>
      generateSquadRivalryScheduleN(players, 3, 1, 2, 'manual', [], [
        { id: 'a', players: players.slice(0, 5) },
        { id: 'b', players: players.slice(5, 7) },
        { id: 'c', players: players.slice(7, 9) },
      ])
    ).toThrow(/balanced within 1/);
  });

  it('keeps locked pairs together as a playing/sitting unit across rounds, for N=3+, and every round respects it', () => {
    const players = makePlayers(24); // 8 per squad at N=3
    const lockedPairs: [string, string][] = [
      ['p0', 'p1'],
      ['p10', 'p11'],
    ];
    const schedule = generateSquadRivalryScheduleN(players, 3, 2, 10, 'locked-n3', lockedPairs);

    for (const [a, b] of lockedPairs) {
      const squadOfA = schedule.squads.find(s => s.players.includes(a));
      expect(squadOfA?.players).toContain(b); // same squad, checked once at split time
    }

    for (const round of schedule.rounds) {
      const sitOut = new Set(round.sittingOutPerCourt[0] ?? []);
      for (const [a, b] of lockedPairs) {
        // Never split: both sit out together, or both play together (never one playing without the other).
        const aOut = sitOut.has(a);
        const bOut = sitOut.has(b);
        expect(aOut).toBe(bOut);
        if (!aOut) {
          // If playing, they must be on the same team (never opposing each other or split across courts).
          const teamOfA = round.courts.find(c => c.teamA.includes(a) || c.teamB.includes(a));
          expect(teamOfA?.teamA.includes(b) || teamOfA?.teamB.includes(b)).toBe(true);
        }
      }
    }
  });

  it('individual sit-out selection never repeats a player back-to-back when no squad-level bye is involved (N=4, no squad ever sits a whole round)', () => {
    // N=4 squads, 4 courts -> maxSimultaneousPairs=min(4,2)=2,
    // courtsPerMatchup=2, requiredPerSquad=4 -> individual sitOutCount=2 of
    // 6 per squad (33%, comfortable headroom) -> squadSitOutCount=0
    // always: every squad plays every round, so this isolates
    // individual-level repeat-avoidance from the squad-level bye
    // interaction entirely (see the N=3 case below for why that
    // interaction makes some repeats mathematically unavoidable there).
    // A too-high individual sit-out rate (e.g. benching more than half a
    // squad each round) forces repeats for the same reason pickSitOuts
    // already would in the pre-existing 2-squad code — not new to N-squad,
    // so this test deliberately picks a config with real headroom instead.
    const players = makePlayers(24); // 6 per squad
    const schedule = generateSquadRivalryScheduleN(players, 4, 4, 15, 'no-repeat-n4');
    const lastSatOut = new Map<string, boolean>();
    for (const round of schedule.rounds) {
      const sitOut = new Set(round.sittingOutPerCourt[0] ?? []);
      for (const p of players) {
        const isOut = sitOut.has(p);
        expect(Boolean(isOut && lastSatOut.get(p))).toBe(false);
        lastSatOut.set(p, isOut);
      }
    }
  });

  it('playerSitCounts stay balanced across a session even with squad-level byes mixed in (N=3, one squad always benched)', () => {
    // N=3 squads, 2 courts -> squadSitOutCount=1 every round (3 squads can
    // only ever form 1 disjoint pair) — a much tighter squeeze than N=4.
    // Individual back-to-back repeats ARE mathematically unavoidable in
    // two specific transitions here and are NOT asserted against: (a) a
    // squad returns from a whole-round bye where 100% of its players are
    // flagged "sat out last round," and still needs >0 individual
    // sit-outs that round — some must repeat, no algorithm can avoid it;
    // (b) a player individually sits one round, then their whole squad
    // (independently, via the separate squad-level rotation) is selected
    // for the next round's bye — same unavoidable overlap in reverse. With
    // exactly 1-of-3 squads benched every single round in this config,
    // one of these two transitions touches most players most rounds, so a
    // strict "no player repeats" assertion would be asserting an
    // impossible property, not testing real code. What the sitCounts fix
    // actually guarantees, and what's real to test, is that total
    // sit-outs stay balanced across the whole session despite this churn.
    const players = makePlayers(21);
    const schedule = generateSquadRivalryScheduleN(players, 3, 2, 15, 'balance-n3');
    const totalSitOuts = new Map(players.map(p => [p, 0]));
    for (const round of schedule.rounds) {
      for (const p of round.sittingOutPerCourt[0] ?? []) totalSitOuts.set(p, totalSitOuts.get(p)! + 1);
    }
    const counts = [...totalSitOuts.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it('throws a clear error when a squad has too few players for the courts-per-matchup requirement', () => {
    // 13 players / 3 squads → resolveCourtCount(13, 4) clamps to 3 courts
    // (floor(13/4)), but 3 squads can only ever field 1 simultaneous
    // matchup, so that lone matchup gets all 3 courts (courtsPerMatchup=3,
    // needs 6 players/squad) — the smallest squad (4, from a 5/4/4 split)
    // can't supply that even though the total player count "fits" 3 courts
    // overall. Still a genuine infeasibility, distinct from Item 1's
    // resolveCourtCount fix (which only smooths the total-player-count
    // case, not this per-squad-vs-courts-per-matchup one).
    expect(() => generateSquadRivalryScheduleN(makePlayers(13), 3, 4, 2, 'toofew')).toThrow(/needs at least 6 players/);
  });
});
