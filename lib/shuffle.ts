// Deterministic PRNG (mulberry32) seeded by a string hash, so a given
// session id always produces the same "random-looking" schedule.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return function mulberry32() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CourtMatch {
  teamA: [string, string];
  teamB: [string, string];
}

// One entry in `courts`/`sittingOutPerCourt` per active court — any number
// of courts is supported, not just 2.
export interface ScrambleRound {
  roundNumber: number;
  courts: CourtMatch[];
  sittingOutPerCourt: string[][];
}

export function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

// Picks `count` players to sit out this round, prioritizing whoever has sat
// out the fewest times so far (balances sit-outs across the whole schedule).
// Players who sat out last round are pushed to the back of the line so the
// same person doesn't rest two rounds in a row — unless there aren't enough
// other players to fill `count` without them, in which case a repeat is
// unavoidable and allowed.
export function pickSitOuts(
  pool: string[],
  sitCounts: Map<string, number>,
  count: number,
  rand: () => number,
  lastSitOut: ReadonlySet<string> = new Set()
): string[] {
  if (count <= 0) return [];
  const tieBreakers = new Map(pool.map(p => [p, rand()]));
  const sorted = [...pool].sort((a, b) => {
    const diff = (sitCounts.get(a) ?? 0) - (sitCounts.get(b) ?? 0);
    return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
  });
  const eligible = sorted.filter(p => !lastSitOut.has(p));
  const repeats = sorted.filter(p => lastSitOut.has(p));
  const chosen = [...eligible, ...repeats].slice(0, count);
  for (const p of chosen) sitCounts.set(p, (sitCounts.get(p) ?? 0) + 1);
  return chosen;
}

export interface TimeScopedLockedPair {
  playerA: string;
  playerB: string;
  startRound?: number;
  endRound?: number;
}

export type LockedPair = [string, string] | TimeScopedLockedPair;

export function normalizeLockedPair(lp: LockedPair): { playerA: string; playerB: string; startRound: number; endRound: number } {
  if (Array.isArray(lp)) {
    return { playerA: lp[0], playerB: lp[1], startRound: 1, endRound: Infinity };
  }
  return {
    playerA: lp.playerA,
    playerB: lp.playerB,
    startRound: lp.startRound ?? 1,
    endRound: lp.endRound ?? Infinity,
  };
}

export function isLockActiveInRound(lp: LockedPair, roundNumber: number): boolean {
  const norm = normalizeLockedPair(lp);
  return roundNumber >= norm.startRound && roundNumber <= norm.endRound;
}

export function getActiveLockedPairsForRound(lockedPairs: LockedPair[], roundNumber: number): [string, string][] {
  const active: [string, string][] = [];
  for (const lp of lockedPairs) {
    if (isLockActiveInRound(lp, roundNumber)) {
      const norm = normalizeLockedPair(lp);
      active.push([norm.playerA, norm.playerB]);
    }
  }
  return active;
}

export function getAllLockedPairsTuples(lockedPairs: LockedPair[]): [string, string][] {
  return lockedPairs.map(lp => {
    const norm = normalizeLockedPair(lp);
    return [norm.playerA, norm.playerB];
  });
}

// Rejects overlapping locks (a player in two locked pairs in the same round)
// and pairs referencing players who aren't in the roster.
export function validateLockedPairs(players: string[], lockedPairs: LockedPair[], totalRounds?: number): void {
  for (const lp of lockedPairs) {
    const { playerA: a, playerB: b } = normalizeLockedPair(lp);
    if (a === b) throw new Error('A locked pair cannot be the same player twice.');
    if (!players.includes(a) || !players.includes(b)) {
      throw new Error(`Locked pair references a player not in the roster: ${a} & ${b}`);
    }
  }

  const maxRoundsToCheck = totalRounds ?? 100;
  for (let r = 1; r <= maxRoundsToCheck; r++) {
    const activeThisRound = getActiveLockedPairsForRound(lockedPairs, r);
    const seenThisRound = new Set<string>();
    for (const [a, b] of activeThisRound) {
      if (seenThisRound.has(a) || seenThisRound.has(b)) {
        throw new Error(`Player ${seenThisRound.has(a) ? a : b} appears in more than one locked pair in round ${r}.`);
      }
      seenThisRound.add(a);
      seenThisRound.add(b);
    }
  }
}

