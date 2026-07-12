import type { RoundRow } from './db';
import {
  findClosestGame,
  findBiggestBlowout,
  computeBestPartnership,
  computeLongestWinStreak,
  computeSessionTotals,
  computeSitOutChampion,
  computePerfectRecord,
  computeNailBiters,
  computeMostGamesPlayed,
} from './gameStats';

function scoreLine(r: RoundRow): string {
  return `${r.team_a.join(' & ')} ${r.score_a} - ${r.score_b} ${r.team_b.join(' & ')}`;
}

export function formatAnalyticsAsText(rounds: RoundRow[]): string {
  const lines: string[] = ['Session Analytics', ''];

  const totals = computeSessionTotals(rounds);
  lines.push(`Total points scored: ${totals.totalPoints}`);
  lines.push('');

  const closest = findClosestGame(rounds);
  if (closest) lines.push(`Closest game: ${scoreLine(closest)}`);

  const blowout = findBiggestBlowout(rounds);
  if (blowout) lines.push(`Biggest blowout: ${scoreLine(blowout)}`);

  const partnership = computeBestPartnership(rounds);
  if (partnership) {
    lines.push(`Best partnership: ${partnership.players.join(' & ')} — ${partnership.wins}/${partnership.gamesPlayed} wins`);
  }

  const streak = computeLongestWinStreak(rounds);
  if (streak && streak.streak > 0) {
    lines.push(`Longest win streak: ${streak.name} — ${streak.streak} in a row`);
  }

  const nailBiters = computeNailBiters(rounds);
  if (nailBiters > 0) lines.push(`Nail-biters (≤2 pts): ${nailBiters}`);

  const sitOutChampion = computeSitOutChampion(rounds);
  if (sitOutChampion) lines.push(`Most rest taken: ${sitOutChampion.name} (${sitOutChampion.count} rounds)`);

  const perfectRecord = computePerfectRecord(rounds);
  if (perfectRecord.length > 0) {
    lines.push(`Perfect record: ${perfectRecord.map(p => `${p.name} (${p.wins}-0)`).join(', ')}`);
  }

  const mostGamesPlayed = computeMostGamesPlayed(rounds);
  if (mostGamesPlayed) lines.push(`Most games played: ${mostGamesPlayed.name} (${mostGamesPlayed.gamesPlayed})`);

  return lines.join('\n');
}
