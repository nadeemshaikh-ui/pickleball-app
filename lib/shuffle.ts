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

export interface ScrambleRound {
  roundNumber: number;
  court1: CourtMatch;
  court2: CourtMatch;
  sittingOutCourt1: string[];
  sittingOutCourt2: string[];
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
function pickSitOuts(pool: string[], sitCounts: Map<string, number>, count: number, rand: () => number): string[] {
  if (count <= 0) return [];
  const tieBreakers = new Map(pool.map(p => [p, rand()]));
  const sorted = [...pool].sort((a, b) => {
    const diff = sitCounts.get(a)! - sitCounts.get(b)!;
    return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
  });
  const chosen = sorted.slice(0, count);
  for (const p of chosen) sitCounts.set(p, sitCounts.get(p)! + 1);
  return chosen;
}

// Greedily pairs exactly 8 players into 4 teams of 2 (2 courts), minimizing
// repeat partnerships based on the running partnerCounts map.
function pairIntoTeams(
  eightPlayers: string[],
  partnerCounts: Map<string, number>,
  rand: () => number
): [CourtMatch, CourtMatch] {
  const pool = shuffleArray(eightPlayers, rand);
  const teams: [string, string][] = [];
  const used = new Set<string>();

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

  return [
    { teamA: teams[0], teamB: teams[1] },
    { teamA: teams[2], teamB: teams[3] },
  ];
}

// Pairs exactly 4 players (already picked for one court) into 2 teams of 2,
// minimizing repeat partnerships.
function pairFourIntoTwoTeams(
  fourPlayers: string[],
  partnerCounts: Map<string, number>,
  rand: () => number
): [[string, string], [string, string]] {
  const pool = shuffleArray(fourPlayers, rand);
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
  return [teams[0], teams[1]];
}

function validatePlayerCount(players: string[], formatName: string): void {
  if (players.length < 8 || players.length % 2 !== 0) {
    throw new Error(`${formatName} requires an even number of players, at least 8, got ${players.length}`);
  }
}

export function generateScrambleSchedule(
  players: string[],
  roundCount: number,
  seed: string
): ScrambleRound[] {
  validatePlayerCount(players, 'generateScrambleSchedule');
  const rand = seededRandom(seed);
  const sitOutCounts = new Map<string, number>(players.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const sitOutCount = players.length - 8;
  const rounds: ScrambleRound[] = [];

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const sittingOut = pickSitOuts(players, sitOutCounts, sitOutCount, rand);
    const playing = players.filter(p => !sittingOut.includes(p));
    const [court1, court2] = pairIntoTeams(playing, partnerCounts, rand);
    rounds.push({ roundNumber, court1, court2, sittingOutCourt1: sittingOut, sittingOutCourt2: sittingOut });
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
  roundCount: number,
  seed: string
): SquadRivalrySchedule {
  validatePlayerCount(players, 'generateSquadRivalrySchedule');
  const rand = seededRandom(seed);
  const shuffled = shuffleArray(players, rand);
  const half = players.length / 2;
  const squads: Squads = { gold: shuffled.slice(0, half), black: shuffled.slice(half) };

  const goldSitCounts = new Map(squads.gold.map(p => [p, 0]));
  const blackSitCounts = new Map(squads.black.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const goldSitOutCount = squads.gold.length - 4;
  const blackSitOutCount = squads.black.length - 4;
  if (goldSitOutCount < 0 || blackSitOutCount < 0) {
    throw new Error('Squad Rivalry requires at least 4 players per squad (8 total).');
  }

  const rounds: ScrambleRound[] = [];
  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const goldSitOut = pickSitOuts(squads.gold, goldSitCounts, goldSitOutCount, rand);
    const blackSitOut = pickSitOuts(squads.black, blackSitCounts, blackSitOutCount, rand);
    const goldPlaying = squads.gold.filter(p => !goldSitOut.includes(p));
    const blackPlaying = squads.black.filter(p => !blackSitOut.includes(p));

    const [goldTeam1, goldTeam2] = pairFourIntoTwoTeams(goldPlaying, partnerCounts, rand);
    const [blackTeam1, blackTeam2] = pairFourIntoTwoTeams(blackPlaying, partnerCounts, rand);
    const combinedSitOut = [...goldSitOut, ...blackSitOut];

    rounds.push({
      roundNumber,
      court1: { teamA: goldTeam1, teamB: blackTeam1 },
      court2: { teamA: goldTeam2, teamB: blackTeam2 },
      sittingOutCourt1: combinedSitOut,
      sittingOutCourt2: combinedSitOut,
    });
  }

  return { squads, rounds };
}

export interface CourtBlockAssignment {
  courtA: string[];
  courtB: string[];
}

export interface CourtBlocksSchedule {
  assignments: CourtBlockAssignment[];
  rounds: ScrambleRound[];
}

// Splits players into 2 balanced groups, minimizing how often the same two
// players have already shared a group in a previous block.
function splitIntoTwoGroupsBalanced(
  players: string[],
  groupTogetherCounts: Map<string, number>,
  rand: () => number
): CourtBlockAssignment {
  const half = Math.floor(players.length / 2);
  const pool = shuffleArray(players, rand);
  const groupA: string[] = [pool[0]];
  const remaining = pool.slice(1);

  while (groupA.length < half) {
    let bestPlayer: string | null = null;
    let bestScore = Infinity;
    for (const candidate of remaining) {
      let score = 0;
      for (const member of groupA) {
        score += groupTogetherCounts.get(pairKey(candidate, member)) ?? 0;
      }
      if (score < bestScore) {
        bestScore = score;
        bestPlayer = candidate;
      }
    }
    groupA.push(bestPlayer!);
    remaining.splice(remaining.indexOf(bestPlayer!), 1);
  }

  const groupB = pool.filter(p => !groupA.includes(p));

  for (const group of [groupA, groupB]) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = pairKey(group[i], group[j]);
        groupTogetherCounts.set(key, (groupTogetherCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return { courtA: groupA, courtB: groupB };
}

function generateGroupRounds(
  group: string[],
  roundsPerBlock: number,
  startingRoundNumber: number,
  rand: () => number
): { rounds: { teams: [CourtMatch['teamA'], CourtMatch['teamB']]; sittingOut: string[] }[] } {
  const sitCounts = new Map(group.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const sitOutCount = group.length - 4;
  if (sitOutCount < 0) {
    throw new Error('Each Court Blocks group needs at least 4 players.');
  }

  const rounds = [];
  for (let i = 0; i < roundsPerBlock; i++) {
    const sittingOut = pickSitOuts(group, sitCounts, sitOutCount, rand);
    const playing = group.filter(p => !sittingOut.includes(p));
    const [teamA, teamB] = pairFourIntoTwoTeams(playing, partnerCounts, rand);
    rounds.push({ teams: [teamA, teamB] as [CourtMatch['teamA'], CourtMatch['teamB']], sittingOut });
  }
  void startingRoundNumber;
  return { rounds };
}

export function generateCourtBlocksSchedule(
  players: string[],
  roundsPerBlock: number,
  blockCount: number,
  seed: string,
  manualAssignments?: CourtBlockAssignment[]
): CourtBlocksSchedule {
  validatePlayerCount(players, 'generateCourtBlocksSchedule');
  if (manualAssignments && manualAssignments.length !== blockCount) {
    throw new Error(`Expected ${blockCount} manual block assignments, got ${manualAssignments.length}`);
  }

  const rand = seededRandom(seed);
  const groupTogetherCounts = new Map<string, number>();
  const assignments: CourtBlockAssignment[] = [];
  const rounds: ScrambleRound[] = [];
  let globalRoundNumber = 1;

  for (let block = 0; block < blockCount; block++) {
    const assignment = manualAssignments
      ? manualAssignments[block]
      : splitIntoTwoGroupsBalanced(players, groupTogetherCounts, rand);
    assignments.push(assignment);

    const { rounds: courtARounds } = generateGroupRounds(assignment.courtA, roundsPerBlock, globalRoundNumber, rand);
    const { rounds: courtBRounds } = generateGroupRounds(assignment.courtB, roundsPerBlock, globalRoundNumber, rand);

    for (let i = 0; i < roundsPerBlock; i++) {
      const a = courtARounds[i];
      const b = courtBRounds[i];
      rounds.push({
        roundNumber: globalRoundNumber++,
        court1: { teamA: a.teams[0], teamB: a.teams[1] },
        court2: { teamA: b.teams[0], teamB: b.teams[1] },
        sittingOutCourt1: a.sittingOut,
        sittingOutCourt2: b.sittingOut,
      });
    }
  }

  return { assignments, rounds };
}
