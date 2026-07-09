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
  sittingOut: [string, string];
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Greedily pairs 8 players into 4 teams of 2 (2 courts), minimizing repeat
// partnerships based on the running partnerCounts map.
function pairIntoTeams(
  eightPlayers: string[],
  partnerCounts: Map<string, number>,
  rand: () => number
): [CourtMatch, CourtMatch] {
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
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

export function generateScrambleSchedule(
  players: string[],
  roundCount: number,
  seed: string
): ScrambleRound[] {
  if (players.length !== 10) {
    throw new Error(`generateScrambleSchedule requires exactly 10 players, got ${players.length}`);
  }
  const rand = seededRandom(seed);
  const sitOutCounts = new Map<string, number>(players.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const rounds: ScrambleRound[] = [];

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    // Precompute tiebreakers once per round rather than calling rand() inside
    // the sort comparator, whose call-count isn't guaranteed by the JS spec.
    const tieBreakers = new Map(players.map(p => [p, rand()]));
    const sortedBySitOut = [...players].sort((a, b) => {
      const diff = sitOutCounts.get(a)! - sitOutCounts.get(b)!;
      return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
    });
    const sittingOut = sortedBySitOut.slice(0, 2) as [string, string];
    for (const p of sittingOut) sitOutCounts.set(p, sitOutCounts.get(p)! + 1);

    const playing = players.filter(p => !sittingOut.includes(p));
    const [court1, court2] = pairIntoTeams(playing, partnerCounts, rand);

    rounds.push({ roundNumber, court1, court2, sittingOut });
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
  if (players.length !== 10) {
    throw new Error(`generateSquadRivalrySchedule requires exactly 10 players, got ${players.length}`);
  }
  const rand = seededRandom(seed);
  const shuffled = shuffleArray(players, rand);
  const squads: Squads = { gold: shuffled.slice(0, 5), black: shuffled.slice(5, 10) };

  const goldSitCounts = new Map(squads.gold.map(p => [p, 0]));
  const blackSitCounts = new Map(squads.black.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');

  function pickSquadSitOut(squad: string[], sitCounts: Map<string, number>): string {
    const tieBreakers = new Map(squad.map(p => [p, rand()]));
    const sorted = [...squad].sort((a, b) => {
      const diff = sitCounts.get(a)! - sitCounts.get(b)!;
      return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
    });
    const chosen = sorted[0];
    sitCounts.set(chosen, sitCounts.get(chosen)! + 1);
    return chosen;
  }

  // Pairs 4 players from one squad into 2 partner-teams, minimizing repeats.
  function pairSquadIntoTwoTeams(fourPlayers: string[]): [[string, string], [string, string]] {
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

  const rounds: ScrambleRound[] = [];
  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const goldSitOut = pickSquadSitOut(squads.gold, goldSitCounts);
    const blackSitOut = pickSquadSitOut(squads.black, blackSitCounts);
    const goldPlaying = squads.gold.filter(p => p !== goldSitOut);
    const blackPlaying = squads.black.filter(p => p !== blackSitOut);

    const [goldTeam1, goldTeam2] = pairSquadIntoTwoTeams(goldPlaying);
    const [blackTeam1, blackTeam2] = pairSquadIntoTwoTeams(blackPlaying);

    rounds.push({
      roundNumber,
      court1: { teamA: goldTeam1, teamB: blackTeam1 },
      court2: { teamA: goldTeam2, teamB: blackTeam2 },
      sittingOut: [goldSitOut, blackSitOut],
    });
  }

  return { squads, rounds };
}
