import { describe, it, expect } from 'vitest';
import { computeBadges } from './badges';

describe('computeBadges', () => {
  it('awards nothing for a fresh player', () => {
    expect(computeBadges({ gamesPlayed: 5, currentStreak: 1, mvpCount: 0, flight: 'Bronze' })).toEqual([]);
  });

  it('awards Iron Man at 50 games, Century Club at 100', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: n, currentStreak: 0, mvpCount: 0, flight: 'Bronze' }).map(b => b.id);
    expect(ids(49)).not.toContain('iron_man');
    expect(ids(50)).toContain('iron_man');
    expect(ids(99)).not.toContain('century_club');
    expect(ids(100)).toContain('century_club');
  });

  it('awards streak badges at 5 and 10', () => {
    const ids = (n: number) => computeBadges({ gamesPlayed: 0, currentStreak: n, mvpCount: 0, flight: 'Bronze' }).map(b => b.id);
    expect(ids(4)).toEqual([]);
    expect(ids(5)).toContain('hot_streak_5');
    expect(ids(10)).toContain('unstoppable');
  });

  it('awards flight badges only for Gold/Platinum, not lower flights', () => {
    const idsFor = (flight: string) => computeBadges({ gamesPlayed: 0, currentStreak: 0, mvpCount: 0, flight }).map(b => b.id);
    expect(idsFor('Bronze')).toEqual([]);
    expect(idsFor('Silver')).toEqual([]);
    expect(idsFor('Gold')).toEqual(['gold_flight']);
    expect(idsFor('Platinum')).toEqual(['platinum_flight']);
  });

  it('stacks multiple badges at once', () => {
    const badges = computeBadges({ gamesPlayed: 100, currentStreak: 10, mvpCount: 3, flight: 'Platinum' });
    const ids = badges.map(b => b.id);
    expect(ids).toEqual(['iron_man', 'century_club', 'hot_streak_5', 'unstoppable', 'fan_favorite', 'platinum_flight']);
  });
});
