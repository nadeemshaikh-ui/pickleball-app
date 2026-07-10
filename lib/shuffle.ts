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

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

// Picks `count` players to sit out this round, prioritizing whoever has sat
// out the fewest times so far (balances sit-outs across the whole schedule).
// Players who sat out last round are pushed to the back of the line so the
// same person doesn't rest two rounds in a row — unless there aren't enough
// other players to fill `count` without them, in which case a repeat is
// unavoidable and allowed.
function pickSitOuts(
  pool: string[],
  sitCounts: Map<string, number>,
  count: number,
  rand: () => number,
  lastSitOut: ReadonlySet<string> = new Set()
): string[] {
  if (count <= 0) return [];
  const tieBreakers = new Map(pool.map(p => [p, rand()]));
  const sorted = [...pool].sort((a, b) => {
    const diff = sitCounts.get(a)! - sitCounts.get(b)!;
    return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
  });
  const eligible = sorted.filter(p => !lastSitOut.has(p));
  const repeats = sorted.filter(p => lastSitOut.has(p));
  const chosen = [...eligible, ...repeats].slice(0, count);
  for (const p of chosen) sitCounts.set(p, sitCounts.get(p)! + 1);
  return chosen;
}

export type LockedPair = [string, string];

// Rejects overlapping locks (a player in two locked pairs) and pairs
// referencing players who aren't in the roster — both would otherwise
// silently corrupt the schedule rather than fail loudly.
function validateLockedPairs(players: string[], lockedPairs: LockedPair[]): void {
  const seen = new Set<string>();
  for (const [a, b] of lockedPairs) {
    if (a === b) throw new Error('A locked pair cannot be the same player twice.');
    if (!players.includes(a) || !players.includes(b)) {
      throw new Error(`Locked pair references a player not in the roster: ${a} & ${b}`);
    }
    if (seen.has(a) || seen.has(b)) {
      throw new Error(`Player appears in more than one locked pair: ${seen.has(a) ? a : b}`);
    }
    seen.add(a);
    seen.add(b);
  }
}

// A sit-out "unit" is either one player, or a locked pair that must always
// sit together or play together, never split.
interface SitOutUnit {
  players: string[];
  key: string;
}

