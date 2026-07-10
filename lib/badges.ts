// Badges are derived state — computed live from existing stats (games
// played, streak, MVP count, flight), not a separately-awarded/stored
// event. Simpler and avoids an idempotency table: a badge either currently
// applies or it doesn't, recomputed fresh every time, same as flight bands.
export interface Badge {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export const BADGE_CATALOG: Badge[] = [
  { id: 'iron_man', label: 'Iron Man', emoji: '💪', description: '50+ lifetime games' },
  { id: 'century_club', label: 'Century Club', emoji: '💯', description: '100+ lifetime games' },
  { id: 'hot_streak_5', label: 'Hot Streak', emoji: '🔥', description: '5-game win streak' },
  { id: 'unstoppable', label: 'Unstoppable', emoji: '🚀', description: '10-game win streak' },
  { id: 'fan_favorite', label: 'Fan Favorite', emoji: '⭐', description: '3+ session MVP awards' },
  { id: 'gold_flight', label: 'Gold Flight', emoji: '🥇', description: 'Reached Gold flight' },
  { id: 'platinum_flight', label: 'Platinum Flight', emoji: '🏆', description: 'Reached Platinum flight' },
];

export interface PlayerBadgeInput {
  gamesPlayed: number;
  currentStreak: number;
  mvpCount: number;
  flight: string;
}

function findBadge(id: string): Badge {
  const badge = BADGE_CATALOG.find(b => b.id === id);
  if (!badge) throw new Error(`Unknown badge id: ${id}`);
  return badge;
}

export function computeBadges(input: PlayerBadgeInput): Badge[] {
  const earned: Badge[] = [];
  if (input.gamesPlayed >= 50) earned.push(findBadge('iron_man'));
  if (input.gamesPlayed >= 100) earned.push(findBadge('century_club'));
  if (input.currentStreak >= 5) earned.push(findBadge('hot_streak_5'));
  if (input.currentStreak >= 10) earned.push(findBadge('unstoppable'));
  if (input.mvpCount >= 3) earned.push(findBadge('fan_favorite'));
  if (input.flight === 'Gold') earned.push(findBadge('gold_flight'));
  if (input.flight === 'Platinum') earned.push(findBadge('platinum_flight'));
  return earned;
}
