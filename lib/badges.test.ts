import { describe, it, expect } from 'vitest';
import { computeBadges } from './badges';

describe('computeBadges', () => {
  it('awards nothing for a fresh player', () => {
    expect(computeBadges({ gamesPlayed: 5, currentStreak: 1, mvpCount: 0, flight: 'Bronze' })).toEqual([]);
  });

  it('awards the volume tier ladder, highest tier only', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: n, currentStreak: 0, mvpCount: 0, flight: 'Bronze' }).map(b => b.id);
    expect(ids(9)).not.toContain('kitchen_regular');
    expect(ids(10)).toEqual(['kitchen_regular']);
    expect(ids(25)).toEqual(['dink_master']);
    expect(ids(50)).toEqual(['rally_beast']);
    expect(ids(100)).toContain('pickle_royalty');
    expect(ids(100)).not.toContain('kitchen_regular');
  });

  it('stacks rare milestones on top of the tier badge', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: n, currentStreak: 0, mvpCount: 0, flight: 'Bronze' }).map(b => b.id);
    expect(ids(200)).toEqual(['pickle_royalty', 'paddle_legend']);
    expect(ids(500)).toEqual(['pickle_royalty', 'ironwood']);
  });

  it('awards streak badges at 5 and 10', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: 0, currentStreak: n, mvpCount: 0, flight: 'Bronze' }).map(b => b.id);
    expect(ids(4)).toEqual([]);
    expect(ids(5)).toContain('hot_streak_5');
    expect(ids(10)).toContain('unstoppable');
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
    expect(ids).toEqual(['pickle_royalty', 'hot_streak_5', 'unstoppable', 'streak_king', 'crowd_pleaser', 'platinum_flight']);
  });
});
