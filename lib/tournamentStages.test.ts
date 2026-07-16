import { describe, it, expect } from 'vitest';
import { assertStageFullyScored } from './tournamentStages';
import type { TournamentMatchRow } from './tournamentMatches';

function match(overrides: Partial<TournamentMatchRow>): TournamentMatchRow {
  return {
    id: Math.random().toString(36),
    stage_id: 'stage-1',
    club_id: 'club-1',
    round_label: 'Round 1',
    group_label: null,
    match_order: 0,
    bracket_round: null,
    bracket_slot: null,
    team_a_id: 'a',
    team_b_id: 'b',
    winner_next_match_id: null,
    winner_next_slot: null,
    loser_next_match_id: null,
    loser_next_slot: null,
    is_bye: false,
    scheduled_at: null,
    score_a: null,
    score_b: null,
    status: 'scheduled',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('assertStageFullyScored', () => {
  it('does not throw when every non-bye match is completed', () => {
    const matches = [match({ status: 'completed', score_a: 11, score_b: 7 }), match({ status: 'completed', score_a: 5, score_b: 11 })];
    expect(() => assertStageFullyScored(matches)).not.toThrow();
  });

  it('throws when a match is still scheduled — the exact bug the code reviewer caught', () => {
    const matches = [match({ status: 'completed', score_a: 11, score_b: 7 }), match({ status: 'scheduled' })];
    expect(() => assertStageFullyScored(matches)).toThrow(/1 match.*still need/i);
  });

  it('ignores bye matches when checking completeness', () => {
    const matches = [match({ status: 'completed', score_a: 11, score_b: 7 }), match({ is_bye: true, team_b_id: null, status: 'completed' })];
    expect(() => assertStageFullyScored(matches)).not.toThrow();
  });

  it('pluralizes the error message correctly for multiple unscored matches', () => {
    const matches = [match({ status: 'scheduled' }), match({ status: 'scheduled' })];
    expect(() => assertStageFullyScored(matches)).toThrow(/2 matches.*still need/i);
  });
});
