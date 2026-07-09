import { describe, it, expect } from 'vitest';
import { formatRecapAsText } from './recapText';
import type { RoundRow } from './db';

describe('formatRecapAsText', () => {
  it('includes podium and a biggest-margin highlight', () => {
    const rounds: RoundRow[] = [
      { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: [], score_a: 15, score_b: 2 },
    ];
    const leaderboard = [
      { name: 'A', wins: 1, losses: 0, pointsFor: 15, pointsAgainst: 2, gamesPlayed: 1, winPct: 1 },
      { name: 'B', wins: 1, losses: 0, pointsFor: 15, pointsAgainst: 2, gamesPlayed: 1, winPct: 1 },
      { name: 'C', wins: 0, losses: 1, pointsFor: 2, pointsAgainst: 15, gamesPlayed: 1, winPct: 0 },
    ];
    const text = formatRecapAsText(leaderboard, rounds);
    expect(text).toContain('1. A');
    expect(text).toContain('2. B');
    expect(text).toContain('Biggest win margin');
    expect(text).toContain('13');
  });
});
