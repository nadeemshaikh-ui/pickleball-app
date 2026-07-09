import { describe, it, expect } from 'vitest';
import { formatLeaderboardAsText } from './leaderboardText';
import type { PlayerStats } from './analytics';

describe('formatLeaderboardAsText', () => {
  const leaderboard: PlayerStats[] = [
    { name: 'A', wins: 3, losses: 1, pointsFor: 45, pointsAgainst: 30, gamesPlayed: 4, winPct: 0.75 },
    { name: 'B', wins: 2, losses: 2, pointsFor: 40, pointsAgainst: 35, gamesPlayed: 4, winPct: 0.5 },
  ];

  it('lists ranked standings with W-L and points', () => {
    const text = formatLeaderboardAsText(leaderboard, 4, 24);
    expect(text).toContain('4 of 24 games played');
    expect(text).toContain('1. A — 3W 1L (45-30)');
    expect(text).toContain('2. B — 2W 2L (40-35)');
  });
});