// A sit-out "unit" is either one player, or a locked pair that must always
// sit together or play together, never split.
interface SitOutUnit {
  players: string[];
  key: string;
}

export function buildSitOutUnits(pool: string[], lockedPairs: LockedPair[]): SitOutUnit[] {
  const partnerOf = new Map<string, string>();
  for (const lp of lockedPairs) {
    const [a, b] = Array.isArray(lp) ? lp : [lp.playerA, lp.playerB];
    partnerOf.set(a, b);
    partnerOf.set(b, a);
  }
  const seen = new Set<string>();
  const units: SitOutUnit[] = [];
  for (const p of pool) {
    if (seen.has(p)) continue;
    const partner = partnerOf.get(p);
    if (partner && pool.includes(partner)) {
      const pair = [p, partner].sort();
      units.push({ players: pair, key: pairKey(p, partner) });
      seen.add(p);
      seen.add(partner);
    } else {
      units.push({ players: [p], key: p });
      seen.add(p);
    }
  }
  return units;
}

// Same balancing goal as pickSitOuts (fewest sits so far, no back-to-back),
// but operating on units so a locked pair is never split by the sit-out
// rotation. Throws if the unit sizes present can't sum to exactly
// `playerSitOutCount` — rare (needs heavy lock usage with an awkward
// leftover count), but silently over/under-sitting would break the court
// fill, so it's a loud error instead.
export function pickSitOutUnits(
  units: SitOutUnit[],
  sitCounts: Map<string, number>,
  playerSitOutCount: number,
  rand: () => number,
  lastSitOutPlayers: ReadonlySet<string>
): string[] {
  if (playerSitOutCount <= 0) return [];
  const tieBreakers = new Map(units.map(u => [u.key, rand()]));
  const score = (u: SitOutUnit) => u.players.reduce((sum, p) => sum + sitCounts.get(p)!, 0) / u.players.length;
  const sorted = [...units].sort((a, b) => {
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    const aRepeat = a.players.some(p => lastSitOutPlayers.has(p));
    const bRepeat = b.players.some(p => lastSitOutPlayers.has(p));
    if (aRepeat !== bRepeat) return aRepeat ? 1 : -1;
    return tieBreakers.get(a.key)! - tieBreakers.get(b.key)!;
  });

  const chosen: string[] = [];
  let remaining = playerSitOutCount;
  for (const u of sorted) {
    if (u.players.length <= remaining) {
      chosen.push(...u.players);
      remaining -= u.players.length;
      if (remaining === 0) break;
    }
  }
  if (remaining !== 0) {
    throw new Error(
      "Can't balance sit-outs with these locked pairs — try locking fewer pairs or adjusting player count."
    );
  }
  for (const p of chosen) sitCounts.set(p, sitCounts.get(p)! + 1);
  return chosen;
}

// Greedily pairs an even-sized pool into players.length/2 teams of 2,
// minimizing repeat partnerships based on the running partnerCounts map.
// Locked pairs (if both members are in `players`) are seated first as a
// fixed team before the rest are greedily matched.
export function pairIntoPairs(
  players: string[],
  partnerCounts: Map<string, number>,
  rand: () => number,
  lockedPairs: LockedPair[] = []
): [string, string][] {
  const pool = shuffleArray(players, rand);
  const used = new Set<string>();
  const teams: [string, string][] = [];

  for (const lp of lockedPairs) {
    const { playerA: a, playerB: b } = normalizeLockedPair(lp);
    if (pool.includes(a) && pool.includes(b)) {
      teams.push([a, b]);
      used.add(a);
      used.add(b);
      const key = pairKey(a, b);
      partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1);
    }
  }

  for (const p of pool) {
    if (used.has(p)) continue;
    let bestPartner: string | null = null;
    let bestCount = Infinity;
    for (const q of pool) {
      if (q === p || used.has(q)) continue;
      const count = partnerCounts.get(pairKey(p, q)) ?? 0;
      if (count < bestCount) {
        bestCount = count;
        bestPartner = q;
      }
    }
    if (bestPartner) {
      teams.push([p, bestPartner]);
      used.add(p);
      used.add(bestPartner);
      const key = pairKey(p, bestPartner);
      partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1);
    }
  }

  return teams;
}

