import { describe, it, expect } from 'vitest';
import { formatScheduleAsText } from './scheduleText';
import type { RoundRow } from './db';

describe('formatScheduleAsText', () => {
  it('formats rounds grouped by round number with both courts and sit-outs', () => {
    const rounds: RoundRow[] = [
      { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: ['I', 'J'], score_a: null, score_b: null },
      { id: '2', session_id: 's', round_number: 1, court: 2, team_a: ['E', 'F'], team_b: ['G', 'H'], sitting_out: ['I', 'J'], score_a: null, score_b: null },
    ];
    const text = formatScheduleAsText(rounds);
    expect(text).toContain('Round 1');
    expect(text).toContain('Court 1: A & B vs C & D');
    expect(text).toContain('Court 2: E & F vs G & H');
    expect(text).toContain('Sitting: I, J');
  });
});
