import { describe, it, expect } from 'vitest';
import { formatAnalyticsAsText } from './analyticsText';
import type { RoundRow } from './db';

describe('formatAnalyticsAsText', () => {
  it('includes total points and highlight sections', () => {
    const rounds: RoundRow[] = [
      { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: [], score_a: 15, score_b: 14 },
      { id: '2', session_id: 's', round_number: 1, court: 2, team_a: ['E', 'F'], team_b: ['G', 'H'], sitting_out: [], score_a: 15, score_b: 2 },
    ];
    const text = formatAnalyticsAsText(rounds);
    expect(text).toContain('Total points scored');
    expect(text).toContain('Closest game');
    expect(text).toContain('Biggest blowout');
  });
});
