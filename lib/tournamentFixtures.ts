import { generateRoundRobinFixtures, assignTeamsToGroups, type FixtureDraft } from './tournamentRoundRobin';
import { seedKnockoutBracket, computeBracketSize } from './tournamentBracket';

export type { FixtureDraft };

export function generateLeagueFixtures(teamIds: string[], config: { doubleHeader: boolean } = { doubleHeader: false }): FixtureDraft[] {
  return generateRoundRobinFixtures(teamIds, config).map(f => ({ ...f, groupLabel: null }));
}

export function generateGroupFixtures(
  teams: { id: string }[],
  config: { groupCount: number; doubleHeader: boolean }
): FixtureDraft[] {
  const groups = assignTeamsToGroups(teams, config.groupCount);
  const fixtures: FixtureDraft[] = [];
  let matchOrder = 0;
  for (const [groupLabel, teamIds] of Object.entries(groups)) {
    const groupFixtures = generateRoundRobinFixtures(teamIds, { doubleHeader: config.doubleHeader });
    for (const f of groupFixtures) {
      fixtures.push({ ...f, groupLabel, matchOrder: matchOrder++ });
    }
  }
  return fixtures;
}

// Builds every round of a knockout bracket up front, including empty
// second-round-and-later shells, with winnerNextMatchOrdinal pre-wired so
// create_tournament_stage can resolve real ids in one pass. Byes are marked
// isBye:true and already carry their sole real team as teamAId — the DB
// function resolves them into round 2 immediately at creation time, no score
// event required.
export function generateKnockoutFixtures(teams: { id: string }[]): FixtureDraft[] {
  const seeded = seedKnockoutBracket(teams);
  const bracketSize = computeBracketSize(teams.length);
  const totalRounds = Math.log2(bracketSize);
  const fixtures: FixtureDraft[] = [];

  // ordinal -> match index map per round, so later rounds can wire winnerNextMatchOrdinal
  const roundStartOrdinal: number[] = [];
  let matchOrder = 0;

  for (let round = 1; round <= totalRounds; round++) {
    roundStartOrdinal.push(fixtures.length);
    const matchesThisRound = bracketSize / 2 ** round;
    for (let slot = 0; slot < matchesThisRound; slot++) {
      let teamAId: string | null = null;
      let teamBId: string | null = null;
      let isBye = false;

      if (round === 1) {
        const a = seeded[slot * 2];
        const b = seeded[slot * 2 + 1];
        teamAId = a.teamId;
        teamBId = b.teamId;
        isBye = a.isBye || b.isBye;
      }

      fixtures.push({
        roundLabel: totalRounds === 1 ? 'Final' : round === totalRounds ? 'Final' : `Round ${round}`,
        groupLabel: null,
        matchOrder: matchOrder++,
        bracketRound: round,
        bracketSlot: slot,
        teamAId,
        teamBId,
        winnerNextMatchOrdinal: null,
        winnerNextSlot: null,
        loserNextMatchOrdinal: null,
        loserNextSlot: null,
        isBye,
      });
    }
  }

  // wire winnerNextMatchOrdinal: match `slot` in round r feeds slot floor(slot/2) in round r+1
  for (let round = 1; round < totalRounds; round++) {
    const matchesThisRound = bracketSize / 2 ** round;
    for (let slot = 0; slot < matchesThisRound; slot++) {
      const matchIdx = roundStartOrdinal[round - 1] + slot;
      const nextIdx = roundStartOrdinal[round] + Math.floor(slot / 2);
      fixtures[matchIdx].winnerNextMatchOrdinal = nextIdx;
      fixtures[matchIdx].winnerNextSlot = slot % 2 === 0 ? 'a' : 'b';
    }
  }

  return fixtures;
}

