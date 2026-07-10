import { describe, it, expect } from 'vitest';
import { detectFlightChange } from './flightChange';

describe('detectFlightChange', () => {
  it('detects a promotion crossing a band threshold', () => {
    expect(detectFlightChange(1395, 1405)).toEqual({ direction: 'promoted', flight: 'Silver' });
  });

  it('detects a relegation crossing a band threshold downward', () => {
    expect(detectFlightChange(1405, 1395)).toEqual({ direction: 'relegated', flight: 'Bronze' });
  });

  it('returns null when the flight is unchanged despite a rating move', () => {
    expect(detectFlightChange(1500, 1550)).toBeNull();
  });

  it('detects a multi-band jump as a single promotion to the new flight', () => {
    expect(detectFlightChange(1000, 1850)).toEqual({ direction: 'promoted', flight: 'Platinum' });
  });
});
