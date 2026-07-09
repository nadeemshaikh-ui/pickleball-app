import type { PlayerStats } from './analytics';

export function formatLeaderboardAsText(
  leaderboard: PlayerStats[],
  gamesCompleted: number,
  gamesTotal: number
): string {
  const lines: string[] = ['🏓 Leaderboard', `${gamesCompleted} of ${gamesTotal} games played`, ''];
  leaderboard.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name} — ${p.wins}W ${p.losses}L (${p.pointsFor}-${p.pointsAgainst})`);
  });
  return lines.join('\n');
}
