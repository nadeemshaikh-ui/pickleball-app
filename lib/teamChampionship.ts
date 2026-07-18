// Team Championship format core (see memory
// project_pickleball_team_championship_plan for the full locked plan).
// 2 fixed teams, captain-submitted manual pairings, tiered per-stage
// scoring, live Rapid Fire finale. Every number here is config data, never
// hardcoded — this format must work "again and again with fresh data."
// Isolated: not wired into any caller yet, same discipline as lib/squads.ts.
import type { RoundRow } from './db';
import type { SquadSet } from './squads';

export interface StageConfig {
  stageLabel: string;
  roundStart: number;
  roundEnd: number;
  pointsPerWin: number;
}

export interface RapidFireConfig {
  targetPoints: number;
  rotateEveryNPoints: number;
  bonusPoints: number;
}

function stageForRound(roundNumber: number, stages: StageConfig[]): StageConfig | undefined {
  return stages.find(s => roundNumber >= s.roundStart && roundNumber <= s.roundEnd);
}

export interface TeamChampionshipStandings {
  totalsByTeam: Map<string, number>;
  stageBreakdown: { stageLabel: string; totalsByTeam: Map<string, number> }[];
}

// Weights each round's win by its stage's pointsPerWin (1/2/3 in the
// tournament that triggered this build, but config-driven — any stage
// shape works) instead of counting every win as 1 point. A round outside
// every configured stage is silently skipped (e.g. this function is never
// called with Rapid Fire rows, which live in rapid_fire_log, not `rounds`).
export function computeTeamChampionshipStandings(
  rounds: RoundRow[],
  teams: SquadSet,
  stages: StageConfig[]
): TeamChampionshipStandings {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const totalsByTeam = new Map(teams.map(t => [t.id, 0]));
  const stageBreakdown = stages.map(s => ({ stageLabel: s.stageLabel, totalsByTeam: new Map(teams.map(t => [t.id, 0])) }));

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null || round.score_a === round.score_b) continue;
    const stage = stageForRound(round.round_number, stages);
    if (!stage) continue;

    const aWon = round.score_a > round.score_b;
    const winningTeam = aWon ? round.team_a : round.team_b;
    const winnerSquadId = winningTeam[0] !== undefined ? squadOfPlayer.get(winningTeam[0]) : undefined;
    if (winnerSquadId === undefined || !totalsByTeam.has(winnerSquadId)) continue;

    totalsByTeam.set(winnerSquadId, totalsByTeam.get(winnerSquadId)! + stage.pointsPerWin);
    const stageEntry = stageBreakdown.find(sb => sb.stageLabel === stage.stageLabel)!;
    stageEntry.totalsByTeam.set(winnerSquadId, stageEntry.totalsByTeam.get(winnerSquadId)! + stage.pointsPerWin);
  }

  return { totalsByTeam, stageBreakdown };
}

export interface PairingWarning {
  type: 'play_count' | 'repeat_partner';
  message: string;
}

// Soft-validation for the manual round-pairing entry screen — never
// blocks a save, only surfaces warnings, since captains submit real
// pre-agreed pairings the app didn't generate. Verified against a real
// tournament's actual Session 1 schedule during planning: the stated rule
// ("every player plays 3, rests 2, per 5-round session") is an EXACT
// target derived from courtCount*2*roundsInStage / rosterSize, not an
// approximation — the real example had two players off by exactly 1
// (4 plays/1 rest and 2 plays/3 rests against a target of 3/2), and that
// is exactly the case this function must flag, so the tolerance below is
// zero, not the ±1 the N-squad rotation module (lib/squads.ts) uses for
// its own, deliberately looser, balancing rule.
export function validateManualPairings(
  rounds: { roundNumber: number; teamA: [string, string]; teamB: [string, string] }[],
  teams: SquadSet,
  stages: StageConfig[],
  courtCount: number
): PairingWarning[] {
  const warnings: PairingWarning[] = [];

  for (const stage of stages) {
    const stageRounds = rounds.filter(r => r.roundNumber >= stage.roundStart && r.roundNumber <= stage.roundEnd);
    const roundsInStage = stage.roundEnd - stage.roundStart + 1;

    const playCounts = new Map<string, number>();
    for (const t of teams) for (const p of t.players) playCounts.set(p, 0);
    const partnerSeen = new Set<string>();

    for (const r of stageRounds) {
      for (const team of [r.teamA, r.teamB]) {
        for (const p of team) playCounts.set(p, (playCounts.get(p) ?? 0) + 1);
        const key = [...team].sort().join('|');
        if (partnerSeen.has(key)) {
          warnings.push({
            type: 'repeat_partner',
            message: `${team[0]} & ${team[1]} have already partnered once in ${stage.stageLabel} (round ${r.roundNumber}).`,
          });
        } else {
          partnerSeen.add(key);
        }
      }
    }

    for (const t of teams) {
      if (t.players.length === 0) continue;
      const totalSlots = courtCount * 2 * roundsInStage;
      const fairTarget = Math.round(totalSlots / t.players.length);
      for (const p of t.players) {
        const count = playCounts.get(p) ?? 0;
        if (count !== fairTarget) {
          warnings.push({
            type: 'play_count',
            message: `${p} plays ${count}/${roundsInStage} rounds in ${stage.stageLabel} (target ${fairTarget}).`,
          });
        }
      }
    }
  }

  return warnings;
}

