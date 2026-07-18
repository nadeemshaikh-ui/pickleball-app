import { supabase } from './supabase';
import type { TournamentMatchRow } from './tournamentMatches';
import type { TournamentTeamRow } from './tournamentTeams';

export interface StandingsRow {
  teamId: string;
  groupLabel: string | null;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
  rank: number;
}

export interface IndividualStandingRow {
  playerName: string;
  teamId: string;
  played: number;
  won: number;
  lost: number;
}

const DEFAULT_POINTS_PER_WIN = 2;

// Tie-break order: points desc -> point differential desc -> pointsFor desc
// -> seed asc (lower seed number = better). This determines who advances
// (results.advancingTeamIds in generateNextStage), so it has to be
// deterministic, not just "roughly sorted."
export function computeStandings(
  matches: TournamentMatchRow[],
  teams: Pick<TournamentTeamRow, 'id' | 'seed'>[],
  opts?: { pointsPerWin?: number }
): StandingsRow[] {
  const pointsPerWin = opts?.pointsPerWin ?? DEFAULT_POINTS_PER_WIN;
  const seedOf = new Map(teams.map(t => [t.id, t.seed ?? Number.MAX_SAFE_INTEGER]));
  const groupOf = new Map<string, string | null>();

  const rows = new Map<string, StandingsRow>();
  function row(teamId: string, groupLabel: string | null): StandingsRow {
    let r = rows.get(teamId);
    if (!r) {
      r = { teamId, groupLabel, played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, points: 0, rank: 0 };
      rows.set(teamId, r);
    }
    return r;
  }

  // Learn each team's group from EVERY match (scheduled or completed) —
  // group_label is set at fixture-generation time, not at score-entry time,
  // so a brand-new group stage with zero completed matches still needs its
  // teams correctly bucketed, not collapsed into one combined "ungrouped"
  // ranking until someone plays a game.
  for (const m of matches) {
    if (m.is_bye || !m.team_a_id || !m.team_b_id) continue;
    groupOf.set(m.team_a_id, m.group_label);
    groupOf.set(m.team_b_id, m.group_label);
  }

  for (const m of matches) {
    if (m.is_bye || !m.team_a_id || !m.team_b_id) continue;
    if (m.status !== 'completed' || m.score_a === null || m.score_b === null) continue;

    const a = row(m.team_a_id, m.group_label);
    const b = row(m.team_b_id, m.group_label);
    a.played++;
    b.played++;
    a.pointsFor += m.score_a;
    a.pointsAgainst += m.score_b;
    b.pointsFor += m.score_b;
    b.pointsAgainst += m.score_a;

    if (m.score_a > m.score_b) {
      a.won++;
      b.lost++;
      a.points += pointsPerWin;
    } else {
      b.won++;
      a.lost++;
      b.points += pointsPerWin;
    }
  }

  // include teams with 0 played matches so they still appear in the table
  for (const t of teams) row(t.id, groupOf.get(t.id) ?? null);

  const sorted = [...rows.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const diffX = x.pointsFor - x.pointsAgainst;
    const diffY = y.pointsFor - y.pointsAgainst;
    if (diffY !== diffX) return diffY - diffX;
    if (y.pointsFor !== x.pointsFor) return y.pointsFor - x.pointsFor;
    return (seedOf.get(x.teamId) ?? Number.MAX_SAFE_INTEGER) - (seedOf.get(y.teamId) ?? Number.MAX_SAFE_INTEGER);
  });

  // rank within group when grouped, else rank across the whole field
  const rankCounters = new Map<string | null, number>();
  for (const r of sorted) {
    const key = r.groupLabel;
    const next = (rankCounters.get(key) ?? 0) + 1;
    rankCounters.set(key, next);
    r.rank = next;
  }

  return sorted;
}

// Forward-compatible plumbing only, per spec — no Phase 2/3 component reads
// this yet. Computed and stored on the stage's frozen results whenever
// config.individualScoring is set, so it's ready for a future rotating-
// partner session format to consume without a schema change.
export function computeIndividualStandings(
  matches: TournamentMatchRow[],
  teams: Pick<TournamentTeamRow, 'id' | 'player_names'>[]
): IndividualStandingRow[] {
  const playersOf = new Map(teams.map(t => [t.id, t.player_names]));
  const rows = new Map<string, IndividualStandingRow>();
  function row(playerName: string, teamId: string): IndividualStandingRow {
    let r = rows.get(playerName);
    if (!r) {
      r = { playerName, teamId, played: 0, won: 0, lost: 0 };
      rows.set(playerName, r);
    }
    return r;
  }

  for (const m of matches) {
    if (m.is_bye || !m.team_a_id || !m.team_b_id) continue;
    if (m.status !== 'completed' || m.score_a === null || m.score_b === null) continue;
    const aWon = m.score_a > m.score_b;
    for (const name of playersOf.get(m.team_a_id) ?? []) {
      const r = row(name, m.team_a_id);
      r.played++;
      if (aWon) r.won++; else r.lost++;
    }
    for (const name of playersOf.get(m.team_b_id) ?? []) {
      const r = row(name, m.team_b_id);
      r.played++;
      if (aWon) r.lost++; else r.won++;
    }
  }

  return [...rows.values()];
}

