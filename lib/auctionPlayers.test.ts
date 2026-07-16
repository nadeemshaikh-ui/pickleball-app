import { describe, it, expect } from 'vitest';
import { suggestCategoryForRating } from './auctionPlayers';
import type { AuctionCategoryRow } from './auctionCategories';

function category(overrides: Partial<AuctionCategoryRow>): AuctionCategoryRow {
  return { id: Math.random().toString(36), auction_id: 'a1', club_id: 'c1', name: 'Bronze', base_price: 100000, sort_order: 0, ...overrides };
}

describe('suggestCategoryForRating', () => {
  const categories = [
    category({ id: 'bronze', name: 'Bronze' }),
    category({ id: 'silver', name: 'Silver' }),
    category({ id: 'gold', name: 'Gold' }),
    category({ id: 'platinum', name: 'Platinum' }),
  ];

  it('matches the Flight-derived category by name', () => {
    expect(suggestCategoryForRating(1200, categories)).toBe('bronze');
    expect(suggestCategoryForRating(1500, categories)).toBe('silver');
    expect(suggestCategoryForRating(1700, categories)).toBe('gold');
    expect(suggestCategoryForRating(1900, categories)).toBe('platinum');
  });

  it('returns null when categories were renamed away from the Flight defaults', () => {
    const customCategories = [category({ id: 'x', name: 'Marquee' })];
    expect(suggestCategoryForRating(1900, customCategories)).toBeNull();
  });
});
