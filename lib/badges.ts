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
// `icon` is a lucide-react icon component name (see components/BadgeMedallion.tsx
// for the name -> component map) — no emoji anywhere in the catalog.
export interface Badge {
  id: string;
  label: string;
  icon: string;
  description: string;
  tier?: 1 | 2 | 3 | 4; // bronze/silver/gold/platinum, for medallion ring color
}

// Games-played tier ladder. Named for dedication/attendance, not skill —
// a raw counter can't tell you how good someone is, only how often they show
// up, so the names stay in that lane instead of claiming "mastery".
const VOLUME_TIERS: { threshold: number; tier: 1 | 2 | 3 | 4; id: string; label: string; icon: string }[] = [
  { threshold: 10, tier: 1, id: 'the_regular', label: 'The Regular', icon: 'Salad' },
  { threshold: 100, tier: 2, id: 'century_club', label: 'Century Club', icon: 'Target' },
  { threshold: 250, tier: 3, id: 'iron_paddle', label: 'Iron Paddle', icon: 'Dumbbell' },
  { threshold: 500, tier: 4, id: 'living_legend', label: 'Living Legend', icon: 'Crown' },
];

// MVP-count tier ladder — legitimately skill/character-flavored since MVP
// is peer-voted recognition, not a raw counter.
const MVP_TIERS: { threshold: number; tier: 1 | 2 | 3 | 4; id: string; label: string; icon: string }[] = [
  { threshold: 1, tier: 1, id: 'fan_favorite', label: 'Fan Favorite', icon: 'Star' },
  { threshold: 3, tier: 2, id: 'crowd_pleaser', label: 'Crowd Pleaser', icon: 'Sparkles' },
  { threshold: 15, tier: 4, id: 'hall_of_famer', label: 'Hall of Famer', icon: 'Landmark' },
];

export const BADGE_CATALOG: Badge[] = [
  // Volume tiers
  ...VOLUME_TIERS.map(t => ({ id: t.id, label: t.label, icon: t.icon, tier: t.tier, description: `${t.threshold}+ lifetime games` })),

  // Win-streak flavor
  { id: 'on_a_roll', label: 'On a Roll', icon: 'Sparkle', description: '3-game win streak' },
  { id: 'hot_streak_5', label: 'Hot Streak', icon: 'Flame', description: '5-game win streak' },
  { id: 'unstoppable', label: 'Unstoppable', icon: 'Rocket', description: '10-game win streak' },

  // Streak crown — club-wide contestable record, not a personal quota
  { id: 'streak_king', label: 'The Streak King', icon: 'Crown', description: 'Holds the club’s all-time win-streak record' },
  { id: 'wooden_spoon', label: 'Wooden Spoon', icon: 'UtensilsCrossed', description: 'Holds the club’s all-time losing-streak record' },

  // MVP tiers
  ...MVP_TIERS.map(t => ({ id: t.id, label: t.label, icon: t.icon, tier: t.tier, description: `${t.threshold}+ session MVP awards` })),

  // Flight
  { id: 'gold_flight', label: 'Gold Flight', icon: 'Medal', description: 'Reached Gold flight' },
  { id: 'platinum_flight', label: 'Platinum Flight', icon: 'Trophy', description: 'Reached Platinum flight' },

  // Partnership (uses duo stats already computed for the stats page)
  { id: 'power_duo', label: 'Power Duo', icon: 'Handshake', description: '10+ games with one partner at a 70%+ win rate' },
  { id: 'golden_pair', label: 'Golden Pair', icon: 'Gem', description: 'Club’s #1 duo by win rate' },
  { id: 'chemistry_lab', label: 'Chemistry Lab', icon: 'FlaskConical', description: 'Played with 10+ different partners' },

  // Lifetime game-log flavor (from fetchLifetimeGameStats — one full scan of scored rounds)
  { id: 'arch_rivals', label: 'Arch Rivals', icon: 'Swords', description: '15+ games against one rival' },
  { id: 'format_explorer', label: 'Format Explorer', icon: 'Compass', description: 'Played every session format at least once' },
  { id: 'squad_legend', label: 'Squad Legend', icon: 'Layers', description: '20+ wins in Squad Rivalry' },
  { id: 'blowout_artist', label: 'Blowout Artist', icon: 'Zap', description: 'Won a game by 8+ points' },
  { id: 'nail_biter_veteran', label: 'Nail-Biter Veteran', icon: 'Feather', description: '10+ games decided by 2 points or fewer' },
  { id: 'shutout_king', label: 'Shutout King', icon: 'Ban', description: 'Won a game without the opponent scoring' },
  { id: 'perfectionist', label: 'Perfectionist', icon: 'CheckCircle2', description: 'Went undefeated in a full session (3+ games)' },
  { id: 'night_owl', label: 'Night Owl', icon: 'Moon', description: '10+ sessions started at 8pm or later' },
  { id: 'rung_climber', label: 'Rung Climber', icon: 'ArrowUpDown', description: '10+ ladder challenge wins' },

  // Ladder/leaderboard crowns — club-wide contestable, single current holder (see lib/badgeHolders.ts)
  { id: 'ladder_champion', label: 'Ladder Champion', icon: 'Crown', description: 'Currently rung #1 on the ladder' },
  { id: 'the_real_king', label: 'The Real King', icon: 'Sparkle', description: 'Currently #1 on the lifetime leaderboard' },
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
  // Optional — call sites without a fetchLifetimeGameStats() pass omit these.
  maxRivalryGames?: number;
  formatsPlayed?: number;
  squadRivalryWins?: number;
  maxWinMargin?: number;
  nailBiterGames?: number;
  hasShutout?: boolean;
  perfectSessions?: number;
  nightSessions?: number;
  ladderWins?: number;
  isLadderChampion?: boolean;
  isTheRealKing?: boolean;
}

