import { describe, it, expect } from 'vitest';
import { computeStandings, computeIndividualStandings } from './tournamentStandings';
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
    team_a_id: null,
    team_b_id: null,
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

describe('computeStandings', () => {
  const teams = [
    { id: 'a', seed: 1 },
    { id: 'b', seed: 2 },
    { id: 'c', seed: 3 },
  ];

  it('computes played/won/lost/points from completed matches only', () => {
    const matches = [
      match({ team_a_id: 'a', team_b_id: 'b', score_a: 11, score_b: 7, status: 'completed' }),
      match({ team_a_id: 'a', team_b_id: 'c', score_a: 9, score_b: 11, status: 'completed' }),
      match({ team_a_id: 'b', team_b_id: 'c', score_a: 11, score_b: 5, status: 'scheduled' }), // not yet played, excluded
    ];
    const standings = computeStandings(matches, teams);
    const a = standings.find(s => s.teamId === 'a')!;
    expect(a.played).toBe(2);
    expect(a.won).toBe(1);
    expect(a.lost).toBe(1);
    expect(a.points).toBe(2); // 1 win * 2 points

    const b = standings.find(s => s.teamId === 'b')!;
    expect(b.played).toBe(1); // the scheduled match against c doesn't count yet
  });

  it('includes teams with zero played matches', () => {
    const standings = computeStandings([], teams);
    expect(standings).toHaveLength(3);
    expect(standings.every(s => s.played === 0)).toBe(true);
  });

  it('ranks by points, then point differential, then pointsFor, then seed', () => {
    const matches = [
      match({ team_a_id: 'a', team_b_id: 'b', score_a: 11, score_b: 0, status: 'completed' }), // a: +11 diff
      match({ team_a_id: 'c', team_b_id: 'b', score_a: 11, score_b: 9, status: 'completed' }), // c: +2 diff, b: 2 losses
    ];
    const standings = computeStandings(matches, teams);
    // a has 1 win (2 pts, +11 diff), c has 1 win (2 pts, +2 diff) -> a ranks above c on diff
    expect(standings[0].teamId).toBe('a');
    expect(standings[1].teamId).toBe('c');
    expect(standings[2].teamId).toBe('b'); // 0 wins
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(2);
  });

  it('ranks groups independently when group_label is set', () => {
    const groupTeams = [
      { id: 'a', seed: 1 },
      { id: 'b', seed: 2 },
      { id: 'c', seed: 3 },
      { id: 'd', seed: 4 },
    ];
    const matches = [
      match({ team_a_id: 'a', team_b_id: 'b', score_a: 11, score_b: 0, status: 'completed', group_label: 'Group A' }),
      match({ team_a_id: 'c', team_b_id: 'd', score_a: 0, score_b: 11, status: 'completed', group_label: 'Group B' }),
    ];
    const standings = computeStandings(matches, groupTeams);
    const groupARanks = standings.filter(s => s.groupLabel === 'Group A').map(s => s.rank);
    const groupBRanks = standings.filter(s => s.groupLabel === 'Group B').map(s => s.rank);
    expect(groupARanks.sort()).toEqual([1, 2]); // rank restarts per group, not global
    expect(groupBRanks.sort()).toEqual([1, 2]);
  });

  it('groups teams correctly even when zero matches have been completed yet', () => {
    // Regression: group_label is set on every match at fixture-generation
    // time (scheduled or not), but standings used to only learn a team's
    // group from a COMPLETED match — a brand-new group stage would collapse
    // every team into one ungrouped bucket until someone played a game.
    const groupTeams = [
      { id: 'a', seed: 1 },
      { id: 'b', seed: 2 },
      { id: 'c', seed: 3 },
      { id: 'd', seed: 4 },
    ];
    const matches = [
      match({ team_a_id: 'a', team_b_id: 'b', status: 'scheduled', group_label: 'Group A' }),
      match({ team_a_id: 'c', team_b_id: 'd', status: 'scheduled', group_label: 'Group B' }),
    ];
    const standings = computeStandings(matches, groupTeams);
    expect(standings.find(s => s.teamId === 'a')!.groupLabel).toBe('Group A');
    expect(standings.find(s => s.teamId === 'b')!.groupLabel).toBe('Group A');
    expect(standings.find(s => s.teamId === 'c')!.groupLabel).toBe('Group B');
    expect(standings.find(s => s.teamId === 'd')!.groupLabel).toBe('Group B');
  });

  it('ignores bye matches', () => {
    const matches = [match({ team_a_id: 'a', team_b_id: null, is_bye: true, status: 'completed' })];
    const standings = computeStandings(matches, teams);
    expect(standings.find(s => s.teamId === 'a')!.played).toBe(0);
  });
});

describe('computeIndividualStandings', () => {
  it('credits both players on each team individually', () => {
    const teams = [
      { id: 'teamA', player_names: ['alice', 'amir'] as [string, string] },
      { id: 'teamB', player_names: ['bala', 'binu'] as [string, string] },
    ];
    const matches = [match({ team_a_id: 'teamA', team_b_id: 'teamB', score_a: 11, score_b: 7, status: 'completed' })];
    const standings = computeIndividualStandings(matches, teams);
    expect(standings.find(s => s.playerName === 'alice')!.won).toBe(1);
    expect(standings.find(s => s.playerName === 'amir')!.won).toBe(1);
    expect(standings.find(s => s.playerName === 'bala')!.lost).toBe(1);
    expect(standings.find(s => s.playerName === 'binu')!.lost).toBe(1);
  });
});
