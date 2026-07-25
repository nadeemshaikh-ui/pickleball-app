// Late Arrivals plan, Item 3 — Scramble, Squad Rivalry (2-squad only),
// Fixed Partners, and Court Swap. King of the Court has no bench mechanism
// to regenerate against (confirmed by reading lib/kingOfCourt.ts — the
// plan's "joins the waiting pool" claim doesn't match the actual code,
// which only ever operates on the previous round's exact player set), so
// it's deliberately left out. Team Championship is out of scope for the
// whole plan.
import { supabase } from './supabase';
import { getSession, getRounds, setAbsentPlayers, type RoundRow } from './db';
import {
  generateScrambleSchedule,
  generateSquadRivalrySchedule,
  generateFixedPartnersSchedule,
  generateCourtBlocksSchedule,
  seededRandom,
  shuffleArray,
  pairKey,
  type ScrambleGenerationLedger,
  type SquadRivalryLedger,
  type FixedPartnersLedger,
  type Squads,
} from './shuffle';
import type { SquadSet } from './squads';

export type ScrambleLedger = ScrambleGenerationLedger;

function groupByRound(rows: RoundRow[]): Map<number, RoundRow[]> {
  const byRound = new Map<number, RoundRow[]>();
  for (const row of rows) {
    if (!byRound.has(row.round_number)) byRound.set(row.round_number, []);
    byRound.get(row.round_number)!.push(row);
  }
  return byRound;
}

// Derived from played-round history rather than tracked/stored — the same
// "derive, don't store" principle the rest of this app's fairness logic
// already uses. `playedRounds` is every court row for every round strictly
// before the regeneration point; sitting_out is identical across every
// court row of the same round (one array per round, duplicated per court
// at insert time), so it's counted once per round number, not once per row.
export function deriveLedger(playedRounds: RoundRow[]): ScrambleLedger {
  const sitOutCounts = new Map<string, number>();
  const partnerCounts = new Map<string, number>();
  const byRound = groupByRound(playedRounds);
  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const lastRoundNumber = roundNumbers[roundNumbers.length - 1];
  const lastSitOut = new Set<string>();

  for (const roundNumber of roundNumbers) {
    const rows = byRound.get(roundNumber)!;
    const sittingOut = rows[0].sitting_out;
    for (const p of sittingOut) {
      sitOutCounts.set(p, (sitOutCounts.get(p) ?? 0) + 1);
      if (roundNumber === lastRoundNumber) lastSitOut.add(p);
    }
    for (const row of rows) {
      const keyA = pairKey(row.team_a[0], row.team_a[1]);
      partnerCounts.set(keyA, (partnerCounts.get(keyA) ?? 0) + 1);
      const keyB = pairKey(row.team_b[0], row.team_b[1]);
      partnerCounts.set(keyB, (partnerCounts.get(keyB) ?? 0) + 1);
    }
  }
  return { sitOutCounts, partnerCounts, lastSitOut };
}

// Never touch the round currently on court: that's either a round with a
// mixed scored/unscored state (someone's mid-match), or the round right
// after the highest fully-attempted one (the round about to be/being
// played, even if nobody has entered a score for it yet). +2 rather than
// +1 is what protects that second case.
export function computeRegenerateFrom(allRounds: RoundRow[]): number {
  const scoredRoundNumbers = allRounds.filter(r => r.score_a !== null || r.score_b !== null).map(r => r.round_number);
  const highestScored = scoredRoundNumbers.length > 0 ? Math.max(...scoredRoundNumbers) : 0;
  return highestScored + 2;
}

// Court Swap's groups are fixed for an entire block — even a round after
// computeRegenerateFrom's safe point can't be touched if it's still inside
// the block containing that point, since regenerating only PART of a block
// would leave some rounds with the old group split and some with a new
// one. This rounds up to the start of the NEXT block entirely.
export function computeRegenerateFromBlock(allRounds: RoundRow[], roundsPerBlock: number): number {
  const fromRound = computeRegenerateFrom(allRounds);
  const currentBlock = Math.ceil(fromRound / roundsPerBlock);
  return currentBlock * roundsPerBlock + 1;
}

