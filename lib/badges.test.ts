import { describe, it, expect } from 'vitest';
import { computeBadges } from './badges';

describe('computeBadges', () => {
  it('awards nothing for a fresh player', () => {
    expect(computeBadges({ gamesPlayed: 5, currentStreak: 1, mvpCount: 0, flight: 'Bronze' })).toEqual([]);
  });

  it('awards the volume tier ladder, highest tier only', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: n, currentStreak: 0, mvpCount: 0, flight: 'Bronze' }).map(b => b.id);
    expect(ids(9)).not.toContain('the_regular');
    expect(ids(10)).toEqual(['the_regular']);
    expect(ids(99)).toEqual(['the_regular']);
    expect(ids(100)).toEqual(['century_club']);
    expect(ids(250)).toEqual(['iron_paddle']);
    expect(ids(500)).toContain('living_legend');
    expect(ids(500)).not.toContain('century_club');
  });

  it('awards streak badges at 3, 5, and 10 — all stack, no highest-only rule', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: 0, currentStreak: n, mvpCount: 0, flight: 'Bronze' }).map(b => b.id);
    expect(ids(2)).toEqual([]);
    expect(ids(3)).toEqual(['on_a_roll']);
    expect(ids(5)).toEqual(['on_a_roll', 'hot_streak_5']);
    expect(ids(10)).toEqual(['on_a_roll', 'hot_streak_5', 'unstoppable']);
  });

  it('awards the streak crown only to the record holder', () => {
    const base = { gamesPlayed: 0, currentStreak: 3, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, isWinStreakRecordHolder: true }).map(b => b.id)).toContain('streak_king');
    expect(computeBadges({ ...base, isLossStreakRecordHolder: true }).map(b => b.id)).toContain('wooden_spoon');
    expect(computeBadges(base).map(b => b.id)).not.toContain('streak_king');
  });

  it('awards MVP tiers, highest tier only', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: 0, currentStreak: 0, mvpCount: n, flight: 'Bronze' }).map(b => b.id);
    expect(ids(0)).toEqual([]);
    expect(ids(1)).toEqual(['fan_favorite']);
    expect(ids(3)).toEqual(['crowd_pleaser']);
    expect(ids(15)).toEqual(['hall_of_famer']);
  });

  it('awards flight badges only for Gold/Platinum, not lower flights', () => {
    const idsFor = (flight: string) => computeBadges({ gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight }).map(b => b.id);
    expect(idsFor('Bronze')).toEqual([]);
    expect(idsFor('Silver')).toEqual([]);
    expect(idsFor('Gold')).toEqual(['gold_flight']);
    expect(idsFor('Platinum')).toEqual(['platinum_flight']);
  });

  it('awards duo badges from the optional partnership inputs', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, hasPowerDuo: true }).map(b => b.id)).toContain('power_duo');
    expect(computeBadges({ ...base, isClubTopDuo: true }).map(b => b.id)).toContain('golden_pair');
    expect(computeBadges({ ...base, duoCount: 10 }).map(b => b.id)).toContain('chemistry_lab');
    expect(computeBadges({ ...base, duoCount: 9 }).map(b => b.id)).not.toContain('chemistry_lab');
  });

  it('awards lifetime game-log badges from the optional fetchLifetimeGameStats inputs', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, maxRivalryGames: 15 }).map(b => b.id)).toContain('arch_rivals');
    expect(computeBadges({ ...base, maxRivalryGames: 14 }).map(b => b.id)).not.toContain('arch_rivals');
    expect(computeBadges({ ...base, formatsPlayed: 5 }).map(b => b.id)).toContain('format_explorer');
    expect(computeBadges({ ...base, formatsPlayed: 4 }).map(b => b.id)).not.toContain('format_explorer');
    expect(computeBadges({ ...base, squadRivalryWins: 20 }).map(b => b.id)).toContain('squad_legend');
    expect(computeBadges({ ...base, maxWinMargin: 8 }).map(b => b.id)).toContain('blowout_artist');
    expect(computeBadges({ ...base, nailBiterGames: 10 }).map(b => b.id)).toContain('nail_biter_veteran');
    expect(computeBadges({ ...base, hasShutout: true }).map(b => b.id)).toContain('shutout_king');
    expect(computeBadges({ ...base, perfectSessions: 1 }).map(b => b.id)).toContain('perfectionist');
    expect(computeBadges({ ...base, nightSessions: 10 }).map(b => b.id)).toContain('night_owl');
    expect(computeBadges({ ...base, ladderWins: 10 }).map(b => b.id)).toContain('rung_climber');
  });

  it('awards the nail-biter tier ladder, highest tier only', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze', nailBiterGames: n }).map(b => b.id);
    expect(ids(9)).toEqual([]);
    expect(ids(10)).toEqual(['nail_biter_veteran']);
    expect(ids(20)).toEqual(['grinder']);
  });

  it('awards nemesis/rivalry-slayer from the optional rivalry-record inputs', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, hasLosingRivalry: true }).map(b => b.id)).toContain('nemesis');
    expect(computeBadges({ ...base, hasDominantRivalry: true }).map(b => b.id)).toContain('rivalry_slayer');
    expect(computeBadges(base).map(b => b.id)).not.toContain('nemesis');
    expect(computeBadges(base).map(b => b.id)).not.toContain('rivalry_slayer');
  });

  it('awards the new dedication/calendar badges from the optional fetchLifetimeGameStats inputs', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, hasAnniversary: true }).map(b => b.id)).toContain('anniversary');
    expect(computeBadges({ ...base, hadComebackFromLoss: true }).map(b => b.id)).toContain('comeback_kid');
    expect(computeBadges({ ...base, scrambleWins: 20 }).map(b => b.id)).toContain('scramble_specialist');
    expect(computeBadges({ ...base, scrambleWins: 19 }).map(b => b.id)).not.toContain('scramble_specialist');
    expect(computeBadges({ ...base, isOneTrickPony: true }).map(b => b.id)).toContain('one_trick_pony');
    expect(computeBadges({ ...base, earlySessions: 10 }).map(b => b.id)).toContain('early_bird');
    expect(computeBadges({ ...base, weekendSessions: 20 }).map(b => b.id)).toContain('weekend_warrior');
    expect(computeBadges({ ...base, monsoonSessions: 10 }).map(b => b.id)).toContain('monsoon_regular');
    expect(computeBadges({ ...base, playedFullHouseSession: true }).map(b => b.id)).toContain('full_house');
    expect(computeBadges({ ...base, diwaliSessions: 1 }).map(b => b.id)).toContain('diwali_dink');
    expect(computeBadges({ ...base, iplFinalSessions: 1 }).map(b => b.id)).toContain('ipl_widows_revenge');
    expect(computeBadges(base).map(b => b.id)).toEqual([]);
  });

  it('awards Founding Five/One and Only/Court Regular/Regular\'s Regular from their optional inputs', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, isFoundingFive: true }).map(b => b.id)).toContain('founding_five');
    expect(computeBadges({ ...base, isOneAndOnly: true }).map(b => b.id)).toContain('one_and_only');
    expect(computeBadges({ ...base, isCourtRegular: true }).map(b => b.id)).toContain('court_regular');
    expect(computeBadges({ ...base, isRegularsRegular: true }).map(b => b.id)).toContain('regulars_regular');
    expect(computeBadges(base).map(b => b.id)).toEqual([]);
  });

  it('awards Giant Slayer from 1+ ladder wins as the lower-ranked side', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, giantSlayerWins: 1 }).map(b => b.id)).toContain('giant_slayer');
    expect(computeBadges({ ...base, giantSlayerWins: 0 }).map(b => b.id)).not.toContain('giant_slayer');
    expect(computeBadges(base).map(b => b.id)).not.toContain('giant_slayer');
  });

  it('awards Glow-Up/Player of the Month/Three-Peat from the optional forward-only history inputs', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, hasGlowUp: true }).map(b => b.id)).toContain('glow_up');
    expect(computeBadges({ ...base, hasWonPotm: true }).map(b => b.id)).toContain('player_of_the_month');
    expect(computeBadges({ ...base, hasThreePeat: true }).map(b => b.id)).toContain('three_peat');
    expect(computeBadges(base).map(b => b.id)).toEqual([]);
  });

  it('awards the 5 new exclusive crowns from the optional isXxx inputs', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, isIronThrone: true }).map(b => b.id)).toContain('iron_throne');
    expect(computeBadges({ ...base, isHeadHoncho: true }).map(b => b.id)).toContain('head_honcho');
    expect(computeBadges({ ...base, isUndisputed: true }).map(b => b.id)).toContain('undisputed');
    expect(computeBadges({ ...base, isGatekeeper: true }).map(b => b.id)).toContain('the_gatekeeper');
    expect(computeBadges({ ...base, isUntouchable: true }).map(b => b.id)).toContain('the_untouchable');
    expect(computeBadges(base).map(b => b.id)).toEqual([]);
  });

  it('awards crown badges only to the current holder', () => {
    const base = { gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight: 'Bronze' };
    expect(computeBadges({ ...base, isLadderChampion: true }).map(b => b.id)).toContain('ladder_champion');
    expect(computeBadges({ ...base, isTheRealKing: true }).map(b => b.id)).toContain('the_real_king');
    expect(computeBadges(base).map(b => b.id)).not.toContain('ladder_champion');
    expect(computeBadges(base).map(b => b.id)).not.toContain('the_real_king');
  });

  it('stacks multiple badges at once', () => {
    const badges = computeBadges({
      gamesPlayed: 100,
      currentStreak: 10,
      mvpCount: 3,
      flight: 'Platinum',
      isWinStreakRecordHolder: true,
    });
    const ids = badges.map(b => b.id);
    expect(ids).toEqual(['century_club', 'on_a_roll', 'hot_streak_5', 'unstoppable', 'streak_king', 'crowd_pleaser', 'platinum_flight']);
  });
});