// Pairs courtCount*4 players into courtCount matches (2 teams of 2 each).
function pairIntoNTeams(
  players: string[],
  courtCount: number,
  partnerCounts: Map<string, number>,
  rand: () => number,
  lockedPairs: LockedPair[] = [],
  rivalryHeatMap?: Map<string, RivalryHeat>
): CourtMatch[] {
  const teams = pairIntoPairs(players, partnerCounts, rand, lockedPairs);
  if (rivalryHeatMap) {
    return assignCourtsByRivalry(teams, rivalryHeatMap, courtCount, rand);
  }
  const courts: CourtMatch[] = [];
  for (let c = 0; c < courtCount; c++) {
    courts.push({ teamA: teams[c * 2], teamB: teams[c * 2 + 1] });
  }
  return courts;
}

// Forms courtCount*2 balanced-strength teams from a rating map (unrated
// players should already be filled in with the pool median by the caller).
// Greedy multiway partition: sort by rating desc, always add the next
// player to whichever in-progress team has fewest members (so all fill to
// 2 evenly), tie-broken by lowest running sum — a standard, simple
// heuristic for balanced partitioning at this scale.
function formSkillBalancedTeams(players: string[], ratings: Map<string, number>, teamCount: number): [string, string][] {
  const sorted = [...players].sort((a, b) => ratings.get(b)! - ratings.get(a)!);
  const teams: { members: string[]; sum: number }[] = Array.from({ length: teamCount }, () => ({ members: [], sum: 0 }));
  for (const p of sorted) {
    let best = teams[0];
    for (const t of teams) {
      if (t.members.length < 2 && (t.members.length < best.members.length || (t.members.length === best.members.length && t.sum < best.sum))) {
        best = t;
      }
    }
    best.members.push(p);
    best.sum += ratings.get(p)!;
  }
  return teams.map(t => [t.members[0], t.members[1]] as [string, string]);
}

// Pairs the balanced teams into courts so opposing teams on the same court
// are as close in combined rating as possible — sort teams by sum, pair
// adjacent ones.
function assignCourtsBySkill(teams: [string, string][], ratings: Map<string, number>, courtCount: number): CourtMatch[] {
  const teamSum = (t: [string, string]) => ratings.get(t[0])! + ratings.get(t[1])!;
  const sorted = [...teams].sort((a, b) => teamSum(a) - teamSum(b));
  const courts: CourtMatch[] = [];
  for (let c = 0; c < courtCount; c++) {
    courts.push({ teamA: sorted[c * 2], teamB: sorted[c * 2 + 1] });
  }
  return courts;
}

// Rivalry-aware court assignment — opt-in, Scramble only. Teams are formed
// exactly as normal (pairIntoPairs, untouched — partner-repeat-minimization
// and locked pairs both still apply). This only changes the FINAL step:
// which two teams share a court. Currently that step has zero test coverage
// of a specific pairing order (only "each round has courtCount*4 unique
// playing players" is asserted), so this is additive, not a behavior change
// to anything already locked in.
export interface RivalryHeat {
  gap: number; // |winsA - winsB| between the pair — smaller = closer rivalry
  games: number; // tiebreaker — more games together = more established
}

export function buildRivalryHeatMap(
  rivalries: { players: [string, string]; record: [number, number]; gamesTogether: number; provisional: boolean }[]
): Map<string, RivalryHeat> {
  const map = new Map<string, RivalryHeat>();
  for (const r of rivalries) {
    if (r.provisional) continue; // not enough games together to count as an established rivalry
    map.set(pairKey(r.players[0], r.players[1]), { gap: Math.abs(r.record[0] - r.record[1]), games: r.gamesTogether });
  }
  return map;
}

