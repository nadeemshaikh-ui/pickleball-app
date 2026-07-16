import { supabase } from './supabase';
import { fetchTournamentTeams, orderedTeamIds } from './tournamentTeams';
import { fetchStageMatches, type TournamentMatchRow } from './tournamentMatches';
import { computeStandings, computeIndividualStandings, type StandingsRow, type IndividualStandingRow } from './tournamentStandings';
import {
  generateLeagueFixtures,
  generateGroupFixtures,
  generateKnockoutFixtures,
  generatePagePlayoffFixtures,
  generateSimpleSemifinalFixtures,
} from './tournamentFixtures';

export type StageType = 'league' | 'group' | 'knockout' | 'page_playoff' | 'simple_semifinal';
const BRACKET_STAGE_TYPES: StageType[] = ['knockout', 'page_playoff', 'simple_semifinal'];

export interface StageConfig {
  groupCount?: number;
  advancePerGroup?: number;
  doubleHeader?: boolean;
  individualScoring?: boolean;
  pointsPerWin?: number;
}

export interface LeagueGroupResults {
  standings: StandingsRow[];
  individualStandings?: IndividualStandingRow[];
  advancingTeamIds: string[];
}

export interface BracketResults {
  winnerTeamId: string;
  runnerUpTeamId: string | null;
  placements: { teamId: string; place: number }[];
}

export interface TournamentStageRow {
  id: string;
  tournament_id: string;
  club_id: string;
  stage_order: number;
  stage_type: StageType;
  name: string;
  config: StageConfig;
  source_stage_id: string | null;
  status: 'pending' | 'active' | 'completed';
  results: LeagueGroupResults | BracketResults | null;
  created_at: string;
  completed_at: string | null;
}

export async function fetchStages(tournamentId: string): Promise<TournamentStageRow[]> {
  const { data, error } = await supabase
    .from('tournament_stages')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('stage_order', { ascending: true });
  if (error) throw error;
  return data as TournamentStageRow[];
}

// A bracket-type stage's final match is, by construction, the one match with
// no winner_next_match_id — true for knockout, page_playoff, and
// simple_semifinal alike, so this needs no per-stage-type branching.
function findFinalMatch(matches: TournamentMatchRow[]): TournamentMatchRow {
  const final = matches.find(m => m.winner_next_match_id === null);
  if (!final) throw new Error('Could not find a final match for this bracket stage — stage data looks corrupted.');
  return final;
}

function computeBracketResult(matches: TournamentMatchRow[]): BracketResults {
  const final = findFinalMatch(matches);
  if (final.status !== 'completed' || final.score_a === null || final.score_b === null) {
    throw new Error("This stage's final match hasn't been scored yet — score it before generating the next stage.");
  }
  const winnerTeamId = final.score_a > final.score_b ? final.team_a_id! : final.team_b_id!;
  const runnerUpTeamId = final.score_a > final.score_b ? final.team_b_id : final.team_a_id;
  const placements = [{ teamId: winnerTeamId, place: 1 }, ...(runnerUpTeamId ? [{ teamId: runnerUpTeamId, place: 2 }] : [])];
  return { winnerTeamId, runnerUpTeamId, placements };
}

// Every non-bye match in the stage must be scored before its standings/
// bracket-result can be treated as final — otherwise a stage generated from
// e.g. 2-of-6 played league matches would silently freeze the wrong
// standings (and the wrong advancingTeamIds) while the remaining fixtures
// are abandoned with no error anywhere.
export function assertStageFullyScored(matches: TournamentMatchRow[]): void {
  const unscored = matches.filter(m => !m.is_bye && m.status !== 'completed');
  if (unscored.length > 0) {
    throw new Error(
      `${unscored.length} match${unscored.length === 1 ? '' : 'es'} in this stage still need${unscored.length === 1 ? 's' : ''} a score before you can generate the next stage.`
    );
  }
}

