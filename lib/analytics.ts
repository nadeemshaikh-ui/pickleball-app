import type { RoundRow } from './db';
import type { Squads } from './shuffle';
import type { SquadSet } from './squads';

export interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
  winPct: number;
}

export function computeLeaderboard(rounds: RoundRow[]): PlayerStats[] {
  const stats = new Map<string, PlayerStats>();

  function getOrCreate(name: string): PlayerStats {
    if (!stats.has(name)) {
      stats.set(name, { name, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0, winPct: 0 });
    }
    return stats.get(name)!;
  }

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null) continue;
    const aWon = round.score_a > round.score_b;

    for (const name of round.team_a) {
      const s = getOrCreate(name);
      s.gamesPlayed++;
      s.pointsFor += round.score_a;
      s.pointsAgainst += round.score_b;
      if (aWon) s.wins++;
      else s.losses++;
    }
    for (const name of round.team_b) {
      const s = getOrCreate(name);
      s.gamesPlayed++;
      s.pointsFor += round.score_b;
      s.pointsAgainst += round.score_a;
      if (!aWon) s.wins++;
      else s.losses++;
    }
  }

  const list = [...stats.values()];
  for (const s of list) {
    s.winPct = s.gamesPlayed > 0 ? s.wins / s.gamesPlayed : 0;
  }

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    return diffB - diffA;
  });

  return list;
}

export function computeSquadTotals(rounds: RoundRow[], squads: Squads): { gold: number; black: number } {
  const goldSet = new Set(squads.gold);
  let gold = 0;
  let black = 0;

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null) continue;
    const teamAIsGold = round.team_a.every(p => goldSet.has(p));
    if (teamAIsGold) {
      gold += round.score_a;
      black += round.score_b;
    } else {
      black += round.score_a;
      gold += round.score_b;
    }
  }

  return { gold, black };
}

// N-squad generalization of computeSquadTotals — a round's team is always
// drawn entirely from one squad (lib/squads.ts's generator never mixes
// players from two squads onto the same team), so any one player on a team
// identifies which squad the whole team belongs to. Additive/isolated: not
// called by anything yet, same as lib/squads.ts itself until the UI phase
// wires it in.
export function computeSquadTotalsN(rounds: RoundRow[], squads: SquadSet): Map<string, number> {
  const squadOfPlayer = new Map<string, string>();
  for (const squad of squads) {
    for (const p of squad.players) squadOfPlayer.set(p, squad.id);
  }
  const totals = new Map<string, number>(squads.map(s => [s.id, 0]));

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null) continue;
    const squadAId = round.team_a[0] !== undefined ? squadOfPlayer.get(round.team_a[0]) : undefined;
    const squadBId = round.team_b[0] !== undefined ? squadOfPlayer.get(round.team_b[0]) : undefined;
    if (squadAId !== undefined && totals.has(squadAId)) totals.set(squadAId, totals.get(squadAId)! + round.score_a);
    if (squadBId !== undefined && totals.has(squadBId)) totals.set(squadBId, totals.get(squadBId)! + round.score_b);
  }

  return totals;
}
