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

export interface TeamMatchRecord {
  wins: number;
  losses: number;
}

// Match win/loss record (not points) — a team can lead on points while
// having played fewer matches, or vice versa once stage weighting kicks
// in; a real leaderboard needs both, not just the weighted total.
export function computeTeamMatchRecords(rounds: RoundRow[], teams: SquadSet, stages: StageConfig[]): Map<string, TeamMatchRecord> {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const records = new Map(teams.map(t => [t.id, { wins: 0, losses: 0 }]));
  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null || round.score_a === round.score_b) continue;
    if (!stageForRound(round.round_number, stages)) continue;

    const aWon = round.score_a > round.score_b;
    const winningTeam = aWon ? round.team_a : round.team_b;
    const losingTeam = aWon ? round.team_b : round.team_a;
    const winnerId = winningTeam[0] !== undefined ? squadOfPlayer.get(winningTeam[0]) : undefined;
    const loserId = losingTeam[0] !== undefined ? squadOfPlayer.get(losingTeam[0]) : undefined;
    if (winnerId && records.has(winnerId)) records.get(winnerId)!.wins++;
    if (loserId && records.has(loserId)) records.get(loserId)!.losses++;
  }
  return records;
}

export interface RoundResult {
  roundNumber: number;
  court: number;
  stageLabel: string;
  pointsPerWin: number;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
}

// Round-by-round breakdown for the results screen — "which round they won,
// how many points from which match" needs the actual per-match record,
// not just the aggregate totals computeTeamChampionshipStandings produces.
export function computeRoundResults(rounds: RoundRow[], teams: SquadSet, stages: StageConfig[]): RoundResult[] {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  return rounds
    .map(round => {
      const stage = stageForRound(round.round_number, stages);
      if (!stage) return null;
      let winnerTeamId: string | null = null;
      if (round.score_a !== null && round.score_b !== null && round.score_a !== round.score_b) {
        const winningTeam = round.score_a > round.score_b ? round.team_a : round.team_b;
        winnerTeamId = (winningTeam[0] !== undefined ? squadOfPlayer.get(winningTeam[0]) : undefined) ?? null;
      }
      return {
        roundNumber: round.round_number,
        court: round.court,
        stageLabel: stage.stageLabel,
        pointsPerWin: stage.pointsPerWin,
        teamA: round.team_a,
        teamB: round.team_b,
        scoreA: round.score_a,
        scoreB: round.score_b,
        winnerTeamId,
      };
    })
    .filter((r): r is RoundResult => r !== null)
    .sort((a, b) => (a.roundNumber !== b.roundNumber ? a.roundNumber - b.roundNumber : a.court - b.court));
}

export interface PlayerMatchStats {
  name: string;
  teamId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

// Per-player analytics for the results/leaderboard screen — matches
// played/won/lost and point differential across every scored round they
// appeared in, regardless of stage (a player's tournament-wide record,
// not scoped to one stage — stage scoping is what computeTeamChampionshipStandings
// is for).
export function computePlayerStats(rounds: RoundRow[], teams: SquadSet): PlayerMatchStats[] {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const stats = new Map<string, PlayerMatchStats>();
  for (const t of teams) {
    for (const p of t.players) {
      stats.set(p, { name: p, teamId: t.id, matchesPlayed: 0, wins: 0, losses: 0, winPct: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 });
    }
  }

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null || round.score_a === round.score_b) continue;
    const aWon = round.score_a > round.score_b;
    for (const p of round.team_a) {
      const s = stats.get(p);
      if (!s) continue;
      s.matchesPlayed++;
      s.pointsFor += round.score_a;
      s.pointsAgainst += round.score_b;
      if (aWon) s.wins++;
      else s.losses++;
    }
    for (const p of round.team_b) {
      const s = stats.get(p);
      if (!s) continue;
      s.matchesPlayed++;
      s.pointsFor += round.score_b;
      s.pointsAgainst += round.score_a;
      if (aWon) s.losses++;
      else s.wins++;
    }
  }

  const result = [...stats.values()];
  for (const s of result) {
    s.winPct = s.matchesPlayed > 0 ? s.wins / s.matchesPlayed : 0;
    s.pointDiff = s.pointsFor - s.pointsAgainst;
  }
  return result;
}

