import type { RoundRow } from './db';
import type { SquadSet } from './squads';

export interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff?: number;
  gamesPlayed: number;
  winPct: number;
  avgPointsFor?: number;
  avgPointsAgainst?: number;
  pointSharePct?: number;
  clutchWins?: number;
  clutchLosses?: number;
  clutchWinPct?: number;
  blowoutWins?: number;
}

export function computeLeaderboard(rounds: RoundRow[]): PlayerStats[] {
  const stats = new Map<string, PlayerStats>();

  function getOrCreate(name: string): PlayerStats {
    if (!stats.has(name)) {
      stats.set(name, {
        name,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        gamesPlayed: 0,
        winPct: 0,
        avgPointsFor: 0,
        avgPointsAgainst: 0,
        pointSharePct: 0,
        clutchWins: 0,
        clutchLosses: 0,
        clutchWinPct: 0,
        blowoutWins: 0,
      });
    }
    return stats.get(name)!;
  }

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null) continue;
    const diff = Math.abs(round.score_a - round.score_b);
    const isClutch = diff <= 2;
    const isBlowout = diff >= 5;
    const aWon = round.score_a > round.score_b;

    for (const name of round.team_a) {
      const s = getOrCreate(name);
      s.gamesPlayed++;
      s.pointsFor += round.score_a;
      s.pointsAgainst += round.score_b;
      if (aWon) {
        s.wins++;
        if (isClutch) s.clutchWins = (s.clutchWins ?? 0) + 1;
        if (isBlowout) s.blowoutWins = (s.blowoutWins ?? 0) + 1;
      } else {
        s.losses++;
        if (isClutch) s.clutchLosses = (s.clutchLosses ?? 0) + 1;
      }
    }
    for (const name of round.team_b) {
      const s = getOrCreate(name);
      s.gamesPlayed++;
      s.pointsFor += round.score_b;
      s.pointsAgainst += round.score_a;
      if (!aWon) {
        s.wins++;
        if (isClutch) s.clutchWins = (s.clutchWins ?? 0) + 1;
        if (isBlowout) s.blowoutWins = (s.blowoutWins ?? 0) + 1;
      } else {
        s.losses++;
        if (isClutch) s.clutchLosses = (s.clutchLosses ?? 0) + 1;
      }
    }
  }

  const list = [...stats.values()];
  for (const s of list) {
    s.winPct = s.gamesPlayed > 0 ? s.wins / s.gamesPlayed : 0;
    s.pointDiff = s.pointsFor - s.pointsAgainst;
    s.avgPointsFor = s.gamesPlayed > 0 ? s.pointsFor / s.gamesPlayed : 0;
    s.avgPointsAgainst = s.gamesPlayed > 0 ? s.pointsAgainst / s.gamesPlayed : 0;
    const totalPoints = s.pointsFor + s.pointsAgainst;
    s.pointSharePct = totalPoints > 0 ? (s.pointsFor / totalPoints) * 100 : 0;
    const cWins = s.clutchWins ?? 0;
    const cLosses = s.clutchLosses ?? 0;
    const totalClutch = cWins + cLosses;
    s.clutchWinPct = totalClutch > 0 ? cWins / totalClutch : 0;
  }

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.pointDiff ?? (a.pointsFor - a.pointsAgainst);
    const diffB = b.pointDiff ?? (b.pointsFor - b.pointsAgainst);
    if (diffB !== diffA) return diffB - diffA;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return b.winPct - a.winPct;
  });

  return list;
}

// N-squad generalization of the original 2-squad totals function — a round's team is always
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
