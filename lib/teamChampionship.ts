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
  type: 'play_count' | 'repeat_partner' | 'missing_partner';
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

  // Play-count balancing ("every player plays 3, rests 2, per session") is
  // a per-stage rule — unchanged, checked per stage below.
  for (const stage of stages) {
    const stageRounds = rounds.filter(r => r.roundNumber >= stage.roundStart && r.roundNumber <= stage.roundEnd);
    const roundsInStage = stage.roundEnd - stage.roundStart + 1;

    const playCounts = new Map<string, number>();
    for (const t of teams) for (const p of t.players) playCounts.set(p, 0);

    for (const r of stageRounds) {
      for (const team of [r.teamA, r.teamB]) {
        for (const p of team) playCounts.set(p, (playCounts.get(p) ?? 0) + 1);
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

  // Repeat-partner checking is NOT per-stage — the tournament rule is
  // "no partnership repeated in Rounds 6-15" (Stage 2 + Stage 3 combined),
  // while Stage 1 is free of that constraint. A per-stage reset (the
  // original implementation) silently missed exactly this: a pair
  // repeating across the stage boundary (e.g. round 7 and round 13) never
  // triggered a warning, because Stage 2's and Stage 3's tracking sets
  // were separate. Generalized as: Stage 1 gets its own window (matches
  // "rounds 1-5" having no stated no-repeat rule), every stage after it
  // shares one combined window (matches "rounds 6-15" for the 3-stage
  // case, and generalizes to N stages — session 1 is a free warm-up,
  // every session after it is locked together).
  const [firstStage, ...laterStages] = stages;
  const repeatWindows: { label: string; roundsInWindow: typeof rounds }[] = [];
  if (firstStage) {
    repeatWindows.push({
      label: firstStage.stageLabel,
      roundsInWindow: rounds.filter(r => r.roundNumber >= firstStage.roundStart && r.roundNumber <= firstStage.roundEnd),
    });
  }
  if (laterStages.length > 0) {
    const windowStart = laterStages[0].roundStart;
    const windowEnd = laterStages[laterStages.length - 1].roundEnd;
    repeatWindows.push({
      label: `${laterStages[0].stageLabel}–${laterStages[laterStages.length - 1].stageLabel} (rounds ${windowStart}-${windowEnd})`,
      roundsInWindow: rounds.filter(r => r.roundNumber >= windowStart && r.roundNumber <= windowEnd),
    });
  }

  for (const window of repeatWindows) {
    const partnerSeen = new Set<string>();
    for (const r of window.roundsInWindow) {
      for (const team of [r.teamA, r.teamB]) {
        const key = [...team].sort().join('|');
        if (partnerSeen.has(key)) {
          warnings.push({
            type: 'repeat_partner',
            message: `${team[0]} & ${team[1]} have already partnered once in ${window.label} (round ${r.roundNumber}).`,
          });
        } else {
          partnerSeen.add(key);
        }
      }
    }
  }

  // "Each player must partner with EVERY teammate" — a full-coverage rule,
  // distinct from repeat-avoidance above (that catches a pair appearing
  // TWICE; this catches a pair that never appears at all). Only checked
  // once every configured round has a real pairing entered — checking
  // partway through would flag pairs the captain simply hasn't reached
  // yet as if they were missing, which isn't a real problem mid-entry.
  const totalConfiguredRounds = stages.reduce((sum, s) => sum + (s.roundEnd - s.roundStart + 1), 0);
  const distinctRoundNumbers = new Set(rounds.map(r => r.roundNumber)).size;
  if (totalConfiguredRounds > 0 && distinctRoundNumbers >= totalConfiguredRounds) {
    const allPartnersSeen = new Set<string>();
    for (const r of rounds) {
      for (const team of [r.teamA, r.teamB]) allPartnersSeen.add([...team].sort().join('|'));
    }
    for (const t of teams) {
      const players = t.players;
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const key = [players[i], players[j]].sort().join('|');
          if (!allPartnersSeen.has(key)) {
            warnings.push({
              type: 'missing_partner',
              message: `${players[i]} & ${players[j]} (${t.label ?? t.id}) never partner across the whole tournament.`,
            });
          }
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

// Rapid Fire is NOT round-based — a live continuous rally-point race.
// Resolved with the tournament committee: there is no fixed rotation
// formula — subbing the on-court foursome is a manual organizer action
// (see the rapid-fire page's sub controls), not automatic on a point
// count. This computes current state purely from the append-only log, so
// it's safe to call repeatedly as new points come in (matches the app's
// existing poll-don't-subscribe convention). on-court players carry
// forward from the most recent log entry once any point has been scored —
// a manual sub takes effect starting with the next point logged.
//
// Before any point is scored, the rule is "the partnerships used in the
// final matches of Rounds 14 & 15 continue as the opening partnerships" —
// NOT an arbitrary roster-order guess. finalRoundPairs supplies each
// team's actual pairing from their own most recent scored round (the
// caller finds this by walking rounds most-recent-first per team — see
// rapid-fire/page.tsx). Falls back to first-two-roster-players only if
// that data is genuinely unavailable (e.g. no rounds were ever scored),
// which should not happen in a real tournament but keeps this function
// total rather than throwing.
export function computeRapidFireState(
  log: RapidFireLogEntry[],
  config: RapidFireConfig,
  teams: SquadSet,
  finalRoundPairs?: Map<string, [string, string]>
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

  const onCourtPlayers =
    log.length > 0
      ? log[log.length - 1].onCourtPlayers
      : teams.flatMap(t => finalRoundPairs?.get(t.id) ?? t.players.slice(0, 2));

  return { totalsByTeam, onCourtPlayers, isComplete, winnerTeamId };
}

// Finds each team's pairing from their own most recent SCORED round —
// used to seed Rapid Fire's opening partnerships per the "Rounds 14 & 15
// carry forward" rule. Walks rounds most-recent-round-number-first, then
// by court, so ties resolve deterministically. A team not found in any
// scored round (shouldn't happen in a real tournament, but e.g. a
// misconfigured/empty session) is simply absent from the returned map —
// computeRapidFireState's fallback covers that case.
export function findFinalRoundPairs(
  rounds: { roundNumber: number; court: number; teamA: [string, string]; teamB: [string, string]; scoreA: number | null; scoreB: number | null }[],
  teams: SquadSet
): Map<string, [string, string]> {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const sorted = [...rounds]
    .filter(r => r.scoreA !== null && r.scoreB !== null)
    .sort((a, b) => (b.roundNumber !== a.roundNumber ? b.roundNumber - a.roundNumber : a.court - b.court));

  const result = new Map<string, [string, string]>();
  for (const round of sorted) {
    for (const pair of [round.teamA, round.teamB]) {
      const teamId = squadOfPlayer.get(pair[0]);
      if (teamId && !result.has(teamId)) result.set(teamId, pair);
    }
    if (result.size === teams.length) break;
  }
  return result;
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
