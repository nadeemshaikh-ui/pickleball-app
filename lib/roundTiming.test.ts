import { describe, it, expect } from 'vitest';
import { computeRoundTimeRange } from './roundTiming';

describe('computeRoundTimeRange', () => {
  it('computes the clock range for round 1 starting at the session start time', () => {
    expect(computeRoundTimeRange('20:00', 10, 1)).toBe('8:00 PM–8:10 PM');
  });

  it('offsets later rounds by roundNumber-1 * duration', () => {
    expect(computeRoundTimeRange('20:00', 10, 3)).toBe('8:20 PM–8:30 PM');
  });

  it('rolls over past midnight correctly', () => {
    expect(computeRoundTimeRange('23:50', 10, 2)).toBe('12:00 AM–12:10 AM');
  });

  it('returns null when start time is missing', () => {
    expect(computeRoundTimeRange(null, 10, 1)).toBeNull();
  });

  it('returns null when duration is missing', () => {
    expect(computeRoundTimeRange('20:00', null, 1)).toBeNull();
  });
});