// Freezes a stage's results exactly once — safe to call on an
// already-completed stage (no-op, returns the stored results) so callers
// don't need to check status first.
async function freezeStageResults(stage: TournamentStageRow): Promise<LeagueGroupResults | BracketResults> {
  if (stage.status === 'completed' && stage.results) return stage.results;

  const matches = await fetchStageMatches(stage.id);
  assertStageFullyScored(matches);
  const teams = await fetchTournamentTeams(stage.tournament_id);

  let results: LeagueGroupResults | BracketResults;
  if (BRACKET_STAGE_TYPES.includes(stage.stage_type)) {
    results = computeBracketResult(matches);
  } else {
    const standings = computeStandings(matches, teams, { pointsPerWin: stage.config.pointsPerWin });
    const advancePerGroup = stage.config.advancePerGroup ?? standings.length;
    const advancingTeamIds = standings.filter(s => s.rank <= advancePerGroup).map(s => s.teamId);
    const individualStandings = stage.config.individualScoring ? computeIndividualStandings(matches, teams) : undefined;
    results = { standings, individualStandings, advancingTeamIds };
  }

  const { error } = await supabase
    .from('tournament_stages')
    .update({ results, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', stage.id);
  if (error) throw error;

  return results;
}

function isLeagueGroupResults(r: LeagueGroupResults | BracketResults): r is LeagueGroupResults {
  return 'standings' in r;
}

// The core stage-chaining mechanism: derive the seed order for a new stage
// (from tournament_teams if this is stage 1, or from the source stage's
// frozen results otherwise), run the matching pure fixture generator, and
// persist atomically via create_tournament_stage. No clubId parameter —
// the RPC derives it server-side from tournamentId so a caller can never
// supply a mismatched club_id (see the fix_cross_tenant_club_id_trust migration).
export async function generateNextStage(
  tournamentId: string,
  sourceStageId: string | null,
  stageType: StageType,
  name: string,
  config: StageConfig
): Promise<string> {
  let seedOrderTeamIds: string[];

  if (sourceStageId === null) {
    const teams = await fetchTournamentTeams(tournamentId);
    seedOrderTeamIds = orderedTeamIds(teams);
  } else {
    const stages = await fetchStages(tournamentId);
    const source = stages.find(s => s.id === sourceStageId);
    if (!source) throw new Error('Source stage not found.');
    const results = await freezeStageResults(source);
    seedOrderTeamIds = isLeagueGroupResults(results) ? results.advancingTeamIds : [results.winnerTeamId];
  }

  const teams = await fetchTournamentTeams(tournamentId);
  const teamsById = new Map(teams.map(t => [t.id, t]));
  const seeded = seedOrderTeamIds.map(id => ({ id, seed: teamsById.get(id)?.seed ?? null }));

  let fixtures;
  switch (stageType) {
    case 'league':
      fixtures = generateLeagueFixtures(seedOrderTeamIds, { doubleHeader: config.doubleHeader ?? false });
      break;
    case 'group':
      fixtures = generateGroupFixtures(seeded, { groupCount: config.groupCount ?? 2, doubleHeader: config.doubleHeader ?? false });
      break;
    case 'knockout':
      fixtures = generateKnockoutFixtures(seeded);
      break;
    case 'page_playoff':
      if (seedOrderTeamIds.length !== 4) throw new Error(`Page Playoff requires exactly 4 teams, got ${seedOrderTeamIds.length}`);
      fixtures = generatePagePlayoffFixtures(seedOrderTeamIds as [string, string, string, string]);
      break;
    case 'simple_semifinal':
      if (seedOrderTeamIds.length !== 4) throw new Error(`Simple Semifinal requires exactly 4 teams, got ${seedOrderTeamIds.length}`);
      fixtures = generateSimpleSemifinalFixtures(seedOrderTeamIds as [string, string, string, string]);
      break;
    default: {
      const exhaustiveCheck: never = stageType;
      throw new Error(`Unknown stage type: ${exhaustiveCheck}`);
    }
  }

  const stages = await fetchStages(tournamentId);
  const nextOrder = stages.length > 0 ? Math.max(...stages.map(s => s.stage_order)) + 1 : 1;

  const { data: stageId, error } = await supabase.rpc('create_tournament_stage', {
    p_tournament_id: tournamentId,
    p_stage_order: nextOrder,
    p_stage_type: stageType,
    p_name: name,
    p_config: config,
    p_source_stage_id: sourceStageId,
    p_matches: fixtures,
  });
  if (error) throw error;
  return stageId as string;
}
