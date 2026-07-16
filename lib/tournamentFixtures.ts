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