// Double elimination: a winners bracket (WB) identical in shape to
// generateKnockoutFixtures, plus a losers bracket (LB) that every WB loser
// drops into, plus a single grand final (WB champion vs LB champion — no
// automatic bracket reset if the LB side wins; see note below). Scoped to
// an EXACT power-of-2 team count (4, 8, 16...) — a bye in round 1 would
// cascade into a bye somewhere in the losers bracket too, which is a real
// edge case even in dedicated bracket software and isn't supported here.
//
// LB structure, for k = log2(teamCount) winners-bracket rounds:
//   - LB has 2*(k-1) rounds.
//   - LB round 1 pairs WB round-1 losers against each other (pure intake).
//   - LB round i (even, i>=2) pairs LB round (i-1) winners against WB round
//     (i/2 + 1) losers — a "merge" round, count unchanged from round i-1.
//   - LB round i (odd, i>=3) pairs LB round (i-1) winners against each
//     other — a "consolidation" round, count halves.
//   - The final LB round's winner meets the WB champion in the grand final.
//
// No bracket reset: real double-elim gives the WB champion a "second life"
// if they lose the grand final (since the LB finalist already has one
// loss and beating the WB champion only evens them at 1-1, requiring a
// decider match). Implementing that would mean creating a match AFTER the
// bracket is scored, which nothing else in this engine does — every other
// stage type pre-builds its full match tree up front. Single grand final
// (winner takes the stage regardless of which side they came from) is a
// deliberate simplification, common in casual/club double-elim formats,
// not a bug — flagged here so it isn't "fixed" by accident later.
export function generateDoubleEliminationFixtures(teams: { id: string }[]): FixtureDraft[] {
  const n = teams.length;
  if (n < 4 || (n & (n - 1)) !== 0) {
    throw new Error('Double elimination needs an exact power-of-2 team count (4, 8, 16…) — byes in the losers bracket aren\'t supported yet.');
  }
  const k = Math.log2(n);
  const seeded = seedKnockoutBracket(teams); // n is already a power of 2, so no byes here

  const fixtures: FixtureDraft[] = [];
  let matchOrder = 0;

  // ---- Winners bracket ----
  const wbRoundStart: number[] = [];
  for (let round = 1; round <= k; round++) {
    wbRoundStart.push(fixtures.length);
    const matchesThisRound = n / 2 ** round;
    for (let slot = 0; slot < matchesThisRound; slot++) {
      fixtures.push({
        roundLabel: round === k ? 'Winners Final' : `Winners Round ${round}`,
        groupLabel: 'Winners Bracket',
        matchOrder: matchOrder++,
        bracketRound: round,
        bracketSlot: slot,
        teamAId: round === 1 ? seeded[slot * 2].teamId : null,
        teamBId: round === 1 ? seeded[slot * 2 + 1].teamId : null,
        winnerNextMatchOrdinal: null,
        winnerNextSlot: null,
        loserNextMatchOrdinal: null,
        loserNextSlot: null,
        isBye: false,
      });
    }
  }
  for (let round = 1; round < k; round++) {
    const matchesThisRound = n / 2 ** round;
    for (let slot = 0; slot < matchesThisRound; slot++) {
      const matchIdx = wbRoundStart[round - 1] + slot;
      fixtures[matchIdx].winnerNextMatchOrdinal = wbRoundStart[round] + Math.floor(slot / 2);
      fixtures[matchIdx].winnerNextSlot = slot % 2 === 0 ? 'a' : 'b';
    }
  }

  // ---- Losers bracket ----
  const lbRounds = 2 * (k - 1);
  const lbRoundMatchCount: number[] = [];
  let prevCount = n / 4;
  lbRoundMatchCount.push(prevCount);
  for (let i = 2; i <= lbRounds; i++) {
    if (i % 2 === 1) prevCount = prevCount / 2;
    lbRoundMatchCount.push(prevCount);
  }
  const lbRoundStart: number[] = [];
  for (let i = 1; i <= lbRounds; i++) {
    lbRoundStart.push(fixtures.length);
    const cnt = lbRoundMatchCount[i - 1];
    for (let slot = 0; slot < cnt; slot++) {
      fixtures.push({
        roundLabel: i === lbRounds ? 'Losers Final' : `Losers Round ${i}`,
        groupLabel: 'Losers Bracket',
        matchOrder: matchOrder++,
        bracketRound: k + i,
        bracketSlot: slot,
        teamAId: null,
        teamBId: null,
        winnerNextMatchOrdinal: null,
        winnerNextSlot: null,
        loserNextMatchOrdinal: null,
        loserNextSlot: null,
        isBye: false,
      });
    }
  }

  // LB round i -> i+1: odd i is identity (round i already reflects its
  // final count), even i pairs adjacent winners together (halving).
  for (let i = 1; i <= lbRounds - 1; i++) {
    const curStart = lbRoundStart[i - 1];
    const curCount = lbRoundMatchCount[i - 1];
    const nextStart = lbRoundStart[i];
    for (let s = 0; s < curCount; s++) {
      if (i % 2 === 1) {
        fixtures[curStart + s].winnerNextMatchOrdinal = nextStart + s;
        fixtures[curStart + s].winnerNextSlot = 'a';
      } else {
        fixtures[curStart + s].winnerNextMatchOrdinal = nextStart + Math.floor(s / 2);
        fixtures[curStart + s].winnerNextSlot = s % 2 === 0 ? 'a' : 'b';
      }
    }
  }

  // WB round 1 losers -> LB round 1 (two losers per LB match).
  {
    const wbR1Start = wbRoundStart[0];
    const lbR1Start = lbRoundStart[0];
    for (let slot = 0; slot < n / 2; slot++) {
      fixtures[wbR1Start + slot].loserNextMatchOrdinal = lbR1Start + Math.floor(slot / 2);
      fixtures[wbR1Start + slot].loserNextSlot = slot % 2 === 0 ? 'a' : 'b';
    }
  }
  // WB rounds 2..k losers -> LB round 2*(r-1), slot 'b' (the LB survivor
  // from the previous round already occupies slot 'a' there).
  for (let round = 2; round <= k; round++) {
    const lbTargetRound = 2 * (round - 1);
    const lbTargetStart = lbRoundStart[lbTargetRound - 1];
    const wbRoundCount = n / 2 ** round;
    for (let slot = 0; slot < wbRoundCount; slot++) {
      const wbMatchIdx = wbRoundStart[round - 1] + slot;
      fixtures[wbMatchIdx].loserNextMatchOrdinal = lbTargetStart + slot;
      fixtures[wbMatchIdx].loserNextSlot = 'b';
    }
  }

  // ---- Grand final ----
  const gfIdx = fixtures.length;
  fixtures.push({
    roundLabel: 'Grand Final',
    groupLabel: 'Grand Final',
    matchOrder: matchOrder++,
    bracketRound: k + lbRounds + 1,
    bracketSlot: 0,
    teamAId: null,
    teamBId: null,
    winnerNextMatchOrdinal: null,
    winnerNextSlot: null,
    loserNextMatchOrdinal: null,
    loserNextSlot: null,
    isBye: false,
  });
  const wbFinalIdx = wbRoundStart[k - 1];
  fixtures[wbFinalIdx].winnerNextMatchOrdinal = gfIdx;
  fixtures[wbFinalIdx].winnerNextSlot = 'a';
  const lbFinalIdx = lbRoundStart[lbRounds - 1];
  fixtures[lbFinalIdx].winnerNextMatchOrdinal = gfIdx;
  fixtures[lbFinalIdx].winnerNextSlot = 'b';

  return fixtures;
}