// The "heat" of a potential matchup between two teams = the hottest single
// rivalry among the 4 cross-team player pairs (smallest gap), since even one
// close rivalry on court makes the matchup exciting — averaging across all 4
// would dilute a strong rivalry with two strangers' zero-history pair. Null
// when none of the 4 cross-pairs have rivalry data — no bias either way.
function matchupHeat(teamA: [string, string], teamB: [string, string], heatMap: Map<string, RivalryHeat>): RivalryHeat | null {
  let best: RivalryHeat | null = null;
  for (const a of teamA) {
    for (const b of teamB) {
      const heat = heatMap.get(pairKey(a, b));
      if (heat && (!best || heat.gap < best.gap || (heat.gap === best.gap && heat.games > best.games))) {
        best = heat;
      }
    }
  }
  return best;
}

// Greedily pairs teams into courts, court by court, always matching the next
// unassigned team with whichever remaining team produces the hottest
// matchup. Shuffled first so that when no rivalry data applies, assignment
// still varies session to session rather than always following team order.
// Falls back to plain (still randomized) pairing when no rivalry data
// exists at all — graceful no-op for a group with too little history yet.
export function assignCourtsByRivalry(
  teams: [string, string][],
  heatMap: Map<string, RivalryHeat>,
  courtCount: number,
  rand: () => number
): CourtMatch[] {
  const remaining = shuffleArray(teams, rand);
  const courts: CourtMatch[] = [];
  for (let c = 0; c < courtCount; c++) {
    const anchor = remaining.shift();
    if (!anchor || remaining.length === 0) break;
    let bestIndex = 0;
    let best: RivalryHeat | null = null;
    for (let i = 0; i < remaining.length; i++) {
      const heat = matchupHeat(anchor, remaining[i], heatMap);
      if (heat && (!best || heat.gap < best.gap || (heat.gap === best.gap && heat.games > best.games))) {
        best = heat;
        bestIndex = i;
      }
    }
    const opponent = remaining.splice(bestIndex, 1)[0];
    courts.push({ teamA: anchor, teamB: opponent });
  }
  return courts;
}

// A session is only genuinely unplayable below 4 people (can't fill even one
// court). Anything from 4 up degrades the court count instead of throwing —
// see resolveCourtCount.
function requireMinPlayers(players: string[], formatName: string): void {
  if (players.length < 4) {
    throw new Error(`${formatName} needs at least 4 players to play, got ${players.length}`);
  }
}

// Shrinks the requested court count to whatever the roster can actually
// fill (4 players per court), rather than letting a short-handed night
// crash the schedule generator. Never returns less than 1 — requireMinPlayers
// is what rejects a session that's unplayable outright (<4 total).
export function resolveCourtCount(playerCount: number, requestedCourts: number): number {
  return Math.max(1, Math.min(requestedCourts, Math.floor(playerCount / 4)));
}

// Shared with lib/regenerate.ts's ScrambleLedger (re-exported from there,
// same shape) rather than each file declaring its own copy — a field added
// to one without the other wouldn't be caught by tsc at the call site,
// since a variable (not an object literal) is passed, so excess-property
// checking doesn't apply.
export interface ScrambleGenerationLedger {
  sitOutCounts: Map<string, number>;
  partnerCounts: Map<string, number>;
  lastSitOut: Set<string>;
}