function roundsToJson(rounds: { roundNumber: number; courts: { teamA: [string, string]; teamB: [string, string] }[]; sittingOutPerCourt: string[][] }[]) {
  return rounds.flatMap(r =>
    r.courts.map((court, i) => ({
      round_number: r.roundNumber,
      court: i + 1,
      team_a: court.teamA,
      team_b: court.teamB,
      sitting_out: r.sittingOutPerCourt[i],
    }))
  );
}

async function persistRegeneration(
  sessionId: string,
  fromRoundNumber: number,
  expectedRoundCount: number,
  newRoundsJson: ReturnType<typeof roundsToJson>,
  absentPlayers: string[],
  squads: SquadSet | null = null
): Promise<void> {
  const { error } = await supabase.rpc('regenerate_session_rounds', {
    p_session_id: sessionId,
    p_from_round: fromRoundNumber,
    p_expected_round_count: expectedRoundCount,
    p_new_rounds: newRoundsJson,
    p_absent_players: absentPlayers,
    p_squads: squads,
  });
  if (error) throw error;
}

// Regenerates every round from the current regeneration point onward for a
// Scramble session, using the requested absent-players list (attendance
// change and schedule regeneration are one user action, so they're applied
// together) and a fairness ledger derived from what's actually been
// played. The scheduling computation (seeded PRNG, ledger) happens here in
// TypeScript; the persistence step is a single Postgres RPC
// (regenerate_session_rounds, see its migration for why) so the
// delete+insert+round_count+absent_players update is one atomic commit —
// no window where old and new rounds coexist, no partial-failure state to
// reconcile. p_expected_round_count is what makes a stale concurrent call
// (another admin's tab, a double-tap) fail loudly instead of silently
// producing a second conflicting set of "new" rounds.
export async function regenerateScrambleFromRound(sessionId: string, nextAbsentPlayers: string[]): Promise<void> {
  const [session, allRounds] = await Promise.all([getSession(sessionId), getRounds(sessionId)]);
  if (session.format !== 'scramble') {
    throw new Error('Regeneration is only built for Scramble sessions so far.');
  }
  const fromRoundNumber = computeRegenerateFrom(allRounds);
  const oldRoundsToReplace = allRounds.filter(r => r.round_number >= fromRoundNumber);
  if (oldRoundsToReplace.length === 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers);
    return;
  }

  const playedRounds = allRounds.filter(r => r.round_number < fromRoundNumber);
  const ledger = deriveLedger(playedRounds);
  const activePool = session.players.filter(p => !nextAbsentPlayers.includes(p));
  const roundsRemaining = session.round_count - fromRoundNumber + 1;
  if (roundsRemaining <= 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers);
    return;
  }

  const newRounds = generateScrambleSchedule(
    activePool, session.court_labels.length, roundsRemaining, sessionId,
    [], undefined, undefined, fromRoundNumber, ledger
  );
  await persistRegeneration(sessionId, fromRoundNumber, session.round_count, roundsToJson(newRounds), nextAbsentPlayers);
}

// --- Squad Rivalry (2-squad only) --------------------------------------

function deriveSquadLedger(playedRounds: RoundRow[], squads: Squads): SquadRivalryLedger {
  const goldSet = new Set(squads.gold);
  const blackSet = new Set(squads.black);
  const goldSitCounts = new Map<string, number>();
  const blackSitCounts = new Map<string, number>();
  const partnerCounts = new Map<string, number>();
  const byRound = groupByRound(playedRounds);
  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const lastRoundNumber = roundNumbers[roundNumbers.length - 1];
  const lastGoldSitOut = new Set<string>();
  const lastBlackSitOut = new Set<string>();

  for (const roundNumber of roundNumbers) {
    const rows = byRound.get(roundNumber)!;
    const sittingOut = rows[0].sitting_out;
    for (const p of sittingOut) {
      // Relies on the invariant that anyone appearing in round history was
      // a squad member at generation time (squads only ever grow, never
      // shrink, across regenerations) — a player in neither squad here
      // would be silently miscounted as black, so fail loudly instead if
      // that invariant is ever broken by a future change.
      if (!goldSet.has(p) && !blackSet.has(p)) {
        throw new Error(`Player "${p}" appears in round history but isn't in either squad — squad/round data has drifted out of sync.`);
      }
      const target = goldSet.has(p) ? goldSitCounts : blackSitCounts;
      target.set(p, (target.get(p) ?? 0) + 1);
      if (roundNumber === lastRoundNumber) (goldSet.has(p) ? lastGoldSitOut : lastBlackSitOut).add(p);
    }
    for (const row of rows) {
      const keyA = pairKey(row.team_a[0], row.team_a[1]);
      partnerCounts.set(keyA, (partnerCounts.get(keyA) ?? 0) + 1);
      const keyB = pairKey(row.team_b[0], row.team_b[1]);
      partnerCounts.set(keyB, (partnerCounts.get(keyB) ?? 0) + 1);
    }
  }
  return { goldSitCounts, blackSitCounts, partnerCounts, lastGoldSitOut, lastBlackSitOut };
}