// Fixed 4-match structure, real named format — deliberately not sharing any
// code with generateSimpleSemifinalFixtures (see that function) so the two
// stage types can never entangle each other's bugs.
export function generatePagePlayoffFixtures(rankedTeamIds: [string, string, string, string]): FixtureDraft[] {
  if (rankedTeamIds.length !== 4) throw new Error(`Page Playoff requires exactly 4 teams, got ${rankedTeamIds.length}`);
  const [seed1, seed2, seed3, seed4] = rankedTeamIds;

  // ordinals: 0=Qualifier 1, 1=Eliminator, 2=Qualifier 2, 3=Final
  const fixtures: FixtureDraft[] = [
    {
      roundLabel: 'Qualifier 1', groupLabel: null, matchOrder: 0, bracketRound: 1, bracketSlot: 0,
      teamAId: seed1, teamBId: seed2,
      winnerNextMatchOrdinal: 3, winnerNextSlot: 'a',
      loserNextMatchOrdinal: 2, loserNextSlot: 'a',
      isBye: false,
    },
    {
      roundLabel: 'Eliminator', groupLabel: null, matchOrder: 1, bracketRound: 1, bracketSlot: 1,
      teamAId: seed3, teamBId: seed4,
      winnerNextMatchOrdinal: 2, winnerNextSlot: 'b',
      loserNextMatchOrdinal: null, loserNextSlot: null,
      isBye: false,
    },
    {
      roundLabel: 'Qualifier 2', groupLabel: null, matchOrder: 2, bracketRound: 2, bracketSlot: 0,
      teamAId: null, teamBId: null,
      winnerNextMatchOrdinal: 3, winnerNextSlot: 'b',
      loserNextMatchOrdinal: null, loserNextSlot: null,
      isBye: false,
    },
    {
      roundLabel: 'Final', groupLabel: null, matchOrder: 3, bracketRound: 3, bracketSlot: 0,
      teamAId: null, teamBId: null,
      winnerNextMatchOrdinal: null, winnerNextSlot: null,
      loserNextMatchOrdinal: null, loserNextSlot: null,
      isBye: false,
    },
  ];
  return fixtures;
}

// Lighter alternative to Page Playoff, no 2nd-chance bracket — losers of
// both semis are simply eliminated. Kept fully separate from
// generatePagePlayoffFixtures per spec, not a shared/parameterized function.
export function generateSimpleSemifinalFixtures(rankedTeamIds: [string, string, string, string]): FixtureDraft[] {
  if (rankedTeamIds.length !== 4) throw new Error(`Simple Semifinal requires exactly 4 teams, got ${rankedTeamIds.length}`);
  const [seed1, seed2, seed3, seed4] = rankedTeamIds;

  const fixtures: FixtureDraft[] = [
    {
      roundLabel: 'Semifinal 1', groupLabel: null, matchOrder: 0, bracketRound: 1, bracketSlot: 0,
      teamAId: seed1, teamBId: seed4,
      winnerNextMatchOrdinal: 2, winnerNextSlot: 'a',
      loserNextMatchOrdinal: null, loserNextSlot: null,
      isBye: false,
    },
    {
      roundLabel: 'Semifinal 2', groupLabel: null, matchOrder: 1, bracketRound: 1, bracketSlot: 1,
      teamAId: seed2, teamBId: seed3,
      winnerNextMatchOrdinal: 2, winnerNextSlot: 'b',
      loserNextMatchOrdinal: null, loserNextSlot: null,
      isBye: false,
    },
    {
      roundLabel: 'Final', groupLabel: null, matchOrder: 2, bracketRound: 2, bracketSlot: 0,
      teamAId: null, teamBId: null,
      winnerNextMatchOrdinal: null, winnerNextSlot: null,
      loserNextMatchOrdinal: null, loserNextSlot: null,
      isBye: false,
    },
  ];
  return fixtures;
}
