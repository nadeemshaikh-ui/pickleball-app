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

export function computeSessionTotals(rounds: RoundRow[]): { totalGames: number; totalPoints: number; biggestMargin: number } {
  const scored = scoredRounds(rounds);
  const totalGames = scored.length;
  const totalPoints = scored.reduce((sum, r) => sum + r.score_a! + r.score_b!, 0);
  const biggestMargin = scored.reduce((max, r) => Math.max(max, Math.abs(r.score_a! - r.score_b!)), 0);
  return { totalGames, totalPoints, biggestMargin };
}

export interface TopScorer {
  name: string;
  points: number;
}

export function computeTopScorer(rounds: RoundRow[]): TopScorer | null {
  const scored = scoredRounds(rounds);
  const points = new Map<string, number>();
  for (const r of scored) {
    for (const p of r.team_a) points.set(p, (points.get(p) ?? 0) + r.score_a!);
    for (const p of r.team_b) points.set(p, (points.get(p) ?? 0) + r.score_b!);
  }
  let best: TopScorer | null = null;
  for (const [name, total] of points) {
    if (!best || total > best.points) best = { name, points: total };
  }
  return best;
}

export interface SitOutStats {
  name: string;
  count: number;
}

// Counts sit-outs per round, not per row — a player sitting out shows up on
// both court rows for that round in Scramble/Squad Rivalry (shared sit-out
// list), so counting rows directly would double it.
export function computeSitOutChampion(rounds: RoundRow[]): SitOutStats | null {
  const byRound = new Map<number, Set<string>>();
  for (const r of rounds) {
    const set = byRound.get(r.round_number) ?? new Set<string>();
    for (const p of r.sitting_out) set.add(p);
    byRound.set(r.round_number, set);
  }
  const counts = new Map<string, number>();
  for (const set of byRound.values()) {
    for (const p of set) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let best: SitOutStats | null = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

export interface PerfectRecordPlayer {
  name: string;
  wins: number;
}

// Players who have won every game they've played (at least one game).
export function computePerfectRecord(rounds: RoundRow[]): PerfectRecordPlayer[] {
  const scored = scoredRounds(rounds);
  const stats = new Map<string, { wins: number; losses: number }>();

  for (const r of scored) {
    const aWon = r.score_a! > r.score_b!;
    for (const p of r.team_a) {
      const s = stats.get(p) ?? { wins: 0, losses: 0 };
      aWon ? s.wins++ : s.losses++;
      stats.set(p, s);
    }
    for (const p of r.team_b) {
      const s = stats.get(p) ?? { wins: 0, losses: 0 };
      !aWon ? s.wins++ : s.losses++;
      stats.set(p, s);
    }
  }

  return [...stats.entries()]
    .filter(([, s]) => s.losses === 0 && s.wins > 0)
    .map(([name, s]) => ({ name, wins: s.wins }));
}

// Counts scored games decided by a small margin (default: 2 points or fewer).
export function computeNailBiters(rounds: RoundRow[], marginThreshold = 2): number {
  return scoredRounds(rounds).filter(r => Math.abs(r.score_a! - r.score_b!) <= marginThreshold).length;
}

export interface GamesPlayedStats {
  name: string;
  gamesPlayed: number;
}

// With multiple courts and uneven sit-out counts, games-played can genuinely
// differ between players — this surfaces who's gotten the most court time.
export function computeMostGamesPlayed(rounds: RoundRow[]): GamesPlayedStats | null {
  const scored = scoredRounds(rounds);
  const counts = new Map<string, number>();
  for (const r of scored) {
    for (const p of [...r.team_a, ...r.team_b]) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let best: GamesPlayedStats | null = null;
  for (const [name, gamesPlayed] of counts) {
    if (!best || gamesPlayed > best.gamesPlayed) best = { name, gamesPlayed };
  }
  return best;
}