export const ALL_SESSION_FORMATS_COUNT = 5;

// Assembles a complete PlayerBadgeInput from every data source the badge
// system currently uses — the single shared path every call site should go
// through. Before this, Home/Wrapped built a partial input by hand (missing
// rivalry/format/ladder fields that Stats/Badges included), so the same
// player's earned-badge list could differ depending which page they were
// on. Import cycle note: dynamic imports below avoid a static circular
// dependency between badges.ts and the lib modules that already import
// badge-related types.
export async function buildBadgeInput(clubId: string, playerName: string, gamesPlayed: number, eloRating: number): Promise<PlayerBadgeInput> {
  const [{ fetchMvpCounts, fetchStreaks, fetchBestDuos, fetchClosestRivalries }, { fetchStreakRecords }, { flightForRating }, { fetchLifetimeGameStats }, { fetchLadderStandings }, { fetchCurrentBadgeHolders }] =
    await Promise.all([
      import('./leagueStats'),
      import('./streakRecords'),
      import('./flights'),
      import('./lifetimeGameStats'),
      import('./ladderStandings'),
      import('./badgeHolders'),
    ]);

  const POWER_DUO_MIN_GAMES = 10;
  const POWER_DUO_MIN_WIN_RATE = 0.7;

  const [mvpCounts, streaks, streakRecords, duos, gameStats, rivalries, ladderStandings, currentHolders] = await Promise.all([
    fetchMvpCounts(clubId),
    fetchStreaks(clubId),
    fetchStreakRecords(clubId),
    fetchBestDuos(clubId),
    fetchLifetimeGameStats(clubId),
    fetchClosestRivalries(clubId),
    fetchLadderStandings(clubId),
    fetchCurrentBadgeHolders(clubId),
  ]);

  const winStreakRecordHolder = streakRecords.find(r => r.streakType === 'win')?.holderName;
  const lossStreakRecordHolder = streakRecords.find(r => r.streakType === 'loss')?.holderName;
  const ownDuos = duos.filter(d => d.players.includes(playerName));
  const eligibleDuos = duos.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
  const topDuo = eligibleDuos.length > 0 ? [...eligibleDuos].sort((a, b) => b.winPct - a.winPct)[0] : null;
  const gs = gameStats.get(playerName);
  const maxRivalryGames = rivalries.filter(r => r.players.includes(playerName)).reduce((max, r) => Math.max(max, r.gamesTogether), 0);

  return {
    gamesPlayed,
    currentStreak: streaks.get(playerName) ?? 0,
    mvpCount: mvpCounts.get(playerName) ?? 0,
    flight: flightForRating(eloRating),
    isWinStreakRecordHolder: winStreakRecordHolder === playerName,
    isLossStreakRecordHolder: lossStreakRecordHolder === playerName,
    duoCount: ownDuos.length,
    hasPowerDuo: ownDuos.some(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES && d.winPct >= POWER_DUO_MIN_WIN_RATE),
    isClubTopDuo: topDuo !== null && topDuo.players.includes(playerName),
    maxRivalryGames,
    formatsPlayed: gs?.formats.size ?? 0,
    squadRivalryWins: gs?.squadRivalryWins ?? 0,
    maxWinMargin: gs?.maxMargin ?? 0,
    nailBiterGames: gs?.nailBiters ?? 0,
    hasShutout: (gs?.shutouts ?? 0) > 0,
    perfectSessions: gs?.perfectSessions ?? 0,
    nightSessions: gs?.nightSessions ?? 0,
    ladderWins: ladderStandings.find(s => s.player_name === playerName)?.wins ?? 0,
    isLadderChampion: currentHolders.get('ladder_champion')?.holderName === playerName,
    isTheRealKing: currentHolders.get('the_real_king')?.holderName === playerName,
  };
}

export function computeBadges(input: PlayerBadgeInput): Badge[] {
  const earned: Badge[] = [];

  for (const t of [...VOLUME_TIERS].reverse()) {
    if (input.gamesPlayed >= t.threshold) {
      earned.push(findBadge(t.id));
      break; // highest tier only, avoids cluttering the row with all lower tiers too
    }
  }

  if (input.currentStreak >= 3) earned.push(findBadge('on_a_roll'));
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

  if ((input.maxRivalryGames ?? 0) >= 15) earned.push(findBadge('arch_rivals'));
  if ((input.formatsPlayed ?? 0) >= ALL_SESSION_FORMATS_COUNT) earned.push(findBadge('format_explorer'));
  if ((input.squadRivalryWins ?? 0) >= 20) earned.push(findBadge('squad_legend'));
  if ((input.maxWinMargin ?? 0) >= 8) earned.push(findBadge('blowout_artist'));
  if ((input.nailBiterGames ?? 0) >= 10) earned.push(findBadge('nail_biter_veteran'));
  if (input.hasShutout) earned.push(findBadge('shutout_king'));
  if ((input.perfectSessions ?? 0) >= 1) earned.push(findBadge('perfectionist'));
  if ((input.nightSessions ?? 0) >= 10) earned.push(findBadge('night_owl'));
  if ((input.ladderWins ?? 0) >= 10) earned.push(findBadge('rung_climber'));
  if (input.isLadderChampion) earned.push(findBadge('ladder_champion'));
  if (input.isTheRealKing) earned.push(findBadge('the_real_king'));

  return earned;
}