export function generateScrambleSchedule(
  players: string[],
  requestedCourtCount: number,
  roundCount: number,
  seed: string,
  lockedPairs: LockedPair[] = [],
  skillRatings?: Map<string, number>,
  rivalryHeatMap?: Map<string, RivalryHeat>,
  startRound: number = 1,
  initialLedger?: ScrambleGenerationLedger
): ScrambleRound[] & { courtCount: number } {
  requireMinPlayers(players, 'Scramble');
  validateLockedPairs(players, lockedPairs, roundCount);
  if (skillRatings && lockedPairs.length > 0) {
    throw new Error('Skill-balanced matchmaking cannot be combined with locked partners yet.');
  }
  if (skillRatings && rivalryHeatMap) {
    throw new Error('Skill-balanced and rivalry-aware matchmaking cannot be combined yet.');
  }
  const courtCount = resolveCourtCount(players.length, requestedCourtCount);
  const sitOutCounts = new Map<string, number>(initialLedger?.sitOutCounts ?? []);
  for (const p of players) if (!sitOutCounts.has(p)) sitOutCounts.set(p, 0);
  const partnerCounts = new Map<string, number>(initialLedger?.partnerCounts ?? []);
  const sitOutCount = players.length - courtCount * 4;
  const rounds: ScrambleRound[] = [];
  let lastSitOut = initialLedger?.lastSitOut ?? new Set<string>();

  for (let i = 0; i < roundCount; i++) {
    const roundNumber = startRound + i;
    const rand = seededRandom(`${seed}:r${roundNumber}`);
    const activeLocks = getActiveLockedPairsForRound(lockedPairs, roundNumber);
    const sittingOut =
      activeLocks.length > 0
        ? pickSitOutUnits(buildSitOutUnits(players, activeLocks), sitOutCounts, sitOutCount, rand, lastSitOut)
        : pickSitOuts(players, sitOutCounts, sitOutCount, rand, lastSitOut);
    const playing = players.filter(p => !sittingOut.includes(p));
    const courts = skillRatings
      ? assignCourtsBySkill(formSkillBalancedTeams(playing, skillRatings, courtCount * 2), skillRatings, courtCount)
      : pairIntoNTeams(playing, courtCount, partnerCounts, rand, activeLocks, rivalryHeatMap);
    rounds.push({ roundNumber, courts, sittingOutPerCourt: courts.map(() => sittingOut) });
    lastSitOut = new Set(sittingOut);
  }

  return Object.assign(rounds, { courtCount });
}

export interface Squads {
  gold: string[];
  black: string[];
}

export interface SquadRivalrySchedule {
  squads: Squads;
  rounds: ScrambleRound[];
  courtCount: number;
}

function splitIntoSquadsRespectingLocks(players: string[], lockedPairs: LockedPair[], rand: () => number): Squads {
  const units = buildSitOutUnits(players, lockedPairs);
  const pairUnits = shuffleArray(units.filter(u => u.players.length === 2), rand);
  const singleUnits = shuffleArray(units.filter(u => u.players.length === 1), rand);
  const gold: string[] = [];
  const black: string[] = [];
  for (const u of [...pairUnits, ...singleUnits]) {
    if (gold.length <= black.length) gold.push(...u.players);
    else black.push(...u.players);
  }
  if (Math.abs(gold.length - black.length) > 1) {
    throw new Error(
      "Can't split into 2 balanced squads with these locked pairs — try locking fewer pairs or adjusting player count."
    );
  }
  return { gold, black };
}

export interface SquadRivalryLedger {
  goldSitCounts: Map<string, number>;
  blackSitCounts: Map<string, number>;
  partnerCounts: Map<string, number>;
  lastGoldSitOut: Set<string>;
  lastBlackSitOut: Set<string>;
}

