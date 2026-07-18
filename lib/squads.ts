// N-squad generalization of Squad Rivalry (2 squads only, lib/shuffle.ts
// generateSquadRivalrySchedule). See memory project_pickleball_n_squad_plan
// for the full locked plan this implements (2 rounds of adversarial review
// before any code was written).
//
// Deliberately reuses lib/shuffle.ts's existing primitives rather than
// reimplementing them — pickSitOuts/pickSitOutUnits/pairIntoPairs are
// already player-list-agnostic (no gold/black literal anywhere in them),
// proven correct by the existing Scramble/Fixed-Partners/Court-Swap
// formats that already use them on arbitrary string lists. The only new
// logic here is squad-level: splitting players into N balanced squads, and
// round-robin pairing SQUADS against each other (reusing pairIntoPairs
// again, one level up, to pick which squads face off each round).
import {
  seededRandom,
  shuffleArray,
  pickSitOuts,
  pickSitOutUnits,
  buildSitOutUnits,
  pairIntoPairs,
  validateLockedPairs,
  type LockedPair,
  type CourtMatch,
  type ScrambleRound,
} from './shuffle';

export interface Squad {
  id: string;
  players: string[];
}
export type SquadSet = Squad[];

export interface SquadRivalryScheduleN {
  squads: SquadSet;
  rounds: ScrambleRound[];
}

// Squad ids 'gold'/'black' are stable/historical (badges, recap images,
// old session rows reference them by name) — squads[0]/squads[1] always
// get them, exactly as today. Squads beyond 2 get a plain generated id;
// nothing historical depends on those names since they've never existed.
const LEGACY_SQUAD_IDS = ['gold', 'black'];
function squadIdFor(index: number): string {
  return LEGACY_SQUAD_IDS[index] ?? `squad${index + 1}`;
}

// Splits players into `squadCount` squads, balanced within 1 player of
// each other (not required to be exactly equal — see Phase 0 decision in
// the locked plan), keeping every locked pair on the same squad. Greedy
// smallest-bucket-first placement of shuffled units (a unit is 1 player, or
// a locked pair kept atomic) keeps every squad within 1 of every other in
// the common case; if a pathological lock/squad-count combination still
// can't reach that, throws loudly rather than silently producing an
// unbalanced squad.
export function splitIntoNSquadsRespectingLocks(
  players: string[],
  squadCount: number,
  lockedPairs: LockedPair[],
  rand: () => number
): SquadSet {
  if (squadCount < 2) throw new Error(`Squad Rivalry needs at least 2 squads, got ${squadCount}`);
  const units = buildSitOutUnits(players, lockedPairs);
  // Place 2-player (locked-pair) units before 1-player units, each group
  // shuffled independently for variety. Greedy add-to-smallest-bucket with
  // uniform-size items converges imbalance to at most 1 given enough items
  // to correct it — placing all locked pairs first means the (usually much
  // more numerous) single-player units in the second pass smooth out
  // whatever imbalance the pairs left. Placing them in shuffle order
  // instead (mixed sizes) can leave imbalance as high as 2 with no later
  // single-unit pass able to fix it — the bug an earlier version of this
  // function had, caught by a property test hitting an unlucky seed.
  const pairUnits = shuffleArray(units.filter(u => u.players.length === 2), rand);
  const singleUnits = shuffleArray(units.filter(u => u.players.length === 1), rand);
  const buckets: string[][] = Array.from({ length: squadCount }, () => []);
  for (const u of [...pairUnits, ...singleUnits]) {
    let smallest = 0;
    for (let i = 1; i < squadCount; i++) {
      if (buckets[i].length < buckets[smallest].length) smallest = i;
    }
    buckets[smallest].push(...u.players);
  }
  const sizes = buckets.map(b => b.length);
  if (Math.max(...sizes) - Math.min(...sizes) > 1) {
    throw new Error(
      "Can't balance these squads with the given locked pairs — try locking fewer pairs, or adjusting player/squad count."
    );
  }
  return buckets.map((squadPlayers, i) => ({ id: squadIdFor(i), players: squadPlayers }));
}

