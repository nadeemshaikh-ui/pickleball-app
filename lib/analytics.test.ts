import { describe, it, expect } from 'vitest';
import { computeLeaderboard, computeSquadTotals } from './analytics';
import type { RoundRow } from './db';

describe('computeLeaderboard', () => {
  const rounds: RoundRow[] = [
    { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: [], score_a: 15, score_b: 10 },
    { id: '2', session_id: 's', round_number: 2, court: 1, team_a: ['A', 'C'], team_b: ['B', 'D'], sitting_out: [], score_a: 12, score_b: 15 },
  ];

  it('counts wins, losses, and points for each player across rounds', () => {
    const board = computeLeaderboard(rounds);
    const a = board.find(p => p.name === 'A')!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.pointsFor).toBe(27);
    expect(a.pointsAgainst).toBe(25);
  });

  it('ignores rounds with null scores (not yet played)', () => {
    const withPending: RoundRow[] = [
      ...rounds,
      { id: '3', session_id: 's', round_number: 3, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: [], score_a: null, score_b: null },
    ];
    const board = computeLeaderboard(withPending);
    const a = board.find(p => p.name === 'A')!;
    expect(a.wins + a.losses).toBe(2);
  });

  it('sorts by wins descending, tiebreak by point differential descending', () => {
    const board = computeLeaderboard(rounds);
    for (let i = 1; i < board.length; i++) {
      const prev = board[i - 1];
      const curr = board[i];
      const prevDiff = prev.pointsFor - prev.pointsAgainst;
      const currDiff = curr.pointsFor - curr.pointsAgainst;
      expect(prev.wins > curr.wins || (prev.wins === curr.wins && prevDiff >= currDiff)).toBe(true);
    }
  });
});

describe('computeSquadTotals', () => {
  it('sums points for each squad across all rounds', () => {
    const rounds: RoundRow[] = [
      { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['G1', 'G2'], team_b: ['B1', 'B2'], sitting_out: [], score_a: 15, score_b: 10 },
      { id: '2', session_id: 's', round_number: 1, court: 2, team_a: ['G3', 'G4'], team_b: ['B3', 'B4'], sitting_out: [], score_a: 10, score_b: 15 },
    ];
    const squads = { gold: ['G1', 'G2', 'G3', 'G4', 'G5'], black: ['B1', 'B2', 'B3', 'B4', 'B5'] };
    const totals = computeSquadTotals(rounds, squads);
    expect(totals.gold).toBe(25);
    expect(totals.black).toBe(25);
  });
});