export function generateSquadRivalrySchedule(
  players: string[],
  requestedCourtCount: number,
  roundCount: number,
  seed: string,
  lockedPairs: LockedPair[] = [],
  manualSquads?: Squads,
  startRound: number = 1,
  initialLedger?: SquadRivalryLedger
): SquadRivalrySchedule & { courtCount: number } {
  requireMinPlayers(players, 'Squad Rivalry');
  if (manualSquads) {
    const assigned = new Set([...manualSquads.gold, ...manualSquads.black]);
    if (assigned.size !== players.length || players.some(p => !assigned.has(p))) {
      throw new Error('Manual squads must include every player exactly once.');
    }
  }
  validateLockedPairs(players, lockedPairs, roundCount);
  const squads: Squads =
    manualSquads ??
    (lockedPairs.length > 0
      ? splitIntoSquadsRespectingLocks(players, lockedPairs, seededRandom(seed))
      : (() => {
          const shuffled = shuffleArray(players, seededRandom(seed));
          const goldSize = Math.ceil(players.length / 2);
          return { gold: shuffled.slice(0, goldSize), black: shuffled.slice(goldSize) };
        })());

  const courtCount = resolveCourtCount(Math.min(squads.gold.length, squads.black.length) * 2, requestedCourtCount);
  const goldSitCounts = new Map<string, number>(initialLedger?.goldSitCounts ?? []);
  for (const p of squads.gold) if (!goldSitCounts.has(p)) goldSitCounts.set(p, 0);
  const blackSitCounts = new Map<string, number>(initialLedger?.blackSitCounts ?? []);
  for (const p of squads.black) if (!blackSitCounts.has(p)) blackSitCounts.set(p, 0);
  const partnerCounts = new Map<string, number>(initialLedger?.partnerCounts ?? []);
  const goldSitOutCount = squads.gold.length - courtCount * 2;
  const blackSitOutCount = squads.black.length - courtCount * 2;
  if (goldSitOutCount < 0 || blackSitOutCount < 0) {
    throw new Error(`Squad Rivalry needs at least ${courtCount * 2} players per squad for ${courtCount} court(s).`);
  }

  const rounds: ScrambleRound[] = [];
  let lastGoldSitOut = initialLedger?.lastGoldSitOut ?? new Set<string>();
  let lastBlackSitOut = initialLedger?.lastBlackSitOut ?? new Set<string>();
  for (let i = 0; i < roundCount; i++) {
    const roundNumber = startRound + i;
    const rand = seededRandom(`${seed}:r${roundNumber}`);
    const activeLocks = getActiveLockedPairsForRound(lockedPairs, roundNumber);
    const goldSitOut =
      activeLocks.length > 0
        ? pickSitOutUnits(buildSitOutUnits(squads.gold, activeLocks), goldSitCounts, goldSitOutCount, rand, lastGoldSitOut)
        : pickSitOuts(squads.gold, goldSitCounts, goldSitOutCount, rand, lastGoldSitOut);
    const blackSitOut =
      activeLocks.length > 0
        ? pickSitOutUnits(buildSitOutUnits(squads.black, activeLocks), blackSitCounts, blackSitOutCount, rand, lastBlackSitOut)
        : pickSitOuts(squads.black, blackSitCounts, blackSitOutCount, rand, lastBlackSitOut);
    const goldPlaying = squads.gold.filter(p => !goldSitOut.includes(p));
    const blackPlaying = squads.black.filter(p => !blackSitOut.includes(p));

    const goldPairs = pairIntoPairs(goldPlaying, partnerCounts, rand, activeLocks);
    const blackPairs = pairIntoPairs(blackPlaying, partnerCounts, rand, activeLocks);
    const combinedSitOut = [...goldSitOut, ...blackSitOut];

    const courts: CourtMatch[] = [];
    for (let c = 0; c < courtCount; c++) {
      courts.push({ teamA: goldPairs[c], teamB: blackPairs[c] });
    }

    rounds.push({ roundNumber, courts, sittingOutPerCourt: courts.map(() => combinedSitOut) });
    lastGoldSitOut = new Set(goldSitOut);
    lastBlackSitOut = new Set(blackSitOut);
  }

  return { squads, rounds, courtCount };
}

// One block assignment: one player group per court.
export interface CourtBlockAssignment {
  groups: string[][];
}

export interface CourtBlocksSchedule {
  assignments: CourtBlockAssignment[];
  rounds: ScrambleRound[];
  courtCount: number;
}