// Existing squad members never move. A player returning who was never
// assigned to a squad at all (absent since setup, so never in the
// original split) joins whichever squad is currently smaller — matches
// the plan's rule exactly.
export async function regenerateSquadRivalryFromRound(sessionId: string, nextAbsentPlayers: string[]): Promise<void> {
  const [session, allRounds] = await Promise.all([getSession(sessionId), getRounds(sessionId)]);
  if (session.format !== 'squad_rivalry' || !session.squads || session.squads.length !== 2) {
    throw new Error('Regeneration is only built for 2-squad Squad Rivalry sessions so far.');
  }
  const [squadA, squadB] = session.squads;
  const squads: Squads = { gold: [...squadA.players], black: [...squadB.players] };
  const activePool = session.players.filter(p => !nextAbsentPlayers.includes(p));
  const assigned = new Set([...squads.gold, ...squads.black]);
  let squadsChanged = false;
  for (const p of activePool) {
    if (!assigned.has(p)) {
      if (squads.gold.length <= squads.black.length) squads.gold.push(p);
      else squads.black.push(p);
      assigned.add(p);
      squadsChanged = true;
    }
  }
  const newSquadSet: SquadSet | null = squadsChanged
    ? [{ ...squadA, players: squads.gold }, { ...squadB, players: squads.black }]
    : null;

  const fromRoundNumber = computeRegenerateFrom(allRounds);
  const oldRoundsToReplace = allRounds.filter(r => r.round_number >= fromRoundNumber);
  if (oldRoundsToReplace.length === 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers, newSquadSet ?? undefined);
    return;
  }
  const roundsRemaining = session.round_count - fromRoundNumber + 1;
  if (roundsRemaining <= 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers, newSquadSet ?? undefined);
    return;
  }

  const playedRounds = allRounds.filter(r => r.round_number < fromRoundNumber);
  const ledger = deriveSquadLedger(playedRounds, squads);
  const activeSquads: Squads = {
    gold: squads.gold.filter(p => activePool.includes(p)),
    black: squads.black.filter(p => activePool.includes(p)),
  };
  const activePlayersInSquads = [...activeSquads.gold, ...activeSquads.black];

  const { rounds: newRounds } = generateSquadRivalrySchedule(
    activePlayersInSquads, session.court_labels.length, roundsRemaining, sessionId,
    [], activeSquads, fromRoundNumber, ledger
  );
  await persistRegeneration(sessionId, fromRoundNumber, session.round_count, roundsToJson(newRounds), nextAbsentPlayers, newSquadSet);
}

// --- Fixed Partners -------------------------------------------------

// Teams aren't stored — reconstructed from every played round's team_a/
// team_b (falling back to ALL rounds, including unplayed ones, if nothing
// has been played yet — e.g. round 1 is still in progress). A team that
// never once appears in that history (always sat out) can't be
// recognised and is treated as newly-forming orphans instead — a narrow,
// disclosed limitation rather than silent misassignment.
export function deriveOriginalFixedPartnersTeams(historyRounds: RoundRow[]): [string, string][] {
  const teams = new Map<string, [string, string]>();
  for (const row of historyRounds) {
    teams.set(pairKey(row.team_a[0], row.team_a[1]), row.team_a);
    teams.set(pairKey(row.team_b[0], row.team_b[1]), row.team_b);
  }
  return [...teams.values()];
}

