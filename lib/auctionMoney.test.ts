import { describe, it, expect } from 'vitest';
import { formatRupees } from './auctionMoney';

describe('formatRupees', () => {
  it('formats plain rupees below 1 lakh with Indian digit grouping', () => {
    expect(formatRupees(500)).toBe('₹500');
    expect(formatRupees(99999)).toBe('₹99,999');
  });

  it('formats lakhs', () => {
    expect(formatRupees(100000)).toBe('₹1L');
    expect(formatRupees(500000)).toBe('₹5L');
    expect(formatRupees(120000)).toBe('₹1.20L');
  });

  it('formats crores', () => {
    expect(formatRupees(10000000)).toBe('₹1Cr');
    expect(formatRupees(12000000)).toBe('₹1.20Cr');
  });
});
