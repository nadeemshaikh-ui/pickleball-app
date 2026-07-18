import { describe, it, expect } from 'vitest';
import { computeTeamChampionshipStandings, validateManualPairings, computeRapidFireState, computeRapidFireBonus, type StageConfig, type RapidFireConfig } from './teamChampionship';
import type { RoundRow } from './db';
import type { SquadSet } from './squads';

const stages: StageConfig[] = [
  { stageLabel: 'Foundation', roundStart: 1, roundEnd: 5, pointsPerWin: 1 },
  { stageLabel: 'Momentum', roundStart: 6, roundEnd: 10, pointsPerWin: 2 },
  { stageLabel: 'Championship', roundStart: 11, roundEnd: 15, pointsPerWin: 3 },
];

const teams: SquadSet = [
  { id: 'home', players: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'challengers', players: ['C1', 'C2', 'C3', 'C4'] },
];

function round(n: number, teamA: [string, string], teamB: [string, string], scoreA: number, scoreB: number): RoundRow {
  return { id: `r${n}`, session_id: 's', round_number: n, court: 1, team_a: teamA, team_b: teamB, sitting_out: [], score_a: scoreA, score_b: scoreB };
}

describe('computeTeamChampionshipStandings', () => {
  it('weights each win by its stage pointsPerWin, not a flat 1 point', () => {
    const rounds: RoundRow[] = [
      round(1, ['H1', 'H2'], ['C1', 'C2'], 15, 10), // stage 1, home wins, +1
      round(6, ['H3', 'H4'], ['C3', 'C4'], 10, 15), // stage 2, challengers win, +2
      round(11, ['H1', 'H3'], ['C1', 'C3'], 15, 5), // stage 3, home wins, +3
    ];
    const { totalsByTeam } = computeTeamChampionshipStandings(rounds, teams, stages);
    expect(totalsByTeam.get('home')).toBe(1 + 3);
    expect(totalsByTeam.get('challengers')).toBe(2);
  });

  it('produces a per-stage breakdown that sums to the same total', () => {
    const rounds: RoundRow[] = [
      round(1, ['H1', 'H2'], ['C1', 'C2'], 15, 10),
      round(2, ['H3', 'H4'], ['C3', 'C4'], 5, 15),
      round(6, ['H1', 'H2'], ['C1', 'C2'], 15, 10),
    ];
    const { totalsByTeam, stageBreakdown } = computeTeamChampionshipStandings(rounds, teams, stages);
    const foundation = stageBreakdown.find(s => s.stageLabel === 'Foundation')!;
    const momentum = stageBreakdown.find(s => s.stageLabel === 'Momentum')!;
    expect(foundation.totalsByTeam.get('home')).toBe(1);
    expect(foundation.totalsByTeam.get('challengers')).toBe(1);
    expect(momentum.totalsByTeam.get('home')).toBe(2);
    for (const teamId of ['home', 'challengers']) {
      const sum = stageBreakdown.reduce((acc, s) => acc + s.totalsByTeam.get(teamId)!, 0);
      expect(sum).toBe(totalsByTeam.get(teamId));
    }
  });

  it('ignores unscored rounds, ties, and rounds outside any configured stage', () => {
    const rounds: RoundRow[] = [
      round(1, ['H1', 'H2'], ['C1', 'C2'], null as unknown as number, null as unknown as number),
      round(2, ['H1', 'H2'], ['C1', 'C2'], 10, 10), // tie — shouldn't happen in real pickleball, defensive skip
      round(99, ['H1', 'H2'], ['C1', 'C2'], 15, 5), // round 99 outside all 3 configured stages
    ];
    const { totalsByTeam } = computeTeamChampionshipStandings(rounds, teams, stages);
    expect(totalsByTeam.get('home')).toBe(0);
    expect(totalsByTeam.get('challengers')).toBe(0);
  });
});