// A team whose members are both still active is preserved untouched. A
// team with one absent member frees its present half as an "orphan," who
// is paired with another orphan (seeded, so this is reproducible, not
// arbitrary) — this is inherently a NEW temporary pairing, so it can't
// carry over the orphan's original sit-out history the way a preserved
// team does (disclosed limitation, not a correctness bug: fairness for a
// re-paired team restarts rather than perfectly continuing). When the
// real partner returns, both are active again next call and the original
// team is preserved again automatically, since this always re-derives
// from the immutable original history, never from the last regeneration's
// temporary pairings.
export function rebuildFixedPartnersTeams(
  originalTeams: [string, string][],
  activePool: string[],
  seed: string
): { teams: [string, string][]; benched: string[] } {
  const activeSet = new Set(activePool);
  const preserved: [string, string][] = [];
  const orphans: string[] = [];
  const considered = new Set<string>();
  for (const [a, b] of originalTeams) {
    considered.add(a);
    considered.add(b);
    const aActive = activeSet.has(a);
    const bActive = activeSet.has(b);
    if (aActive && bActive) preserved.push([a, b]);
    else if (aActive) orphans.push(a);
    else if (bActive) orphans.push(b);
  }
  for (const p of activePool) if (!considered.has(p)) orphans.push(p);

  const shuffledOrphans = shuffleArray(orphans, seededRandom(seed));
  const teams: [string, string][] = [...preserved];
  for (let i = 0; i + 1 < shuffledOrphans.length; i += 2) {
    teams.push([shuffledOrphans[i], shuffledOrphans[i + 1]]);
  }
  const benched = shuffledOrphans.length % 2 === 1 ? [shuffledOrphans[shuffledOrphans.length - 1]] : [];
  return { teams, benched };
}

function deriveFixedPartnersLedger(playedRounds: RoundRow[], teams: [string, string][]): FixedPartnersLedger {
  const sitOutCounts = new Map<string, number>(teams.map(t => [pairKey(t[0], t[1]), 0]));
  const opponentCounts = new Map<string, number>();
  const byRound = groupByRound(playedRounds);
  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const lastRoundNumber = roundNumbers[roundNumbers.length - 1];
  const lastSitOutTeams = new Set<string>();

  for (const roundNumber of roundNumbers) {
    const rows = byRound.get(roundNumber)!;
    const sittingOutPlayers = new Set(rows[0].sitting_out);
    for (const [a, b] of teams) {
      if (sittingOutPlayers.has(a) && sittingOutPlayers.has(b)) {
        const id = pairKey(a, b);
        sitOutCounts.set(id, (sitOutCounts.get(id) ?? 0) + 1);
        if (roundNumber === lastRoundNumber) lastSitOutTeams.add(id);
      }
    }
    for (const row of rows) {
      const idA = pairKey(row.team_a[0], row.team_a[1]);
      const idB = pairKey(row.team_b[0], row.team_b[1]);
      const oppKey = pairKey(idA, idB);
      opponentCounts.set(oppKey, (opponentCounts.get(oppKey) ?? 0) + 1);
    }
  }
  return { sitOutCounts, opponentCounts, lastSitOutTeams };
}

