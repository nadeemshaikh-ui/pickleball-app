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

// Greedily pairs an even-sized pool into players.length/2 teams of 2,
// minimizing repeat partnerships based on the running partnerCounts map.
function pairIntoPairs(
  players: string[],
  partnerCounts: Map<string, number>,
  rand: () => number
): [string, string][] {
  const pool = shuffleArray(players, rand);
  const used = new Set<string>();
  const teams: [string, string][] = [];

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
  rand: () => number
): CourtMatch[] {
  const teams = pairIntoPairs(players, partnerCounts, rand);
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
  seed: string
): ScrambleRound[] {
  requireMinPlayers(players, courtCount, 'Scramble');
  const rand = seededRandom(seed);
  const sitOutCounts = new Map<string, number>(players.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const sitOutCount = players.length - courtCount * 4;
  const rounds: ScrambleRound[] = [];
  let lastSitOut = new Set<string>();

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const sittingOut = pickSitOuts(players, sitOutCounts, sitOutCount, rand, lastSitOut);
    const playing = players.filter(p => !sittingOut.includes(p));
    const courts = pairIntoNTeams(playing, courtCount, partnerCounts, rand);
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

export function generateSquadRivalrySchedule(
  players: string[],
  courtCount: number,
  roundCount: number,
  seed: string
): SquadRivalrySchedule {
  if (players.length % 2 !== 0) {
    throw new Error(`Squad Rivalry needs an even number of players to split into 2 squads, got ${players.length}`);
  }
  if (courtCount < 1) {
    throw new Error(`Squad Rivalry requires at least 1 court, got ${courtCount}`);
  }
  const rand = seededRandom(seed);
  const shuffled = shuffleArray(players, rand);
  const half = players.length / 2;
  const squads: Squads = { gold: shuffled.slice(0, half), black: shuffled.slice(half) };

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
    const goldSitOut = pickSitOuts(squads.gold, goldSitCounts, goldSitOutCount, rand, lastGoldSitOut);
    const blackSitOut = pickSitOuts(squads.black, blackSitCounts, blackSitOutCount, rand, lastBlackSitOut);
    const goldPlaying = squads.gold.filter(p => !goldSitOut.includes(p));
    const blackPlaying = squads.black.filter(p => !blackSitOut.includes(p));

    const goldPairs = pairIntoPairs(goldPlaying, partnerCounts, rand);
    const blackPairs = pairIntoPairs(blackPlaying, partnerCounts, rand);
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
  manualAssignments?: CourtBlockAssignment[]
): CourtBlocksSchedule {
  if (courtCount < 1) {
    throw new Error(`Court Swap requires at least 1 court, got ${courtCount}`);
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
