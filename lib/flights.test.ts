import { describe, it, expect } from 'vitest';
import { flightForRating } from './flights';

describe('flightForRating', () => {
  it('assigns Bronze below 1400', () => {
    expect(flightForRating(1000)).toBe('Bronze');
    expect(flightForRating(1399)).toBe('Bronze');
  });

  it('assigns Silver from 1400', () => {
    expect(flightForRating(1400)).toBe('Silver');
    expect(flightForRating(1599)).toBe('Silver');
  });

  it('assigns Gold from 1600', () => {
    expect(flightForRating(1600)).toBe('Gold');
    expect(flightForRating(1799)).toBe('Gold');
  });

  it('assigns Platinum from 1800', () => {
    expect(flightForRating(1800)).toBe('Platinum');
    expect(flightForRating(2400)).toBe('Platinum');
  });
});