describe('validateManualPairings', () => {
  it('flags the exact play-count imbalance found in the real reference schedule (Kris 4/1, Siddarth 2/3, target 3/2)', () => {
    // Reconstructed directly from the real Session 1 schedule verified
    // during planning: 3 courts, 5 rounds, 10-player Challenger roster,
    // target = 3*2*5/10 = 3 plays each. Kris actually played 4, Siddarth
    // actually played 2 — this must produce exactly those two warnings.
    const challengerTeam: SquadSet = [
      { id: 'challengers', players: ['Kris', 'Deep', 'Amresh', 'Ankit', 'Vikki', 'Siddarth', 'Aryan', 'Vineet', 'Nadeem', 'Sumeet'] },
      { id: 'home', players: [] },
    ];
    const stage: StageConfig[] = [{ stageLabel: 'Session 1', roundStart: 1, roundEnd: 5, pointsPerWin: 1 }];
    // Every real Challenger-side pairing from the reference schedule's
    // rounds 1-5, one row per court match (opponent is a placeholder not
    // in the roster — this test only checks Challenger-side counts).
    const opponent: [string, string] = ['Zz1', 'Zz2'];
    const rounds = [
      { roundNumber: 1, teamA: ['Kris', 'Deep'] as [string, string], teamB: opponent },
      { roundNumber: 1, teamA: ['Amresh', 'Ankit'] as [string, string], teamB: opponent },
      { roundNumber: 1, teamA: ['Vikki', 'Siddarth'] as [string, string], teamB: opponent },
      { roundNumber: 2, teamA: ['Nadeem', 'Vineet'] as [string, string], teamB: opponent },
      { roundNumber: 2, teamA: ['Sumeet', 'Aryan'] as [string, string], teamB: opponent },
      { roundNumber: 2, teamA: ['Kris', 'Vikki'] as [string, string], teamB: opponent },
      { roundNumber: 3, teamA: ['Amresh', 'Vineet'] as [string, string], teamB: opponent },
      { roundNumber: 3, teamA: ['Sumeet', 'Deep'] as [string, string], teamB: opponent },
      { roundNumber: 3, teamA: ['Nadeem', 'Ankit'] as [string, string], teamB: opponent },
      { roundNumber: 4, teamA: ['Kris', 'Sumeet'] as [string, string], teamB: opponent },
      { roundNumber: 4, teamA: ['Amresh', 'Siddarth'] as [string, string], teamB: opponent },
      { roundNumber: 4, teamA: ['Aryan', 'Vikki'] as [string, string], teamB: opponent },
      { roundNumber: 5, teamA: ['Nadeem', 'Deep'] as [string, string], teamB: opponent },
      { roundNumber: 5, teamA: ['Kris', 'Ankit'] as [string, string], teamB: opponent },
      { roundNumber: 5, teamA: ['Aryan', 'Vineet'] as [string, string], teamB: opponent },
    ];
    const warnings = validateManualPairings(rounds, challengerTeam, stage, 3);
    const playWarnings = warnings.filter(w => w.type === 'play_count');
    expect(playWarnings.some(w => w.message.includes('Kris') && w.message.includes('4/5'))).toBe(true);
    expect(playWarnings.some(w => w.message.includes('Siddarth') && w.message.includes('2/5'))).toBe(true);
    // Everyone else should be exactly on target (3/5) and produce no warning.
    const others = ['Deep', 'Amresh', 'Ankit', 'Vikki', 'Aryan', 'Vineet', 'Nadeem', 'Sumeet'];
    for (const name of others) {
      expect(playWarnings.some(w => w.message.startsWith(name))).toBe(false);
    }
  });

  it('flags a repeated partnership within the same stage', () => {
    const t: SquadSet = [{ id: 'home', players: ['A', 'B', 'C', 'D'] }, { id: 'away', players: ['E', 'F', 'G', 'H'] }];
    const stage: StageConfig[] = [{ stageLabel: 'S1', roundStart: 1, roundEnd: 2, pointsPerWin: 1 }];
    const rounds = [
      { roundNumber: 1, teamA: ['A', 'B'] as [string, string], teamB: ['E', 'F'] as [string, string] },
      { roundNumber: 2, teamA: ['A', 'B'] as [string, string], teamB: ['G', 'H'] as [string, string] }, // A+B repeat
    ];
    const warnings = validateManualPairings(rounds, t, stage, 1);
    expect(warnings.some(w => w.type === 'repeat_partner' && w.message.includes('A & B'))).toBe(true);
  });
});