// MVP = most wins, tie-broken by win% then point differential — simple,
// explainable criteria a captain can verify by eye against the leaderboard
// rather than an opaque score. Returns null if nobody has played yet.
export function computeMVP(stats: PlayerMatchStats[]): PlayerMatchStats | null {
  const played = stats.filter(s => s.matchesPlayed > 0);
  if (played.length === 0) return null;
  return [...played].sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || b.pointDiff - a.pointDiff)[0];
}

// One MVP per team, same criteria as the overall MVP — for "best player on
// each side" alongside the single tournament-wide MVP.
export function computeTeamMVPs(stats: PlayerMatchStats[], teams: SquadSet): Map<string, PlayerMatchStats | null> {
  const result = new Map<string, PlayerMatchStats | null>();
  for (const t of teams) {
    const teamStats = stats.filter(s => s.teamId === t.id);
    result.set(t.id, computeMVP(teamStats));
  }
  return result;
}

export interface HeadToHeadRecord {
  playerA: string;
  playerB: string;
  aWins: number;
  bWins: number;
  meetings: number;
}

// Individual cross-team rivalries — not pair-vs-pair (the fixed 2-person
// partnerships that share a court), but every individual player-vs-player
// matchup that occurs whenever their teams meet. A round with
// team_a=[a1,a2] vs team_b=[b1,b2] produces 4 individual results: a1-b1,
// a1-b2, a2-b1, a2-b2. Only meaningful for pairs who've actually faced
// each other more than once (see caller for the >=2 meetings filter this
// bracket structure doesn't guarantee) — a single meeting isn't a
// "rivalry," it's just a match.
export function computeHeadToHead(rounds: RoundRow[], teams: SquadSet): HeadToHeadRecord[] {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const records = new Map<string, HeadToHeadRecord>();
  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null || round.score_a === round.score_b) continue;
    const aWon = round.score_a > round.score_b;
    for (const pA of round.team_a) {
      for (const pB of round.team_b) {
        const [first, second] = [pA, pB].sort();
        const key = `${first}|${second}`;
        if (!records.has(key)) {
          records.set(key, { playerA: first, playerB: second, aWins: 0, bWins: 0, meetings: 0 });
        }
        const rec = records.get(key)!;
        rec.meetings++;
        const firstWon = (first === pA && aWon) || (first === pB && !aWon);
        if (firstWon) rec.aWins++;
        else rec.bWins++;
      }
    }
  }
  return [...records.values()].sort((a, b) => b.meetings - a.meetings || Math.abs(b.aWins - b.bWins) - Math.abs(a.aWins - a.bWins));
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

  // A blank slot ('') means "not filled in yet," not a real player — this
  // matters a lot for manual/blank-started entry (Start Manual Entry),
  // where every round begins as ['',''] on both sides. Without this guard,
  // every blank round would count as the SAME "player" ('') repeatedly
  // partnering itself, flooding the warnings list with noise before the
  // captain has entered a single real name. A pair only counts once BOTH
  // of its slots are filled.
  const isCompletePair = (team: readonly [string, string]) => team[0] !== '' && team[1] !== '';

  // Play-count balancing ("every player plays 3, rests 2, per session") is
  // a per-stage rule — unchanged, checked per stage below.
  for (const stage of stages) {
    const stageRounds = rounds.filter(r => r.roundNumber >= stage.roundStart && r.roundNumber <= stage.roundEnd);
    const roundsInStage = stage.roundEnd - stage.roundStart + 1;

    const playCounts = new Map<string, number>();
    for (const t of teams) for (const p of t.players) playCounts.set(p, 0);

    for (const r of stageRounds) {
      for (const team of [r.teamA, r.teamB]) {
        if (!isCompletePair(team)) continue;
        for (const p of team) playCounts.set(p, (playCounts.get(p) ?? 0) + 1);
      }
    }

    // Only warn once the whole stage is actually filled in — a stage still
    // being entered (manual or partially hand-edited) naturally has uneven
    // counts by definition, that's not a real imbalance to flag yet.
    // stageRounds is one row per court-round slot, not per round number —
    // courtCount * roundsInStage is the real expected row count.
    const stageFullyFilled =
      stageRounds.length >= courtCount * roundsInStage && stageRounds.every(r => isCompletePair(r.teamA) && isCompletePair(r.teamB));
    if (stageFullyFilled) {
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
        if (!isCompletePair(team)) continue;
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
  const everyPairComplete = rounds.every(r => isCompletePair(r.teamA) && isCompletePair(r.teamB));
  if (totalConfiguredRounds > 0 && distinctRoundNumbers >= totalConfiguredRounds && everyPairComplete) {
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

// ---------------------------------------------------------------------
// Awards — every category below is derived purely from `rounds` (and
// rapid_fire_log for the two Rapid Fire ones). None of these invent new
// tracking; they're different lenses on data already collected.
// ---------------------------------------------------------------------

export interface DuoRecord {
  playerA: string;
  playerB: string;
  teamId: string;
  wins: number;
  losses: number;
  matchesTogether: number;
}

// A DUO is the 2-person partnership sharing a court (same side), not the
// cross-team individual matchups computeHeadToHead tracks. "Best Duo"
// needs a minimum-matches floor (2, passed by the caller) so a single
// lucky pairing doesn't outrank a partnership that's proven itself
// repeatedly — see the caller for the actual threshold applied.
export function computeDuoRecords(rounds: RoundRow[], teams: SquadSet): DuoRecord[] {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const records = new Map<string, DuoRecord>();
  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null || round.score_a === round.score_b) continue;
    const aWon = round.score_a > round.score_b;
    for (const [pair, won] of [
      [round.team_a, aWon],
      [round.team_b, !aWon],
    ] as [[string, string], boolean][]) {
      const [first, second] = [...pair].sort();
      const teamId = squadOfPlayer.get(first) ?? '';
      const key = `${first}|${second}`;
      if (!records.has(key)) records.set(key, { playerA: first, playerB: second, teamId, wins: 0, losses: 0, matchesTogether: 0 });
      const rec = records.get(key)!;
      rec.matchesTogether++;
      if (won) rec.wins++;
      else rec.losses++;
    }
  }
  return [...records.values()].sort((a, b) => b.wins / b.matchesTogether - a.wins / a.matchesTogether || b.matchesTogether - a.matchesTogether);
}

export interface StreakInfo {
  name: string;
  longestWinStreak: number;
  longestLossStreak: number;
}

// Consecutive results in round-number order (court as tiebreak for same
// round number) — a player who sits out a round simply has no entry for
// it and the streak continues across the gap, since "streak" here means
// "of matches actually played," not "of consecutive round numbers."
export function computeStreaks(rounds: RoundRow[], teams: SquadSet): StreakInfo[] {
  const sorted = [...rounds]
    .filter(r => r.score_a !== null && r.score_b !== null && r.score_a !== r.score_b)
    .sort((a, b) => (a.round_number !== b.round_number ? a.round_number - b.round_number : a.court - b.court));

  const results = new Map<string, boolean[]>();
  for (const t of teams) for (const p of t.players) results.set(p, []);

  for (const round of sorted) {
    const aWon = round.score_a! > round.score_b!;
    for (const p of round.team_a) results.get(p)?.push(aWon);
    for (const p of round.team_b) results.get(p)?.push(!aWon);
  }

  return [...results.entries()].map(([name, outcomes]) => {
    let longestWin = 0;
    let longestLoss = 0;
    let currentWin = 0;
    let currentLoss = 0;
    for (const won of outcomes) {
      if (won) {
        currentWin++;
        currentLoss = 0;
      } else {
        currentLoss++;
        currentWin = 0;
      }
      longestWin = Math.max(longestWin, currentWin);
      longestLoss = Math.max(longestLoss, currentLoss);
    }
    return { name, longestWinStreak: longestWin, longestLossStreak: longestLoss };
  });
}

export interface MatchMargin {
  roundNumber: number;
  court: number;
  stageLabel: string;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number;
  scoreB: number;
  margin: number;
}

// Biggest Blowout = max margin, Nail-Biter = min margin — same underlying
// list, caller picks the end. A margin-1 finish reads as a golden-point
// nail-biter regardless of which scoring rule was in effect.
export function computeMatchMargins(rounds: RoundRow[], stages: StageConfig[]): MatchMargin[] {
  return rounds
    .filter((r): r is RoundRow & { score_a: number; score_b: number } => r.score_a !== null && r.score_b !== null && r.score_a !== r.score_b)
    .map(r => {
      const stage = stageForRound(r.round_number, stages);
      return {
        roundNumber: r.round_number,
        court: r.court,
        stageLabel: stage?.stageLabel ?? '',
        teamA: r.team_a,
        teamB: r.team_b,
        scoreA: r.score_a,
        scoreB: r.score_b,
        margin: Math.abs(r.score_a - r.score_b),
      };
    })
    .filter(m => m.stageLabel !== '');
}

// Win% within just the LAST configured stage (highest points-per-win,
// i.e. Championship) — "showed up when it mattered most." Caller applies
// a minimum-matches floor.
export function computeClutchStats(rounds: RoundRow[], teams: SquadSet, stages: StageConfig[]): PlayerMatchStats[] {
  if (stages.length === 0) return [];
  const lastStage = stages[stages.length - 1];
  const clutchRounds = rounds.filter(r => r.round_number >= lastStage.roundStart && r.round_number <= lastStage.roundEnd);
  return computePlayerStats(clutchRounds, teams);
}

export interface ImprovementInfo {
  name: string;
  firstStageWinPct: number;
  lastStageWinPct: number;
  delta: number;
  firstStageMatches: number;
  lastStageMatches: number;
}

// Win% in the first configured stage vs the last — "Most Improved" is the
// biggest positive delta. Needs matches in BOTH stages to be meaningful;
// caller applies a minimum-matches floor on each side.
export function computeImprovement(rounds: RoundRow[], teams: SquadSet, stages: StageConfig[]): ImprovementInfo[] {
  if (stages.length < 2) return [];
  const firstStage = stages[0];
  const lastStage = stages[stages.length - 1];
  const firstStats = computePlayerStats(rounds.filter(r => r.round_number >= firstStage.roundStart && r.round_number <= firstStage.roundEnd), teams);
  const lastStats = computePlayerStats(rounds.filter(r => r.round_number >= lastStage.roundStart && r.round_number <= lastStage.roundEnd), teams);
  const lastByName = new Map(lastStats.map(s => [s.name, s]));

  return firstStats.map(first => {
    const last = lastByName.get(first.name);
    return {
      name: first.name,
      firstStageWinPct: first.winPct,
      lastStageWinPct: last?.winPct ?? 0,
      delta: (last?.winPct ?? 0) - first.winPct,
      firstStageMatches: first.matchesPlayed,
      lastStageMatches: last?.matchesPlayed ?? 0,
    };
  });
}

export interface RapidFireContribution {
  name: string;
  pointsCredited: number;
}

// "Rapid Fire Hero" = on court the most times their OWN team scored (not
// just on court in general — an opponent on court when the other team
// scores gets no credit). "Finisher" is separate (see
// computeRapidFireFinisher below) — the specific player on court for the
// winning point.
export function computeRapidFireContributions(log: RapidFireLogEntry[], teams: SquadSet): RapidFireContribution[] {
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const credit = new Map<string, number>();
  for (const t of teams) for (const p of t.players) credit.set(p, 0);

  for (const entry of log) {
    for (const player of entry.onCourtPlayers) {
      if (squadOfPlayer.get(player) === entry.scoringTeamId) {
        credit.set(player, (credit.get(player) ?? 0) + 1);
      }
    }
  }
  return [...credit.entries()].map(([name, pointsCredited]) => ({ name, pointsCredited }));
}

// The player(s) on court, on the winning team, for the very last logged
// point — the shot that actually ended it.
export function computeRapidFireFinisher(log: RapidFireLogEntry[], state: RapidFireState, teams: SquadSet): string[] {
  if (!state.isComplete || log.length === 0 || state.winnerTeamId === null) return [];
  const squadOfPlayer = new Map<string, string>();
  for (const t of teams) for (const p of t.players) squadOfPlayer.set(p, t.id);

  const lastEntry = log[log.length - 1];
  if (lastEntry.scoringTeamId !== state.winnerTeamId) return [];
  return lastEntry.onCourtPlayers.filter(p => squadOfPlayer.get(p) === state.winnerTeamId);
}
