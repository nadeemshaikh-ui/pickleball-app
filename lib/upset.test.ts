import { describe, it, expect } from 'vitest';
import { detectUpset } from './upset';

describe('detectUpset', () => {
  it('flags a lower-flight side beating a higher-flight side', () => {
    const result = detectUpset([1200, 1250], [1650, 1700]); // Bronze beats Gold
    expect(result).toEqual({ winnerFlight: 'Bronze', loserFlight: 'Gold' });
  });

  it('returns null when the higher-flight side wins as expected', () => {
    expect(detectUpset([1650, 1700], [1200, 1250])).toBeNull();
  });

  it('returns null when both sides are in the same flight', () => {
    expect(detectUpset([1200, 1250], [1220, 1230])).toBeNull();
  });
});
