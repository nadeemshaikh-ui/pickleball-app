import type { RoundRow } from './db';
import type { PlayerStats } from './analytics';
import { findBiggestBlowout } from './gameStats';

export function formatRecapAsText(leaderboard: PlayerStats[], rounds: RoundRow[]): string {
  const lines: string[] = ['Session Recap', ''];

  const top3 = leaderboard.slice(0, 3);
  top3.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name} — ${p.wins}W ${p.losses}L`);
  });

  const blowout = findBiggestBlowout(rounds);
  if (blowout) {
    const margin = Math.abs(blowout.score_a! - blowout.score_b!);
    const winnerTeam = blowout.score_a! > blowout.score_b! ? blowout.team_a : blowout.team_b;
    lines.push('');
    lines.push(`Biggest win margin: ${winnerTeam.join(' & ')} by ${margin} points`);
  }

  return lines.join('\n');
}
