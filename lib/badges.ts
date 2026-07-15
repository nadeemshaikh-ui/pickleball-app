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

// Nail-biter tier ladder — counts games decided by 2 points or fewer,
// win or lose (a close loss is just as much of a grind as a close win).
const NAIL_BITER_TIERS: { threshold: number; tier: 1 | 2 | 3 | 4; id: string; label: string; icon: string }[] = [
  { threshold: 10, tier: 1, id: 'nail_biter_veteran', label: 'Nail-Biter Veteran', icon: 'Feather' },
  { threshold: 20, tier: 2, id: 'grinder', label: 'Grinder', icon: 'Feather' },
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
  ...NAIL_BITER_TIERS.map(t => ({ id: t.id, label: t.label, icon: t.icon, tier: t.tier, description: `${t.threshold}+ games decided by 2 points or fewer` })),
  { id: 'shutout_king', label: 'Shutout King', icon: 'Ban', description: 'Won a game without the opponent scoring' },
  { id: 'perfectionist', label: 'Perfectionist', icon: 'CheckCircle2', description: 'Went undefeated in a full session (3+ games)' },
  { id: 'night_owl', label: 'Night Owl', icon: 'Moon', description: '10+ sessions started at 8pm or later' },
  { id: 'rung_climber', label: 'Rung Climber', icon: 'ArrowUpDown', description: '10+ ladder challenge wins' },

  // Head-to-head flavor — same fetchRivalriesForPlayer data H2H page uses
  { id: 'nemesis', label: 'Nemesis', icon: 'Swords', description: 'Losing head-to-head record (5+ games) against one rival' },
  { id: 'rivalry_slayer', label: 'Rivalry Slayer', icon: 'Swords', description: 'Winning head-to-head record (10+ games, 70%+) against one rival' },

  // Ladder/leaderboard crowns — club-wide contestable, single current holder (see lib/badgeHolders.ts)
  { id: 'ladder_champion', label: 'Ladder Champion', icon: 'Crown', description: 'Currently rung #1 on the ladder' },
  { id: 'the_real_king', label: 'The Real King', icon: 'Sparkle', description: 'Currently #1 on the lifetime leaderboard' },

  // Dedication/loyalty and calendar flavor (from fetchLifetimeGameStats' date/format/roster tracking)
  { id: 'anniversary', label: 'Anniversary', icon: 'Cake', description: '1+ year since your first logged game' },
  { id: 'comeback_kid', label: 'Comeback Kid', icon: 'RotateCcw', description: 'Snapped a 5+ game losing streak with a win' },
  { id: 'scramble_specialist', label: 'Scramble Specialist', icon: 'Shuffle', description: '20+ wins in Scramble format' },
  { id: 'one_trick_pony', label: 'One-Trick Pony', icon: 'Anchor', description: '90%+ of games (min 10) in a single format' },
  { id: 'early_bird', label: 'Early Bird', icon: 'Sunrise', description: '10+ sessions started before 8am' },
  { id: 'weekend_warrior', label: 'Weekend Warrior', icon: 'CalendarDays', description: '20+ sessions on a Saturday or Sunday' },
  { id: 'monsoon_regular', label: 'Monsoon Regular', icon: 'CloudRain', description: '10+ sessions played June–September' },
  { id: 'full_house', label: 'Full House', icon: 'Users', description: 'Played in a session with 12+ total players' },
  { id: 'diwali_dink', label: 'Diwali Dink', icon: 'Sparkles', description: 'Played a session during Diwali week' },
  { id: 'ipl_widows_revenge', label: "IPL Widow's Revenge", icon: 'Tv', description: 'Played a session during an IPL final' },

  { id: 'founding_five', label: 'Founding Five', icon: 'Flag', description: 'One of the first 5 players to join the club' },
  { id: 'one_and_only', label: 'One and Only', icon: 'Heart', description: '90%+ of games (min 15) with a single partner' },

  // Contestable crown — club-wide rotating record, synced alongside the other crowns (see lib/badgeHolders.ts)
  { id: 'court_regular', label: 'Court Regular', icon: 'MapPin', description: 'Most sessions attended in the trailing 90 days' },
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
  // Optional — call sites without a fetchRivalriesForPlayer() pass omit these.
  hasLosingRivalry?: boolean; // 5+ games against one opponent, more losses than wins
  hasDominantRivalry?: boolean; // 10+ games against one opponent, 70%+ win rate
  // Optional — same fetchLifetimeGameStats() pass as the fields above, just newer.
  hasAnniversary?: boolean;
  hadComebackFromLoss?: boolean;
  scrambleWins?: number;
  isOneTrickPony?: boolean;
  earlySessions?: number;
  weekendSessions?: number;
  monsoonSessions?: number;
  playedFullHouseSession?: boolean;
  diwaliSessions?: number;
  iplFinalSessions?: number;
  // Optional — call sites without a fetchFoundingFiveNames() pass omit this.
  isFoundingFive?: boolean;
  // Derived from the same duo data as hasPowerDuo/isClubTopDuo, just a different ratio.
  isOneAndOnly?: boolean;
  // Optional — call sites without a fetchCurrentBadgeHolders() pass omit this (same as isLadderChampion/isTheRealKing).
  isCourtRegular?: boolean;
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
  const [
    { fetchMvpCounts, fetchStreaks, fetchBestDuos, fetchClosestRivalries, fetchRivalriesForPlayer, MIN_GAMES_FOR_RIVALRY },
    { fetchStreakRecords },
    { flightForRating },
    { fetchLifetimeGameStats },
    { fetchLadderStandings },
    { fetchCurrentBadgeHolders },
    { fetchFoundingFiveNames },
  ] = await Promise.all([
    import('./leagueStats'),
    import('./streakRecords'),
    import('./flights'),
    import('./lifetimeGameStats'),
    import('./ladderStandings'),
    import('./badgeHolders'),
    import('./players'),
  ]);

  const POWER_DUO_MIN_GAMES = 10;
  const POWER_DUO_MIN_WIN_RATE = 0.7;
  const RIVALRY_SLAYER_MIN_GAMES = 10;
  const RIVALRY_SLAYER_MIN_WIN_RATE = 0.7;
  const ONE_AND_ONLY_MIN_GAMES = 15;
  const ONE_AND_ONLY_MIN_SHARE = 0.9;

  const [mvpCounts, streaks, streakRecords, duos, gameStats, rivalries, ownRivalries, ladderStandings, currentHolders, foundingFive] = await Promise.all([
    fetchMvpCounts(clubId),
    fetchStreaks(clubId),
    fetchStreakRecords(clubId),
    fetchBestDuos(clubId),
    fetchLifetimeGameStats(clubId),
    fetchClosestRivalries(clubId),
    fetchRivalriesForPlayer(clubId, playerName),
    fetchLadderStandings(clubId),
    fetchCurrentBadgeHolders(clubId),
    fetchFoundingFiveNames(clubId),
  ]);

  const winStreakRecordHolder = streakRecords.find(r => r.streakType === 'win')?.holderName;
  const lossStreakRecordHolder = streakRecords.find(r => r.streakType === 'loss')?.holderName;
  const ownDuos = duos.filter(d => d.players.includes(playerName));
  const eligibleDuos = duos.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
  const topDuo = eligibleDuos.length > 0 ? [...eligibleDuos].sort((a, b) => b.winPct - a.winPct)[0] : null;
  const gs = gameStats.get(playerName);
  const maxRivalryGames = rivalries.filter(r => r.players.includes(playerName)).reduce((max, r) => Math.max(max, r.gamesTogether), 0);
  const hasLosingRivalry = ownRivalries.some(r => r.gamesTogether >= MIN_GAMES_FOR_RIVALRY && r.record[0] < r.record[1]);
  const hasDominantRivalry = ownRivalries.some(
    r => r.gamesTogether >= RIVALRY_SLAYER_MIN_GAMES && r.record[0] / r.gamesTogether >= RIVALRY_SLAYER_MIN_WIN_RATE
  );

  const ONE_TRICK_PONY_MIN_GAMES = 10;
  const ONE_TRICK_PONY_MIN_SHARE = 0.9;
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const totalFormatGames = gs ? [...gs.gamesByFormat.values()].reduce((a, b) => a + b, 0) : 0;
  const maxFormatGames = gs && gs.gamesByFormat.size > 0 ? Math.max(...gs.gamesByFormat.values()) : 0;
  const isOneTrickPony = totalFormatGames >= ONE_TRICK_PONY_MIN_GAMES && maxFormatGames / totalFormatGames >= ONE_TRICK_PONY_MIN_SHARE;
  const hasAnniversary = !!gs?.firstSessionDate && Date.now() - new Date(gs.firstSessionDate).getTime() >= ONE_YEAR_MS;

  const totalPartneredGames = ownDuos.reduce((sum, d) => sum + d.gamesPlayed, 0);
  const maxPartnerGames = ownDuos.length > 0 ? Math.max(...ownDuos.map(d => d.gamesPlayed)) : 0;
  const isOneAndOnly = totalPartneredGames >= ONE_AND_ONLY_MIN_GAMES && maxPartnerGames / totalPartneredGames >= ONE_AND_ONLY_MIN_SHARE;

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
    hasLosingRivalry,
    hasDominantRivalry,
    hasAnniversary,
    hadComebackFromLoss: gs?.hadComebackFromLoss ?? false,
    scrambleWins: gs?.winsByFormat.get('scramble') ?? 0,
    isOneTrickPony,
    earlySessions: gs?.earlySessions ?? 0,
    weekendSessions: gs?.weekendSessions ?? 0,
    monsoonSessions: gs?.monsoonSessions ?? 0,
    playedFullHouseSession: gs?.playedFullHouseSession ?? false,
    diwaliSessions: gs?.diwaliSessions ?? 0,
    iplFinalSessions: gs?.iplFinalSessions ?? 0,
    isFoundingFive: foundingFive.has(playerName),
    isOneAndOnly,
    isCourtRegular: currentHolders.get('court_regular')?.holderName === playerName,
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
  for (const t of [...NAIL_BITER_TIERS].reverse()) {
    if ((input.nailBiterGames ?? 0) >= t.threshold) {
      earned.push(findBadge(t.id));
      break;
    }
  }
  if (input.hasShutout) earned.push(findBadge('shutout_king'));
  if ((input.perfectSessions ?? 0) >= 1) earned.push(findBadge('perfectionist'));
  if ((input.nightSessions ?? 0) >= 10) earned.push(findBadge('night_owl'));
  if ((input.ladderWins ?? 0) >= 10) earned.push(findBadge('rung_climber'));
  if (input.isLadderChampion) earned.push(findBadge('ladder_champion'));
  if (input.isTheRealKing) earned.push(findBadge('the_real_king'));

  if (input.hasLosingRivalry) earned.push(findBadge('nemesis'));
  if (input.hasDominantRivalry) earned.push(findBadge('rivalry_slayer'));

  if (input.hasAnniversary) earned.push(findBadge('anniversary'));
  if (input.hadComebackFromLoss) earned.push(findBadge('comeback_kid'));
  if ((input.scrambleWins ?? 0) >= 20) earned.push(findBadge('scramble_specialist'));
  if (input.isOneTrickPony) earned.push(findBadge('one_trick_pony'));
  if ((input.earlySessions ?? 0) >= 10) earned.push(findBadge('early_bird'));
  if ((input.weekendSessions ?? 0) >= 20) earned.push(findBadge('weekend_warrior'));
  if ((input.monsoonSessions ?? 0) >= 10) earned.push(findBadge('monsoon_regular'));
  if (input.playedFullHouseSession) earned.push(findBadge('full_house'));
  if ((input.diwaliSessions ?? 0) >= 1) earned.push(findBadge('diwali_dink'));
  if ((input.iplFinalSessions ?? 0) >= 1) earned.push(findBadge('ipl_widows_revenge'));

  if (input.isFoundingFive) earned.push(findBadge('founding_five'));
  if (input.isOneAndOnly) earned.push(findBadge('one_and_only'));
  if (input.isCourtRegular) earned.push(findBadge('court_regular'));

  return earned;
}