export function generateSquadRivalryScheduleN(
  players: string[],
  squadCount: number,
  courtCount: number,
  roundCount: number,
  seed: string,
  lockedPairs: LockedPair[] = [],
  manualSquads?: SquadSet
): SquadRivalryScheduleN {
  if (squadCount < 2) throw new Error(`Squad Rivalry needs at least 2 squads, got ${squadCount}`);
  if (courtCount < 1) throw new Error(`Squad Rivalry requires at least 1 court, got ${courtCount}`);
  if (manualSquads) {
    if (manualSquads.length !== squadCount) {
      throw new Error(`Expected ${squadCount} manual squads, got ${manualSquads.length}`);
    }
    const assigned = new Set(manualSquads.flatMap(s => s.players));
    if (assigned.size !== players.length || players.some(p => !assigned.has(p))) {
      throw new Error('Manual squads must include every player exactly once.');
    }
    const manualSizes = manualSquads.map(s => s.players.length);
    if (Math.max(...manualSizes) - Math.min(...manualSizes) > 1) {
      throw new Error('Manual squads must be balanced within 1 player of each other.');
    }
  }
  validateLockedPairs(players, lockedPairs);
  const rand = seededRandom(seed);
  const squads: SquadSet = manualSquads ?? splitIntoNSquadsRespectingLocks(players, squadCount, lockedPairs, rand);

  // A match is inherently 2 squads (a pickleball court seats 2 teams), so
  // no more than floor(squadCount/2) DISTINCT squad-pairs can ever face off
  // in the same round — e.g. 3 squads can only ever form 1 disjoint pair,
  // never 2, regardless of court count (an earlier version of this plan
  // assumed the leftover courts would sit idle in that case; they don't —
  // see courtsPerMatchup below, which gives every court to whichever
  // squad-pairs ARE playing rather than capping at 1 court per pairing).
  const maxSimultaneousPairs = Math.min(courtCount, Math.floor(squadCount / 2));
  if (maxSimultaneousPairs < 1) {
    throw new Error('Squad Rivalry needs at least 2 squads and 1 court able to host a matchup.');
  }
  // Every court not needed by a second/third/etc. squad-pairing goes to
  // whichever pairing(s) ARE playing this round — e.g. 3 squads with 2
  // courts: only 1 pairing can form, so it gets both courts (each squad
  // fields 2 doubles teams that round, not 1), fully using court capacity
  // rather than leaving one idle. Constant for the whole session since
  // squadCount/courtCount don't change round to round.
  const courtsPerMatchup = Math.floor(courtCount / maxSimultaneousPairs);
  const playingSquadCount = maxSimultaneousPairs * 2;
  const squadSitOutCount = squadCount - playingSquadCount;

  const requiredPerSquad = courtsPerMatchup * 2;
  for (const squad of squads) {
    if (squad.players.length < requiredPerSquad) {
      throw new Error(
        `Squad "${squad.id}" needs at least ${requiredPerSquad} players to fill ${courtsPerMatchup} court(s) per matchup, got ${squad.players.length}.`
      );
    }
  }

  const squadIds = squads.map(s => s.id);
  const squadById = new Map(squads.map(s => [s.id, s]));
  const squadSitCounts = new Map(squadIds.map(id => [id, 0]));
  const squadPairCounts = new Map<string, number>();
  const playerSitCounts = new Map(players.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();

  const rounds: ScrambleRound[] = [];
  let lastSquadSitOut = new Set<string>();
  let lastPlayerSitOutBySquad = new Map<string, Set<string>>();

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    // Squad-level sit-out: reuses pickSitOuts unchanged — a squad id is
    // just a string as far as this function is concerned. At squadCount=2
    // this always yields [] (squadSitOutCount is always 0 there, since
    // playingSquadCount = 1*2 = squadCount), matching today's behavior
    // where gold and black both always play, never a squad-level bye.
    const sittingOutSquadIds =
      squadSitOutCount > 0 ? pickSitOuts(squadIds, squadSitCounts, squadSitOutCount, rand, lastSquadSitOut) : [];
    const playingSquadIds = squadIds.filter(id => !sittingOutSquadIds.includes(id));

    // Reuses pairIntoPairs unchanged, one level up — squads instead of
    // players, minimizing how often the same two squads have already
    // faced each other, exactly the same greedy machinery that already
    // pairs players into doubles teams.
    const squadMatchups = pairIntoPairs(playingSquadIds, squadPairCounts, rand);

    const courts: CourtMatch[] = [];
    const sittingOutPlayers: string[] = [];
    const nextLastPlayerSitOutBySquad = new Map<string, Set<string>>();

    for (const [squadAId, squadBId] of squadMatchups) {
      const squadA = squadById.get(squadAId)!;
      const squadB = squadById.get(squadBId)!;
      const sitOutCountA = squadA.players.length - courtsPerMatchup * 2;
      const sitOutCountB = squadB.players.length - courtsPerMatchup * 2;
      const lastA = lastPlayerSitOutBySquad.get(squadAId) ?? new Set<string>();
      const lastB = lastPlayerSitOutBySquad.get(squadBId) ?? new Set<string>();

      const sitOutA =
        lockedPairs.length > 0
          ? pickSitOutUnits(buildSitOutUnits(squadA.players, lockedPairs), playerSitCounts, sitOutCountA, rand, lastA)
          : pickSitOuts(squadA.players, playerSitCounts, sitOutCountA, rand, lastA);
      const sitOutB =
        lockedPairs.length > 0
          ? pickSitOutUnits(buildSitOutUnits(squadB.players, lockedPairs), playerSitCounts, sitOutCountB, rand, lastB)
          : pickSitOuts(squadB.players, playerSitCounts, sitOutCountB, rand, lastB);

      const playingA = squadA.players.filter(p => !sitOutA.includes(p));
      const playingB = squadB.players.filter(p => !sitOutB.includes(p));
      const teamsA = pairIntoPairs(playingA, partnerCounts, rand, lockedPairs);
      const teamsB = pairIntoPairs(playingB, partnerCounts, rand, lockedPairs);

      for (let c = 0; c < courtsPerMatchup; c++) {
        courts.push({ teamA: teamsA[c], teamB: teamsB[c] });
      }
      sittingOutPlayers.push(...sitOutA, ...sitOutB);
      nextLastPlayerSitOutBySquad.set(squadAId, new Set(sitOutA));
      nextLastPlayerSitOutBySquad.set(squadBId, new Set(sitOutB));
    }

    // A squad that sat out the WHOLE round has every one of its players
    // sitting out.
    for (const squadId of sittingOutSquadIds) {
      const benchedPlayers = squadById.get(squadId)!.players;
      sittingOutPlayers.push(...benchedPlayers);
      // These players didn't go through pickSitOuts/pickSitOutUnits (the
      // whole squad was benched, not chosen player-by-player), so their
      // playerSitCounts need the same increment those functions would have
      // applied — otherwise this squad's players look permanently
      // "less rested" than they really are for the rest of the session,
      // biasing every future individual sit-out selection toward them and
      // risking a genuine back-to-back sit-out with no repeat protection.
      for (const p of benchedPlayers) playerSitCounts.set(p, playerSitCounts.get(p)! + 1);
      // Every one of this squad's players just sat out (as part of the
      // whole-squad bye) — carry that forward as "sat out last round" so
      // that when the squad returns to play, individual sit-out selection
      // naturally avoids re-benching the same people immediately (a true
      // back-to-back sit with zero rounds played in between, exactly the
      // pattern pickSitOuts/pickSitOutUnits already exist to prevent).
      nextLastPlayerSitOutBySquad.set(squadId, new Set(benchedPlayers));
    }

    rounds.push({ roundNumber, courts, sittingOutPerCourt: courts.map(() => sittingOutPlayers) });
    lastSquadSitOut = new Set(sittingOutSquadIds);
    lastPlayerSitOutBySquad = nextLastPlayerSitOutBySquad;
  }

  return { squads, rounds };
}