function buildSitOutUnits(pool: string[], lockedPairs: LockedPair[]): SitOutUnit[] {
  const partnerOf = new Map<string, string>();
  for (const [a, b] of lockedPairs) {
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
function pickSitOutUnits(
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
function pairIntoPairs(
  players: string[],
  partnerCounts: Map<string, number>,
  rand: () => number,
  lockedPairs: LockedPair[] = []
): [string, string][] {
  const pool = shuffleArray(players, rand);
  const used = new Set<string>();
  const teams: [string, string][] = [];

  for (const [a, b] of lockedPairs) {
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
  lockedPairs: LockedPair[] = []
): CourtMatch[] {
  const teams = pairIntoPairs(players, partnerCounts, rand, lockedPairs);
  const courts: CourtMatch[] = [];
  for (let c = 0; c < courtCount; c++) {
    courts.push({ teamA: teams[c * 2], teamB: teams[c * 2 + 1] });
  }
  return courts;
}

function requireMinPlayers(players: string[], courtCount: number, formatName: string): void {
  const minRequired = courtCount * 4;
  if (courtCount < 1) {
    throw new Error(`${formatName} requires at least 1 court, got ${courtCount}`);
  }
  if (players.length < minRequired) {
    throw new Error(
      `${formatName} needs at least ${minRequired} players to fill ${courtCount} court(s) (4 per court), got ${players.length}`
    );
  }
}

export function generateScrambleSchedule(
  players: string[],
  courtCount: number,
  roundCount: number,
  seed: string,
  lockedPairs: LockedPair[] = []
): ScrambleRound[] {
  requireMinPlayers(players, courtCount, 'Scramble');
  validateLockedPairs(players, lockedPairs);
  const rand = seededRandom(seed);
  const sitOutCounts = new Map<string, number>(players.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const sitOutCount = players.length - courtCount * 4;
  const rounds: ScrambleRound[] = [];
  let lastSitOut = new Set<string>();

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const sittingOut =
      lockedPairs.length > 0
        ? pickSitOutUnits(buildSitOutUnits(players, lockedPairs), sitOutCounts, sitOutCount, rand, lastSitOut)
        : pickSitOuts(players, sitOutCounts, sitOutCount, rand, lastSitOut);
    const playing = players.filter(p => !sittingOut.includes(p));
    const courts = pairIntoNTeams(playing, courtCount, partnerCounts, rand, lockedPairs);
    rounds.push({ roundNumber, courts, sittingOutPerCourt: courts.map(() => sittingOut) });
    lastSitOut = new Set(sittingOut);
  }

  return rounds;
}

export interface Squads {
  gold: string[];
  black: string[];
}

export interface SquadRivalrySchedule {
  squads: Squads;
  rounds: ScrambleRound[];
}

// Splits players into 2 squads keeping every locked pair on the same side,
// via the same unit-atomicity idea as sit-outs. Falls back to a clear error
// if the unit sizes present can't sum to exactly `half` on either side.
function splitIntoSquadsRespectingLocks(players: string[], lockedPairs: LockedPair[], rand: () => number): Squads {
  const units = buildSitOutUnits(players, lockedPairs);
  const shuffledUnits = shuffleArray(units, rand);
  const half = players.length / 2;
  const gold: string[] = [];
  const black: string[] = [];
  for (const u of shuffledUnits) {
    if (gold.length + u.players.length <= half) gold.push(...u.players);
    else black.push(...u.players);
  }
  if (gold.length !== half || black.length !== half) {
    throw new Error(
      "Can't split into 2 even squads with these locked pairs — try locking fewer pairs or adjusting player count."
    );
  }
  return { gold, black };
}

export function generateSquadRivalrySchedule(
  players: string[],
  courtCount: number,
  roundCount: number,
  seed: string,
  lockedPairs: LockedPair[] = []
): SquadRivalrySchedule {
  if (players.length % 2 !== 0) {
    throw new Error(`Squad Rivalry needs an even number of players to split into 2 squads, got ${players.length}`);
  }
  if (courtCount < 1) {
    throw new Error(`Squad Rivalry requires at least 1 court, got ${courtCount}`);
  }
  validateLockedPairs(players, lockedPairs);
  const rand = seededRandom(seed);
  const squads: Squads =
    lockedPairs.length > 0
      ? splitIntoSquadsRespectingLocks(players, lockedPairs, rand)
      : (() => {
          const shuffled = shuffleArray(players, rand);
          const half = players.length / 2;
          return { gold: shuffled.slice(0, half), black: shuffled.slice(half) };
        })();

  const goldSitCounts = new Map(squads.gold.map(p => [p, 0]));
  const blackSitCounts = new Map(squads.black.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const goldSitOutCount = squads.gold.length - courtCount * 2;
  const blackSitOutCount = squads.black.length - courtCount * 2;
  if (goldSitOutCount < 0 || blackSitOutCount < 0) {
    throw new Error(`Squad Rivalry needs at least ${courtCount * 2} players per squad for ${courtCount} court(s).`);
  }

  const rounds: ScrambleRound[] = [];
  let lastGoldSitOut = new Set<string>();
  let lastBlackSitOut = new Set<string>();
  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const goldSitOut =
      lockedPairs.length > 0
        ? pickSitOutUnits(buildSitOutUnits(squads.gold, lockedPairs), goldSitCounts, goldSitOutCount, rand, lastGoldSitOut)
        : pickSitOuts(squads.gold, goldSitCounts, goldSitOutCount, rand, lastGoldSitOut);
    const blackSitOut =
      lockedPairs.length > 0
        ? pickSitOutUnits(buildSitOutUnits(squads.black, lockedPairs), blackSitCounts, blackSitOutCount, rand, lastBlackSitOut)
        : pickSitOuts(squads.black, blackSitCounts, blackSitOutCount, rand, lastBlackSitOut);
    const goldPlaying = squads.gold.filter(p => !goldSitOut.includes(p));
    const blackPlaying = squads.black.filter(p => !blackSitOut.includes(p));

    const goldPairs = pairIntoPairs(goldPlaying, partnerCounts, rand, lockedPairs);
    const blackPairs = pairIntoPairs(blackPlaying, partnerCounts, rand, lockedPairs);
    const combinedSitOut = [...goldSitOut, ...blackSitOut];

    const courts: CourtMatch[] = [];
    for (let c = 0; c < courtCount; c++) {
      courts.push({ teamA: goldPairs[c], teamB: blackPairs[c] });
    }

    rounds.push({ roundNumber, courts, sittingOutPerCourt: courts.map(() => combinedSitOut) });
    lastGoldSitOut = new Set(goldSitOut);
    lastBlackSitOut = new Set(blackSitOut);
  }

  return { squads, rounds };
}

// One block assignment: one player group per court.
export interface CourtBlockAssignment {
  groups: string[][];
}

export interface CourtBlocksSchedule {
  assignments: CourtBlockAssignment[];
  rounds: ScrambleRound[];
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
  courtCount: number,
  roundsPerBlock: number,
  blockCount: number,
  seed: string,
  manualAssignments?: CourtBlockAssignment[],
  lockedPairs: LockedPair[] = []
): CourtBlocksSchedule {
  if (courtCount < 1) {
    throw new Error(`Court Swap requires at least 1 court, got ${courtCount}`);
  }
  if (lockedPairs.length > 0) {
    throw new Error('Locked partners are not yet supported for Court Swap — use Scramble or Squad Rivalry instead.');
  }
  if (players.length < courtCount * 4) {
    throw new Error(
      `Court Swap needs at least ${courtCount * 4} players to fill ${courtCount} court(s) (4 per court), got ${players.length}`
    );
  }
  if (manualAssignments && manualAssignments.length !== blockCount) {
    throw new Error(`Expected ${blockCount} manual block assignments, got ${manualAssignments.length}`);
  }

  const rand = seededRandom(seed);
  const groupTogetherCounts = new Map<string, number>();
  const assignments: CourtBlockAssignment[] = [];
  const rounds: ScrambleRound[] = [];
  let globalRoundNumber = 1;

  for (let block = 0; block < blockCount; block++) {
    const groups = manualAssignments
      ? manualAssignments[block].groups
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

  return { assignments, rounds };
}

export interface FixedPartnersSchedule {
  teams: [string, string][];
  rounds: ScrambleRound[];
}

// Everyone gets one fixed partner for the whole night; only who they face
// rotates. Reuses the same tested greedy machinery as the other formats
// (pickSitOuts / pairIntoPairs) but applied at team granularity — each
// fixed team is treated as a single "player" for sit-out balancing and
// opponent-variety pairing, rather than a bespoke round-robin scheduler.
// Equivalently fair in practice for the round counts this app uses, and
// much lower-risk than introducing a second scheduling algorithm.
export function generateFixedPartnersSchedule(
  players: string[],
  courtCount: number,
  roundCount: number,
  seed: string
): FixedPartnersSchedule {
  if (courtCount < 1) {
    throw new Error(`Fixed Partners requires at least 1 court, got ${courtCount}`);
  }
  if (players.length % 2 !== 0) {
    throw new Error(`Fixed Partners needs an even number of players to form full-night partnerships, got ${players.length}`);
  }
  const rand = seededRandom(seed);
  const shuffled = shuffleArray(players, rand);
  const teams: [string, string][] = [];
  for (let i = 0; i < shuffled.length; i += 2) teams.push([shuffled[i], shuffled[i + 1]]);

  const teamCount = teams.length;
  if (teamCount < courtCount * 2) {
    throw new Error(
      `Fixed Partners needs at least ${courtCount * 2} teams (${courtCount * 4} players) to fill ${courtCount} court(s), got ${teamCount} teams`
    );
  }

  const teamById = new Map(teams.map(t => [pairKey(t[0], t[1]), t]));
  const teamIds = teams.map(t => pairKey(t[0], t[1]));
  const sitOutCounts = new Map(teamIds.map(id => [id, 0]));
  const opponentCounts = new Map<string, number>();
  const sitOutTeamCount = teamCount - courtCount * 2;
  const rounds: ScrambleRound[] = [];
  let lastSitOutTeams = new Set<string>();

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const sittingOutTeamIds = pickSitOuts(teamIds, sitOutCounts, sitOutTeamCount, rand, lastSitOutTeams);
    const playingTeamIds = teamIds.filter(id => !sittingOutTeamIds.includes(id));
    const matchups = pairIntoPairs(playingTeamIds, opponentCounts, rand);
    const courts: CourtMatch[] = matchups.map(([tA, tB]) => ({
      teamA: teamById.get(tA)!,
      teamB: teamById.get(tB)!,
    }));
    const sittingOutPlayers = sittingOutTeamIds.flatMap(id => teamById.get(id)!);
    rounds.push({ roundNumber, courts, sittingOutPerCourt: courts.map(() => sittingOutPlayers) });
    lastSitOutTeams = new Set(sittingOutTeamIds);
  }

  return { teams, rounds };
}
