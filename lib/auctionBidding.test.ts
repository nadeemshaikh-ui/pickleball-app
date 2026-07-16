import { describe, it, expect } from 'vitest';
import { computeMaxBid } from './auctionBidding';

describe('computeMaxBid', () => {
  it('matches the server-side place_bid formula: purse - (remainingSlots - 1) * minCategoryPrice', () => {
    // 2 required slots, 0 won yet -> 1 more slot needed after this one
    expect(computeMaxBid(200000, 2, 0, 100000)).toBe(100000);
  });

  it('allows spending the full remaining purse when this is the last required slot', () => {
    // 2 required, 1 already won -> this bid fills the last slot, nothing more to reserve
    expect(computeMaxBid(100000, 2, 1, 100000)).toBe(100000);
  });

  it('never computes fewer than 1 remaining slot even if the roster is already full', () => {
    // already won all required slots -> still treated as 1 remaining slot (this bid), not negative
    expect(computeMaxBid(50000, 2, 2, 100000)).toBe(50000);
  });
});