export interface RapidFireLogEntry {
  eventOrder: number;
  scoringTeamId: string;
  onCourtPlayers: string[];
}

export interface RapidFireState {
  totalsByTeam: Map<string, number>;
  onCourtPlayers: string[];
  isComplete: boolean;
  winnerTeamId: string | null;
}

// Deterministic round-robin pairing within one team's roster: cycle through
// consecutive pairs in a fixed order. `index` is which rotation cycle
// (0-based) — pairIndex wraps once every player has been through.
function rotationPairForIndex(players: string[], index: number): [string, string] {
  const pairCount = Math.floor(players.length / 2);
  const pairIndex = index % pairCount;
  return [players[pairIndex * 2], players[pairIndex * 2 + 1]];
}

// Rapid Fire is NOT round-based — a live continuous rally-point race with
// the on-court foursome rotating every `rotateEveryNPoints` TOTAL points
// scored (not per team). This computes current state purely from the
// append-only log, so it's safe to call repeatedly as new points come in
// (matches the app's existing poll-don't-subscribe convention).
//
// OPEN QUESTION not yet resolved with the tournament committee (see the
// locked plan): does the whole foursome rotate every N points, or only
// some of them? This implements "whole foursome rotates" as the
// documented default — if the real rule turns out to be partial rotation,
// only rotationPairForIndex's caller here needs to change, the rest of
// this module (score tallying, win detection) is unaffected.
export function computeRapidFireState(
  log: RapidFireLogEntry[],
  config: RapidFireConfig,
  teams: SquadSet
): RapidFireState {
  const totalsByTeam = new Map(teams.map(t => [t.id, 0]));
  for (const entry of log) {
    if (totalsByTeam.has(entry.scoringTeamId)) {
      totalsByTeam.set(entry.scoringTeamId, totalsByTeam.get(entry.scoringTeamId)! + 1);
    }
  }

  const winnerEntry = [...totalsByTeam.entries()].find(([, points]) => points >= config.targetPoints);
  const isComplete = winnerEntry !== undefined;
  const winnerTeamId = winnerEntry?.[0] ?? null;

  const rotationIndex = Math.floor(log.length / config.rotateEveryNPoints);
  const onCourtPlayers = teams.flatMap(t => (t.players.length >= 2 ? rotationPairForIndex(t.players, rotationIndex) : []));

  return { totalsByTeam, onCourtPlayers, isComplete, winnerTeamId };
}

// Winner-take-all is the plan's assumed default for the Rapid Fire bonus
// (also flagged as unconfirmed in the locked plan) — the losing team gets
// 0, not partial credit.
export function computeRapidFireBonus(state: RapidFireState, config: RapidFireConfig): Map<string, number> {
  const bonus = new Map([...state.totalsByTeam.keys()].map(id => [id, 0]));
  if (state.winnerTeamId !== null && bonus.has(state.winnerTeamId)) {
    bonus.set(state.winnerTeamId, config.bonusPoints);
  }
  return bonus;
}
