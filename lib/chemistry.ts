export interface ChemistryTotals {
  wins: number;
  gamesPlayed: number;
}

// duoWinPct minus the average of each player's win% when NOT playing with
// this partner — positive means the pairing overperforms either player's
// solo form, negative means it underperforms. Null when either player has
// no games outside this duo to compare against (not enough signal yet).
export function computeChemistryScore(duo: ChemistryTotals, playerA: ChemistryTotals, playerB: ChemistryTotals): number | null {
  if (duo.gamesPlayed === 0) return null;
  const soloAGames = playerA.gamesPlayed - duo.gamesPlayed;
  const soloBGames = playerB.gamesPlayed - duo.gamesPlayed;
  if (soloAGames <= 0 || soloBGames <= 0) return null;

  const soloAWinPct = (playerA.wins - duo.wins) / soloAGames;
  const soloBWinPct = (playerB.wins - duo.wins) / soloBGames;
  const duoWinPct = duo.wins / duo.gamesPlayed;

  return duoWinPct - (soloAWinPct + soloBWinPct) / 2;
}
