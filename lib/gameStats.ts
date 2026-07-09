import type { RoundRow } from './db';

function scoredRounds(rounds: RoundRow[]): RoundRow[] {
  return rounds.filter(r => r.score_a !== null && r.score_b !== null);
}

export function findClosestGame(rounds: RoundRow[]): RoundRow | null {
  const scored = scoredRounds(rounds);
  if (scored.length === 0) return null;
  return scored.reduce((best, r) =>
    Math.abs(r.score_a! - r.score_b!) < Math.abs(best.score_a! - best.score_b!) ? r : best
  );
}

export function findBiggestBlowout(rounds: RoundRow[]): RoundRow | null {
  const scored = scoredRounds(rounds);
  if (scored.length === 0) return null;
  return scored.reduce((best, r) =>
    Math.abs(r.score_a! - r.score_b!) > Math.abs(best.score_a! - best.score_b!) ? r : best
  );
}

export interface PartnershipStats {
  players: [string, string];
  wins: number;
  gamesPlayed: number;
  winPct: number;
}

export function computeBestPartnership(rounds: RoundRow[]): PartnershipStats | null {
  const scored = scoredRounds(rounds);
  const stats = new Map<string, PartnershipStats>();

  function key(pair: [string, string]) {
    return [...pair].sort().join('|');
  }

  for (const r of scored) {
    const aWon = r.score_a! > r.score_b!;
    for (const [pair, won] of [
      [r.team_a, aWon],
      [r.team_b, !aWon],
    ] as [[string, string], boolean][]) {
      const k = key(pair);
      const existing = stats.get(k) ?? { players: [...pair].sort() as [string, string], wins: 0, gamesPlayed: 0, winPct: 0 };
      existing.gamesPlayed++;
      if (won) existing.wins++;
      stats.set(k, existing);
    }
  }

  const list = [...stats.values()];
  for (const s of list) s.winPct = s.wins / s.gamesPlayed;
  if (list.length === 0) return null;

  list.sort((a, b) => (b.winPct !== a.winPct ? b.winPct - a.winPct : b.gamesPlayed - a.gamesPlayed));
  return list[0];
}

export interface StreakStats {
  name: string;
  streak: number;
}

export function computeLongestWinStreak(rounds: RoundRow[]): StreakStats | null {
  const scored = scoredRounds(rounds).sort((a, b) => a.round_number - b.round_number);
  const players = new Set<string>();
  for (const r of scored) {
    for (const p of [...r.team_a, ...r.team_b]) players.add(p);
  }

  let best: StreakStats | null = null;
  for (const player of players) {
    let current = 0;
    let max = 0;
    for (const r of scored) {
      const inA = r.team_a.includes(player);
      const inB = r.team_b.includes(player);
      if (!inA && !inB) continue;
      const aWon = r.score_a! > r.score_b!;
      const won = (inA && aWon) || (inB && !aWon);
      current = won ? current + 1 : 0;
      max = Math.max(max, current);
    }
    if (!best || max > best.streak) {
      best = { name: player, streak: max };
    }
  }

  return best;
}

export function computeSessionTotals(rounds: RoundRow[]): { totalGames: number; totalPoints: number } {
  const scored = scoredRounds(rounds);
  const totalGames = scored.length;
  const totalPoints = scored.reduce((sum, r) => sum + r.score_a! + r.score_b!, 0);
  return { totalGames, totalPoints };
}