export interface CombinedStandingRow {
  teamId: string;
  groupLabel: string | null;
  played: number;
  won: number;
  lost: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
}

// Direct result between two teams, if they played each other and it's
// scored — used as the combined ranking's tiebreak, but only meaningful
// within the same group (teams in different groups never actually played).
function headToHeadWinner(teamA: string, teamB: string, matches: TournamentMatchRow[]): string | null {
  const direct = matches.find(
    m =>
      !m.is_bye &&
      m.status === 'completed' &&
      m.score_a !== null &&
      m.score_b !== null &&
      ((m.team_a_id === teamA && m.team_b_id === teamB) || (m.team_a_id === teamB && m.team_b_id === teamA))
  );
  if (!direct) return null;
  const aIsTeamA = direct.team_a_id === teamA;
  const aScore = aIsTeamA ? direct.score_a! : direct.score_b!;
  const bScore = aIsTeamA ? direct.score_b! : direct.score_a!;
  return aScore > bScore ? teamA : teamB;
}

// Ranks every team across ALL groups together (not per-group), for a flat
// "top N combined" cut — the KINK format's actual advancement rule, and
// distinct from computeStandings' per-group ranking. Sorted by win %
// (not raw points) since groups can have uneven sizes and therefore
// different match counts — raw points would unfairly favor a team from a
// bigger group. Tiebreak: win % -> head-to-head (same group only) -> point
// differential -> points scored -> seed.
export function computeCombinedStandings(
  matches: TournamentMatchRow[],
  teams: Pick<TournamentTeamRow, 'id' | 'seed'>[]
): CombinedStandingRow[] {
  const seedOf = new Map(teams.map(t => [t.id, t.seed ?? Number.MAX_SAFE_INTEGER]));
  const groupOf = new Map<string, string | null>();
  const rows = new Map<string, CombinedStandingRow>();
  function row(teamId: string, groupLabel: string | null): CombinedStandingRow {
    let r = rows.get(teamId);
    if (!r) {
      r = { teamId, groupLabel, played: 0, won: 0, lost: 0, winPct: 0, pointsFor: 0, pointsAgainst: 0, rank: 0 };
      rows.set(teamId, r);
    }
    return r;
  }

  for (const m of matches) {
    if (m.is_bye || !m.team_a_id || !m.team_b_id) continue;
    groupOf.set(m.team_a_id, m.group_label);
    groupOf.set(m.team_b_id, m.group_label);
  }

  for (const m of matches) {
    if (m.is_bye || !m.team_a_id || !m.team_b_id) continue;
    if (m.status !== 'completed' || m.score_a === null || m.score_b === null) continue;

    const a = row(m.team_a_id, m.group_label);
    const b = row(m.team_b_id, m.group_label);
    a.played++;
    b.played++;
    a.pointsFor += m.score_a;
    a.pointsAgainst += m.score_b;
    b.pointsFor += m.score_b;
    b.pointsAgainst += m.score_a;
    if (m.score_a > m.score_b) {
      a.won++;
      b.lost++;
    } else {
      b.won++;
      a.lost++;
    }
  }

  for (const t of teams) row(t.id, groupOf.get(t.id) ?? null);
  for (const r of rows.values()) r.winPct = r.played > 0 ? r.won / r.played : 0;

  const sorted = [...rows.values()].sort((x, y) => {
    if (y.winPct !== x.winPct) return y.winPct - x.winPct;
    if (x.groupLabel !== null && x.groupLabel === y.groupLabel) {
      const h2h = headToHeadWinner(x.teamId, y.teamId, matches);
      if (h2h) return h2h === x.teamId ? -1 : 1;
    }
    const diffX = x.pointsFor - x.pointsAgainst;
    const diffY = y.pointsFor - y.pointsAgainst;
    if (diffY !== diffX) return diffY - diffX;
    if (y.pointsFor !== x.pointsFor) return y.pointsFor - x.pointsFor;
    return (seedOf.get(x.teamId) ?? Number.MAX_SAFE_INTEGER) - (seedOf.get(y.teamId) ?? Number.MAX_SAFE_INTEGER);
  });

  sorted.forEach((r, i) => {
    r.rank = i + 1;
  });
  return sorted;
}

export async function fetchStageStandings(stageId: string, opts?: { pointsPerWin?: number }): Promise<StandingsRow[]> {
  const { data: matches, error: matchesError } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('stage_id', stageId);
  if (matchesError) throw matchesError;

  const { data: stage, error: stageError } = await supabase
    .from('tournament_stages')
    .select('tournament_id')
    .eq('id', stageId)
    .single();
  if (stageError) throw stageError;

  const { data: teams, error: teamsError } = await supabase
    .from('tournament_teams')
    .select('id, seed')
    .eq('tournament_id', stage.tournament_id);
  if (teamsError) throw teamsError;

  return computeStandings(matches as TournamentMatchRow[], teams, opts);
}
