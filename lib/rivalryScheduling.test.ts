import { describe, it, expect } from 'vitest';
import { seededRandom, buildRivalryHeatMap, assignCourtsByRivalry, generateScrambleSchedule, type RivalryHeat } from './shuffle';

describe('buildRivalryHeatMap', () => {
  it('keys by unordered pair and excludes provisional (not-enough-games) rivalries', () => {
    const map = buildRivalryHeatMap([
      { players: ['Alice', 'Bob'], record: [6, 4], gamesTogether: 10, provisional: false },
      { players: ['Carl', 'Dev'], record: [1, 0], gamesTogether: 1, provisional: true },
    ]);
    expect(map.get('Alice|Bob')).toEqual({ gap: 2, games: 10 });
    expect(map.has('Carl|Dev')).toBe(false);
  });
});

describe('assignCourtsByRivalry', () => {
  it('pairs teams with the hottest (smallest-gap) rivalry onto the same court', () => {
    const teams: [string, string][] = [
      ['A', 'B'],
      ['C', 'D'],
      ['E', 'F'],
      ['G', 'H'],
    ];
    // C-A is dead even (gap 0) — the hottest rivalry present. Everything
    // else has no data. Regardless of shuffle order, court 1 should end up
    // as A&B vs C&D (the only matchup with a real rivalry in it).
    const heatMap = new Map<string, RivalryHeat>([['A|C', { gap: 0, games: 8 }]]);
    const courts = assignCourtsByRivalry(teams, heatMap, 2, seededRandom('seed-1'));
    expect(courts).toHaveLength(2);
    const allPlayers = courts.flatMap(c => [...c.teamA, ...c.teamB]);
    expect(new Set(allPlayers).size).toBe(8);
    const hasRivalryMatchup = courts.some(
      c => (c.teamA.includes('A') && c.teamB.includes('C')) || (c.teamB.includes('A') && c.teamA.includes('C'))
    );
    expect(hasRivalryMatchup).toBe(true);
  });

  it('falls back to a valid (still random) assignment when no rivalry data applies', () => {
    const teams: [string, string][] = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const courts = assignCourtsByRivalry(teams, new Map(), 1, seededRandom('seed-2'));
    expect(courts).toHaveLength(1);
    const allPlayers = [...courts[0].teamA, ...courts[0].teamB];
    expect(new Set(allPlayers).size).toBe(4);
  });
});

describe('generateScrambleSchedule — rivalry-aware', () => {
  const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  it('rejects combining rivalry-aware with skill-balanced', () => {
    expect(() =>
      generateScrambleSchedule(players, 2, 1, 'seed', [], new Map(players.map(p => [p, 1500])), new Map())
    ).toThrow(/cannot be combined/);
  });

  it('still produces a valid schedule (every existing invariant intact) when rivalry-aware is on', () => {
    const heatMap = buildRivalryHeatMap([{ players: ['A', 'E'], record: [3, 3], gamesTogether: 6, provisional: false }]);
    const rounds = generateScrambleSchedule(players, 2, 4, 'seed-riv', [], undefined, heatMap);
    expect(rounds).toHaveLength(4);
    for (const round of rounds) {
      const playing = round.courts.flatMap(c => [...c.teamA, ...c.teamB]);
      expect(new Set(playing).size).toBe(8); // courtCount*4, no overlap, no dupes
      expect(playing.length).toBe(8);
    }
  });

  it('is deterministic for the same seed', () => {
    const heatMap = buildRivalryHeatMap([{ players: ['A', 'E'], record: [3, 3], gamesTogether: 6, provisional: false }]);
    const a = generateScrambleSchedule(players, 2, 3, 'same-seed', [], undefined, heatMap);
    const b = generateScrambleSchedule(players, 2, 3, 'same-seed', [], undefined, heatMap);
    expect(a).toEqual(b);
  });
});