// Splits players into `groupCount` balanced groups (sizes differ by at most
// 1), minimizing how often the same two players have already shared a group
// in a previous block.
function splitIntoGroupsBalanced(
  players: string[],
  groupCount: number,
  groupTogetherCounts: Map<string, number>,
  rand: () => number
): string[][] {
  const pool = shuffleArray(players, rand);
  const baseSize = Math.floor(players.length / groupCount);
  const remainder = players.length % groupCount;
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  const remaining = [...pool];

  for (let g = 0; g < groupCount; g++) {
    const targetSize = baseSize + (g < remainder ? 1 : 0);
    while (groups[g].length < targetSize) {
      if (groups[g].length === 0) {
        groups[g].push(remaining.shift()!);
        continue;
      }
      let bestPlayer: string | null = null;
      let bestScore = Infinity;
      for (const candidate of remaining) {
        let score = 0;
        for (const member of groups[g]) {
          score += groupTogetherCounts.get(pairKey(candidate, member)) ?? 0;
        }
        if (score < bestScore) {
          bestScore = score;
          bestPlayer = candidate;
        }
      }
      groups[g].push(bestPlayer!);
      remaining.splice(remaining.indexOf(bestPlayer!), 1);
    }
  }

  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = pairKey(group[i], group[j]);
        groupTogetherCounts.set(key, (groupTogetherCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return groups;
}

function generateGroupRounds(
  group: string[],
  roundsPerBlock: number,
  rand: () => number
): { teams: [CourtMatch['teamA'], CourtMatch['teamB']]; sittingOut: string[] }[] {
  const sitCounts = new Map(group.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const sitOutCount = group.length - 4;
  if (sitOutCount < 0) {
    throw new Error(`Each Court Swap group needs at least 4 players, got ${group.length}.`);
  }

  const rounds = [];
  let lastSitOut = new Set<string>();
  for (let i = 0; i < roundsPerBlock; i++) {
    const sittingOut = pickSitOuts(group, sitCounts, sitOutCount, rand, lastSitOut);
    const playing = group.filter(p => !sittingOut.includes(p));
    const [court] = pairIntoNTeams(playing, 1, partnerCounts, rand);
    rounds.push({ teams: [court.teamA, court.teamB] as [CourtMatch['teamA'], CourtMatch['teamB']], sittingOut });
    lastSitOut = new Set(sittingOut);
  }
  return rounds;
}

export function generateCourtBlocksSchedule(
  players: string[],
  requestedCourtCount: number,
  roundsPerBlock: number,
  blockCount: number,
  seed: string,
  manualAssignments?: CourtBlockAssignment[],
  lockedPairs: LockedPair[] = [],
  startBlock: number = 1,
  initialGroupTogetherCounts?: Map<string, number>
): CourtBlocksSchedule {
  requireMinPlayers(players, 'Court Swap');
  if (lockedPairs.length > 0) {
    throw new Error('Locked partners are not yet supported for Court Swap — use Scramble or Squad Rivalry instead.');
  }
  if (manualAssignments && manualAssignments.length !== blockCount) {
    throw new Error(`Expected ${blockCount} manual block assignments, got ${manualAssignments.length}`);
  }
  if (manualAssignments) {
    const playerSet = new Set(players);
    for (const block of manualAssignments) {
      const assigned = block.groups.flat();
      if (assigned.length !== players.length || new Set(assigned).size !== players.length || assigned.some(p => !playerSet.has(p))) {
        throw new Error('Manual block assignments must include every active player exactly once.');
      }
    }
  }

  const courtCount = resolveCourtCount(players.length, requestedCourtCount);
  const groupTogetherCounts = new Map<string, number>(initialGroupTogetherCounts ?? []);
  const assignments: CourtBlockAssignment[] = [];
  const rounds: ScrambleRound[] = [];
  // blockCount here is how many blocks THIS CALL produces, starting at
  // startBlock — matches generateScrambleSchedule's startRound convention,
  // so a mid-session regeneration only ever asks for what's actually left.
  let globalRoundNumber = (startBlock - 1) * roundsPerBlock + 1;

  for (let blockOffset = 0; blockOffset < blockCount; blockOffset++) {
    const rand = seededRandom(`${seed}:b${startBlock + blockOffset}`);
    const groups = manualAssignments
      ? manualAssignments[blockOffset].groups
      : splitIntoGroupsBalanced(players, courtCount, groupTogetherCounts, rand);
    assignments.push({ groups });

    const perGroupRounds = groups.map(group => generateGroupRounds(group, roundsPerBlock, rand));

    for (let i = 0; i < roundsPerBlock; i++) {
      const courts: CourtMatch[] = [];
      const sittingOutPerCourt: string[][] = [];
      for (const groupRounds of perGroupRounds) {
        const r = groupRounds[i];
        courts.push({ teamA: r.teams[0], teamB: r.teams[1] });
        sittingOutPerCourt.push(r.sittingOut);
      }
      rounds.push({ roundNumber: globalRoundNumber++, courts, sittingOutPerCourt });
    }
  }

  return { assignments, rounds, courtCount };
}

export interface FixedPartnersSchedule {
  teams: [string, string][];
  rounds: ScrambleRound[];
  courtCount: number;
}

// Everyone gets one fixed partner for the whole night; only who they face
// rotates. Reuses the same tested greedy machinery as the other formats
// (pickSitOuts / pairIntoPairs) but applied at team granularity — each
// fixed team is treated as a single "player" for sit-out balancing and
// opponent-variety pairing, rather than a bespoke round-robin scheduler.
// Equivalently fair in practice for the round counts this app uses, and
// much lower-risk than introducing a second scheduling algorithm.
export interface FixedPartnersLedger {
  sitOutCounts: Map<string, number>; // keyed by team pairKey
  opponentCounts: Map<string, number>;
  lastSitOutTeams: Set<string>;
}

export function generateFixedPartnersSchedule(
  players: string[],
  requestedCourtCount: number,
  roundCount: number,
  seed: string,
  manualTeams?: [string, string][],
  gamesPlayedCounts?: Map<string, number>,
  startRound: number = 1,
  initialLedger?: FixedPartnersLedger
): FixedPartnersSchedule {
  requireMinPlayers(players, 'Fixed Partners');
  if (manualTeams) {
    const assigned = manualTeams.flat();
    const assignedSet = new Set(assigned);
    if (assigned.length !== players.length || assignedSet.size !== players.length || players.some(p => !assignedSet.has(p))) {
      throw new Error('Manual partnerships must pair every player exactly once.');
    }
  }
  const rand = seededRandom(seed);

  // Fixed Partners means one partner for the WHOLE night, so an odd player
  // can't be paired at all — rather than crash, they sit out every round
  // this generation pass. Benching whoever has played the fewest games
  // so far (all 0 at initial setup, so this is just a seeded pick) means a
  // repeat late-arrival scenario in Item 3 naturally benches whoever most
  // deserves a rest, not always the same person.
  let benchedForNight: string | null = null;
  let effectivePlayers = players;
  if (!manualTeams && players.length % 2 !== 0) {
    const gp = gamesPlayedCounts ?? new Map(players.map(p => [p, 0]));
    const tieBreakers = new Map(players.map(p => [p, rand()]));
    const sorted = [...players].sort((a, b) => {
      const diff = (gp.get(a) ?? 0) - (gp.get(b) ?? 0);
      return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
    });
    benchedForNight = sorted[0];
    effectivePlayers = players.filter(p => p !== benchedForNight);
  }
  requireMinPlayers(effectivePlayers, 'Fixed Partners');

  const teams: [string, string][] =
    manualTeams ??
    (() => {
      const shuffled = shuffleArray(effectivePlayers, rand);
      const pairs: [string, string][] = [];
      for (let i = 0; i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
      return pairs;
    })();

  const courtCount = resolveCourtCount(teams.length * 2, requestedCourtCount);
  const teamById = new Map(teams.map(t => [pairKey(t[0], t[1]), t]));
  const teamIds = teams.map(t => pairKey(t[0], t[1]));
  const sitOutCounts = new Map<string, number>(initialLedger?.sitOutCounts ?? []);
  for (const id of teamIds) if (!sitOutCounts.has(id)) sitOutCounts.set(id, 0);
  const opponentCounts = new Map<string, number>(initialLedger?.opponentCounts ?? []);
  const sitOutTeamCount = teams.length - courtCount * 2;
  const rounds: ScrambleRound[] = [];
  let lastSitOutTeams = initialLedger?.lastSitOutTeams ?? new Set<string>();

  for (let i = 0; i < roundCount; i++) {
    const roundNumber = startRound + i;
    const rand = seededRandom(`${seed}:r${roundNumber}`);
    const sittingOutTeamIds = pickSitOuts(teamIds, sitOutCounts, sitOutTeamCount, rand, lastSitOutTeams);
    const playingTeamIds = teamIds.filter(id => !sittingOutTeamIds.includes(id));
    const matchups = pairIntoPairs(playingTeamIds, opponentCounts, rand);
    const courts: CourtMatch[] = matchups.map(([tA, tB]) => ({
      teamA: teamById.get(tA)!,
      teamB: teamById.get(tB)!,
    }));
    const sittingOutPlayers = sittingOutTeamIds.flatMap(id => teamById.get(id)!);
    if (benchedForNight) sittingOutPlayers.push(benchedForNight);
    rounds.push({ roundNumber, courts, sittingOutPerCourt: courts.map(() => sittingOutPlayers) });
    lastSitOutTeams = new Set(sittingOutTeamIds);
  }

  return { teams, rounds, courtCount };
}