describe('computeRapidFireState / computeRapidFireBonus', () => {
  const config: RapidFireConfig = { targetPoints: 5, bonusPoints: 10 };

  it('tallies points per team from the log and detects the win at targetPoints', () => {
    const log = [
      { eventOrder: 1, scoringTeamId: 'home', onCourtPlayers: [] },
      { eventOrder: 2, scoringTeamId: 'home', onCourtPlayers: [] },
      { eventOrder: 3, scoringTeamId: 'challengers', onCourtPlayers: [] },
      { eventOrder: 4, scoringTeamId: 'home', onCourtPlayers: [] },
      { eventOrder: 5, scoringTeamId: 'home', onCourtPlayers: [] },
      { eventOrder: 6, scoringTeamId: 'home', onCourtPlayers: [] }, // home reaches 5
    ];
    const state = computeRapidFireState(log, config, teams);
    expect(state.totalsByTeam.get('home')).toBe(5);
    expect(state.totalsByTeam.get('challengers')).toBe(1);
    expect(state.isComplete).toBe(true);
    expect(state.winnerTeamId).toBe('home');

    const bonus = computeRapidFireBonus(state, config);
    expect(bonus.get('home')).toBe(10);
    expect(bonus.get('challengers')).toBe(0);
  });

  it('is not complete before targetPoints is reached, and awards zero bonus to both teams', () => {
    const log = [{ eventOrder: 1, scoringTeamId: 'home', onCourtPlayers: [] }];
    const state = computeRapidFireState(log, config, teams);
    expect(state.isComplete).toBe(false);
    expect(state.winnerTeamId).toBeNull();
    const bonus = computeRapidFireBonus(state, config);
    expect(bonus.get('home')).toBe(0);
    expect(bonus.get('challengers')).toBe(0);
  });

  it('has no automatic rotation — on-court players default to each team\'s first two, then carry forward from the most recent log entry', () => {
    const fourPerTeam: SquadSet = [
      { id: 'home', players: ['H1', 'H2', 'H3', 'H4'] },
      { id: 'challengers', players: ['C1', 'C2', 'C3', 'C4'] },
    ];
    const noPoints = computeRapidFireState([], config, fourPerTeam);
    expect(noPoints.onCourtPlayers).toEqual(['H1', 'H2', 'C1', 'C2']);

    // A manual sub (H2 -> H3) recorded on the next logged point should stick,
    // not get overridden by any point-count formula.
    const afterManualSub = computeRapidFireState(
      [{ eventOrder: 1, scoringTeamId: 'home', onCourtPlayers: ['H1', 'H3', 'C1', 'C2'] }],
      config,
      fourPerTeam
    );
    expect(afterManualSub.onCourtPlayers).toEqual(['H1', 'H3', 'C1', 'C2']);

    // Without another manual sub, on-court players stay exactly as last logged.
    const anotherPoint = computeRapidFireState(
      [
        { eventOrder: 1, scoringTeamId: 'home', onCourtPlayers: ['H1', 'H3', 'C1', 'C2'] },
        { eventOrder: 2, scoringTeamId: 'home', onCourtPlayers: ['H1', 'H3', 'C1', 'C2'] },
      ],
      config,
      fourPerTeam
    );
    expect(anotherPoint.onCourtPlayers).toEqual(['H1', 'H3', 'C1', 'C2']);
  });
});
