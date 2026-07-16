export interface FixtureDraft {
  roundLabel: string;
  groupLabel: string | null;
  matchOrder: number;
  bracketRound: number | null;
  bracketSlot: number | null;
  teamAId: string | null;
  teamBId: string | null;
  winnerNextMatchOrdinal: number | null; // index into the SAME array being built, resolved to a real id server-side
  winnerNextSlot: 'a' | 'b' | null;
  loserNextMatchOrdinal: number | null;
  loserNextSlot: 'a' | 'b' | null;
  isBye: boolean;
}

// Standard circle method: fix team 0, rotate the rest. An odd team count gets
// a bye seat added so the rotation still works — the team paired with the bye
// each round simply gets no match row that round, not a special case in the
// output.
function circleMethodRounds(teamIds: string[]): [string, string][][] {
  const ids = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, '__bye__'];
  const n = ids.length;
  const roundCount = n - 1;
  const rounds: [string, string][][] = [];
  const rotating = ids.slice(1);

  for (let r = 0; r < roundCount; r++) {
    const arranged = [ids[0], ...rotating];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arranged[i];
      const b = arranged[n - 1 - i];
      if (a !== '__bye__' && b !== '__bye__') pairs.push([a, b]);
    }
    rounds.push(pairs);
    rotating.unshift(rotating.pop()!);
  }
  return rounds;
}

// One full round-robin (every team plays every other team once), or twice
// back-to-back per matchup when `doubleHeader` is set — two legs are just two
// extra FixtureDraft rows for the same pairing, no schema/standings changes
// needed.
export function generateRoundRobinFixtures(teamIds: string[], opts: { doubleHeader: boolean } = { doubleHeader: false }): FixtureDraft[] {
  if (teamIds.length < 2) throw new Error(`A league needs at least 2 teams, got ${teamIds.length}`);
  const rounds = circleMethodRounds(teamIds);
  const fixtures: FixtureDraft[] = [];
  let matchOrder = 0;

  rounds.forEach((pairs, roundIndex) => {
    for (const [teamAId, teamBId] of pairs) {
      fixtures.push({
        roundLabel: `Round ${roundIndex + 1}`,
        groupLabel: null,
        matchOrder: matchOrder++,
        bracketRound: null,
        bracketSlot: null,
        teamAId,
        teamBId,
        winnerNextMatchOrdinal: null,
        winnerNextSlot: null,
        loserNextMatchOrdinal: null,
        loserNextSlot: null,
        isBye: false,
      });
      if (opts.doubleHeader) {
        fixtures.push({
          roundLabel: `Round ${roundIndex + 1} (Leg 2)`,
          groupLabel: null,
          matchOrder: matchOrder++,
          bracketRound: null,
          bracketSlot: null,
          teamAId: teamBId,
          teamBId: teamAId,
          winnerNextMatchOrdinal: null,
          winnerNextSlot: null,
          loserNextMatchOrdinal: null,
          loserNextSlot: null,
          isBye: false,
        });
      }
    }
  });

  return fixtures;
}

// Seeded snake-draft distribution into `groupCount` groups, sizes differing
// by at most 1 — highest seed to group 1, next to group 2, ... then reverses
// direction each pass so groups end up balanced by strength rather than group
// 1 getting every top seed.
export function assignTeamsToGroups(teams: { id: string }[], groupCount: number): Record<string, string[]> {
  if (groupCount < 1) throw new Error(`Group count must be at least 1, got ${groupCount}`);
  if (teams.length < groupCount) {
    throw new Error(`Need at least ${groupCount} teams to form ${groupCount} groups, got ${teams.length}`);
  }
  const groups: Record<string, string[]> = {};
  for (let g = 0; g < groupCount; g++) groups[groupLabelFor(g)] = [];

  let g = 0;
  let direction = 1;
  for (const team of teams) {
    groups[groupLabelFor(g)].push(team.id);
    if (g + direction < 0 || g + direction >= groupCount) direction *= -1;
    else g += direction;
  }
  return groups;
}

export function groupLabelFor(index: number): string {
  return `Group ${String.fromCharCode(65 + index)}`;
}
