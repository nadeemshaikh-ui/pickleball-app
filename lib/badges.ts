// Badges are derived state — computed live from existing stats, not a
// separately-awarded/stored event. `lib/badgeEvents.ts` layers unlock
// detection on top of this (diffing computed badges against previously-seen
// ones) for the celebration/share moment — this file only decides which
// badges currently apply.
//
// Scope note: this catalog only includes badges with real data behind them
// today. Rivalry, scoreline, format-specific, ladder, season, and secret
// badges from the design spec need data sources not wired into any call
// site yet (session timestamps, ladder history, per-format aggregates) and
// are deferred rather than faked.
export interface Badge {
  id: string;
  label: string;
  emoji: string;
  description: string;
  tier?: 1 | 2 | 3 | 4; // bronze/silver/gold/platinum, for medallion ring color
}

// Games-played tier ladder.
const VOLUME_TIERS: { threshold: number; tier: 1 | 2 | 3 | 4; id: string; label: string; emoji: string }[] = [
  { threshold: 10, tier: 1, id: 'kitchen_regular', label: 'Kitchen Regular', emoji: '🥒' },
  { threshold: 25, tier: 2, id: 'dink_master', label: 'Dink Master', emoji: '🎯' },
  { threshold: 50, tier: 3, id: 'rally_beast', label: 'Rally Beast', emoji: '💪' },
  { threshold: 100, tier: 4, id: 'pickle_royalty', label: 'Pickle Royalty', emoji: '👑' },
];

// MVP-count tier ladder.
const MVP_TIERS: { threshold: number; tier: 1 | 2 | 3 | 4; id: string; label: string; emoji: string }[] = [
  { threshold: 1, tier: 1, id: 'fan_favorite', label: 'Fan Favorite', emoji: '⭐' },
  { threshold: 3, tier: 2, id: 'crowd_pleaser', label: 'Crowd Pleaser', emoji: '🌟' },
  { threshold: 7, tier: 3, id: 'mvp_regular', label: 'MVP Regular', emoji: '🏅' },
  { threshold: 15, tier: 4, id: 'hall_of_famer', label: 'Hall of Famer', emoji: '🏛️' },
];

export const BADGE_CATALOG: Badge[] = [
  // Volume tiers
  ...VOLUME_TIERS.map(t => ({ id: t.id, label: t.label, emoji: t.emoji, tier: t.tier, description: `${t.threshold}+ lifetime games` })),
  { id: 'paddle_legend', label: 'Paddle Legend', emoji: '🪵', description: '200+ lifetime games' },
  { id: 'ironwood', label: 'Ironwood', emoji: '🌳', description: '500+ lifetime games' },

  // Win-streak flavor
  { id: 'hot_streak_5', label: 'Hot Streak', emoji: '🔥', description: '5-game win streak' },
  { id: 'unstoppable', label: 'Unstoppable', emoji: '🚀', description: '10-game win streak' },

  // Streak crown — club-wide contestable record, not a personal quota
  { id: 'streak_king', label: 'The Streak King', emoji: '👑', description: 'Holds the club’s all-time win-streak record' },
  { id: 'wooden_spoon', label: 'Wooden Spoon', emoji: '🥄', description: 'Holds the club’s all-time losing-streak record' },

  // MVP tiers
  ...MVP_TIERS.map(t => ({ id: t.id, label: t.label, emoji: t.emoji, tier: t.tier, description: `${t.threshold}+ session MVP awards` })),

  // Flight
  { id: 'gold_flight', label: 'Gold Flight', emoji: '🥇', description: 'Reached Gold flight' },
  { id: 'platinum_flight', label: 'Platinum Flight', emoji: '🏆', description: 'Reached Platinum flight' },

  // Partnership (uses duo stats already computed for the stats page)
  { id: 'power_duo', label: 'Power Duo', emoji: '🤝', description: '10+ games with one partner at a 70%+ win rate' },
  { id: 'golden_pair', label: 'Golden Pair', emoji: '💫', description: 'Club’s #1 duo by win rate' },
  { id: 'chemistry_lab', label: 'Chemistry Lab', emoji: '🧪', description: 'Played with 10+ different partners' },
];

function findBadge(id: string): Badge {
  const badge = BADGE_CATALOG.find(b => b.id === id);
  if (!badge) throw new Error(`Unknown badge id: ${id}`);
  return badge;
}

export interface PlayerBadgeInput {
  gamesPlayed: number;
  currentStreak: number;
  mvpCount: number;
  flight: string;
  // Optional — call sites without streak-record/duo data (e.g. the
  // post-session results screen) can omit these; they default to "not earned".
  isWinStreakRecordHolder?: boolean;
  isLossStreakRecordHolder?: boolean;
  duoCount?: number;
  hasPowerDuo?: boolean; // any single partner: 10+ games together, 70%+ win rate
  isClubTopDuo?: boolean; // this player is in the club's #1 duo by win rate
}

export function computeBadges(input: PlayerBadgeInput): Badge[] {
  const earned: Badge[] = [];

  for (const t of [...VOLUME_TIERS].reverse()) {
    if (input.gamesPlayed >= t.threshold) {
      earned.push(findBadge(t.id));
      break; // highest tier only, avoids cluttering the row with all lower tiers too
    }
  }
  if (input.gamesPlayed >= 500) earned.push(findBadge('ironwood'));
  else if (input.gamesPlayed >= 200) earned.push(findBadge('paddle_legend'));

  if (input.currentStreak >= 5) earned.push(findBadge('hot_streak_5'));
  if (input.currentStreak >= 10) earned.push(findBadge('unstoppable'));

  if (input.isWinStreakRecordHolder) earned.push(findBadge('streak_king'));
  if (input.isLossStreakRecordHolder) earned.push(findBadge('wooden_spoon'));

  for (const t of [...MVP_TIERS].reverse()) {
    if (input.mvpCount >= t.threshold) {
      earned.push(findBadge(t.id));
      break;
    }
  }

  if (input.flight === 'Gold') earned.push(findBadge('gold_flight'));
  if (input.flight === 'Platinum') earned.push(findBadge('platinum_flight'));

  if (input.hasPowerDuo) earned.push(findBadge('power_duo'));
  if (input.isClubTopDuo) earned.push(findBadge('golden_pair'));
  if ((input.duoCount ?? 0) >= 10) earned.push(findBadge('chemistry_lab'));

  return earned;
}