export async function regenerateFixedPartnersFromRound(sessionId: string, nextAbsentPlayers: string[]): Promise<void> {
  const [session, allRounds] = await Promise.all([getSession(sessionId), getRounds(sessionId)]);
  if (session.format !== 'fixed_partners') {
    throw new Error('Regeneration is only built for Fixed Partners sessions so far.');
  }
  const fromRoundNumber = computeRegenerateFrom(allRounds);
  const oldRoundsToReplace = allRounds.filter(r => r.round_number >= fromRoundNumber);
  if (oldRoundsToReplace.length === 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers);
    return;
  }
  const roundsRemaining = session.round_count - fromRoundNumber + 1;
  if (roundsRemaining <= 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers);
    return;
  }

  const playedRounds = allRounds.filter(r => r.round_number < fromRoundNumber);
  const activePool = session.players.filter(p => !nextAbsentPlayers.includes(p));
  const historySource = playedRounds.length > 0 ? playedRounds : allRounds;
  const originalTeams = deriveOriginalFixedPartnersTeams(historySource);
  const { teams, benched } = rebuildFixedPartnersTeams(originalTeams, activePool, `${sessionId}:regen-teams`);
  if (teams.length === 0) {
    throw new Error('Not enough active players to form any team.');
  }

  const ledger = deriveFixedPartnersLedger(playedRounds, teams);
  const playersOnTeams = teams.flat();

  const { rounds: newRounds } = generateFixedPartnersSchedule(
    playersOnTeams, session.court_labels.length, roundsRemaining, sessionId,
    teams, undefined, fromRoundNumber, ledger
  );
  // The odd-orphan bench (if any) isn't part of `playersOnTeams`, so it
  // needs adding to every generated round's sit-out list explicitly —
  // generateFixedPartnersSchedule's own auto-bench path only fires when it
  // forms teams itself, not when manualTeams is supplied. Every court entry
  // in sittingOutPerCourt is the SAME array reference repeated once per
  // court (see the generator's `courts.map(() => sittingOutPlayers)`) — a
  // per-court mutation loop would push the benched name once per court
  // into that one shared array. Replace with a single fresh array instead.
  if (benched.length > 0) {
    for (const round of newRounds) {
      const withBench = [...round.sittingOutPerCourt[0], ...benched];
      round.sittingOutPerCourt = round.sittingOutPerCourt.map(() => withBench);
    }
  }
  await persistRegeneration(sessionId, fromRoundNumber, session.round_count, roundsToJson(newRounds), nextAbsentPlayers);
}

// --- Court Swap -------------------------------------------------

export async function regenerateCourtBlocksFromRound(sessionId: string, nextAbsentPlayers: string[]): Promise<void> {
  const [session, allRounds] = await Promise.all([getSession(sessionId), getRounds(sessionId)]);
  if (session.format !== 'court_blocks' || !session.rounds_per_block) {
    throw new Error('Regeneration is only built for Court Swap sessions so far.');
  }
  const roundsPerBlock = session.rounds_per_block;
  const fromRoundNumber = computeRegenerateFromBlock(allRounds, roundsPerBlock);
  const oldRoundsToReplace = allRounds.filter(r => r.round_number >= fromRoundNumber);
  if (oldRoundsToReplace.length === 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers);
    return;
  }
  const roundsRemaining = session.round_count - fromRoundNumber + 1;
  if (roundsRemaining <= 0) {
    await setAbsentPlayers(sessionId, session.players, nextAbsentPlayers);
    return;
  }
  if (roundsRemaining % roundsPerBlock !== 0) {
    throw new Error('Court Swap regeneration point is not aligned to a block boundary — this is a bug, not a user error.');
  }

  const activePool = session.players.filter(p => !nextAbsentPlayers.includes(p));
  const startBlock = Math.floor((fromRoundNumber - 1) / roundsPerBlock) + 1;
  const blockCount = roundsRemaining / roundsPerBlock;

  // KNOWN LIMITATION, disclosed rather than silently accepted: a normal
  // (non-regenerated) run threads groupTogetherCounts through every block
  // in the whole session, so group-repeat avoidance is cumulative across
  // the full night. Regeneration starts this fresh instead of reconstructing
  // it from played-round history — a pairing already avoided earlier in the
  // night could recur in the first regenerated block. This is a fairness
  // rough edge, not a correctness/crash bug (every other invariant —
  // block-boundary safety, player accounting — still holds), and reusing
  // group history would need scanning every played round's team_a/team_b to
  // infer group membership, which under-counts pairs who shared a group but
  // never shared a COURT within it (e.g. both sat out the same round). Not
  // fixed here; flag if this becomes a real user complaint.
  const { rounds: newRounds } = generateCourtBlocksSchedule(
    activePool, session.court_labels.length, roundsPerBlock, blockCount, sessionId,
    undefined, [], startBlock
  );
  await persistRegeneration(sessionId, fromRoundNumber, session.round_count, roundsToJson(newRounds), nextAbsentPlayers);
}
