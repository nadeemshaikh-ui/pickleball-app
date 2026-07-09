import type { RoundRow } from './db';
import {
  findClosestGame,
  findBiggestBlowout,
  computeBestPartnership,
  computeLongestWinStreak,
  computeSessionTotals,
} from './gameStats';

function scoreLine(r: RoundRow): string {
  return `${r.team_a.join(' & ')} ${r.score_a} - ${r.score_b} ${r.team_b.join(' & ')}`;
}

export function formatAnalyticsAsText(rounds: RoundRow[]): string {
  const lines: string[] = ["🏓 Today's Analytics", ''];

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

  return lines.join('\n');
}
