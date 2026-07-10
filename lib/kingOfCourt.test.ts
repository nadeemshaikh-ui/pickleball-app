import { describe, it, expect } from 'vitest';
import { generateInitialKingOfCourtRound, computeNextKingOfCourtRound, type ScoredCourt } from './kingOfCourt';

describe('generateInitialKingOfCourtRound', () => {
  it('assigns every player to exactly one court', () => {
    const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const courts = generateInitialKingOfCourtRound(players, 2, 'seed1', true);
    expect(courts).toHaveLength(2);
    const allPlayers = courts.flatMap(c => [...c.teamA, ...c.teamB]);
    expect(new Set(allPlayers).size).toBe(8);
    expect(allPlayers.sort()).toEqual([...players].sort());
  });

  it('is deterministic for a given seed', () => {
    const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const a = generateInitialKingOfCourtRound(players, 2, 'same-seed', true);
    const b = generateInitialKingOfCourtRound(players, 2, 'same-seed', true);
    expect(a).toEqual(b);
  });
});

describe('computeNextKingOfCourtRound — fixed pairs', () => {
  it('single court: same matchup runs back, nobody to move to', () => {
    const prev: ScoredCourt[] = [{ court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'], scoreA: 15, scoreB: 10 }];
    const next = computeNextKingOfCourtRound(prev, true, 'seed');
    expect(next).toEqual([{ teamA: ['A', 'B'], teamB: ['C', 'D'] }]);
  });

  it('top court winner defends, bottom court loser stays, everyone accounted for exactly once', () => {
    const prev: ScoredCourt[] = [
      { court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'], scoreA: 15, scoreB: 10 }, // A&B win court 1
      { court: 2, teamA: ['E', 'F'], teamB: ['G', 'H'], scoreA: 8, scoreB: 15 }, // G&H win court 2
    ];
    const next = computeNextKingOfCourtRound(prev, true, 'seed');
    expect(next).toHaveLength(2);
    // Court 1 (top): winner A&B stays, G&H rises from court 2.
    expect(next[0]).toEqual({ teamA: ['A', 'B'], teamB: ['G', 'H'] });
    // Court 2 (bottom): C&D drops from court 1, loser E&F stays.
    expect(next[1]).toEqual({ teamA: ['C', 'D'], teamB: ['E', 'F'] });

    const allPlayers = next.flatMap(c => [...c.teamA, ...c.teamB]);
    expect(new Set(allPlayers).size).toBe(8);
    expect(allPlayers.sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('three courts: middle court receives a dropper from above and a riser from below', () => {
    const prev: ScoredCourt[] = [
      { court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'], scoreA: 15, scoreB: 5 }, // A&B win (top)
      { court: 2, teamA: ['E', 'F'], teamB: ['G', 'H'], scoreA: 15, scoreB: 5 }, // E&F win (middle)
      { court: 3, teamA: ['I', 'J'], teamB: ['K', 'L'], scoreA: 5, scoreB: 15 }, // K&L win (bottom)
    ];
    const next = computeNextKingOfCourtRound(prev, true, 'seed');
    expect(next[0]).toEqual({ teamA: ['A', 'B'], teamB: ['E', 'F'] }); // top: winner stays + riser from court 2
    expect(next[1]).toEqual({ teamA: ['C', 'D'], teamB: ['K', 'L'] }); // middle: dropper from court 1 + riser from court 3
    expect(next[2]).toEqual({ teamA: ['G', 'H'], teamB: ['I', 'J'] }); // bottom: dropper from court 2 + loser stays

    const allPlayers = next.flatMap(c => [...c.teamA, ...c.teamB]);
    expect(new Set(allPlayers).size).toBe(12);
  });
});

describe('computeNextKingOfCourtRound — rotating partners', () => {
  it('still moves the correct 4 players to each court, but re-pairs on arrival', () => {
    const prev: ScoredCourt[] = [
      { court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'], scoreA: 15, scoreB: 10 },
      { court: 2, teamA: ['E', 'F'], teamB: ['G', 'H'], scoreA: 8, scoreB: 15 },
    ];
    const next = computeNextKingOfCourtRound(prev, false, 'seed');
    // Court 1 should contain exactly {A, B, G, H} (winner-stays + riser), just not necessarily paired as A&B vs G&H.
    const court1Players = new Set([...next[0].teamA, ...next[0].teamB]);
    expect(court1Players).toEqual(new Set(['A', 'B', 'G', 'H']));
    const court2Players = new Set([...next[1].teamA, ...next[1].teamB]);
    expect(court2Players).toEqual(new Set(['C', 'D', 'E', 'F']));
  });

  it('is deterministic for a given seed', () => {
    const prev: ScoredCourt[] = [
      { court: 1, teamA: ['A', 'B'], teamB: ['C', 'D'], scoreA: 15, scoreB: 10 },
      { court: 2, teamA: ['E', 'F'], teamB: ['G', 'H'], scoreA: 8, scoreB: 15 },
    ];
    const a = computeNextKingOfCourtRound(prev, false, 'same-seed');
    const b = computeNextKingOfCourtRound(prev, false, 'same-seed');
    expect(a).toEqual(b);
  });
});
