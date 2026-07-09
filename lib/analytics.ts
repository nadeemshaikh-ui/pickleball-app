import type { RoundRow } from './db';
import type { Squads } from './shuffle';

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
