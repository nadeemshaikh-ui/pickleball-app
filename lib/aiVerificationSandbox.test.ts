import { describe, it, expect } from 'vitest';
import { verifyGeneratedSchedule } from './aiVerificationSandbox';

describe('AI Verification Sandbox', () => {
  it('passes validation for a valid fair schedule', () => {
    const players = ['Nadeem', 'Viki', 'Amresh', 'Sid', 'Sumeet', 'Vinit'];
    const rounds = [
      { round_number: 1, court: 1, team_a: ['Nadeem', 'Viki'], team_b: ['Amresh', 'Sid'], sitting_out: ['Sumeet', 'Vinit'] },
      { round_number: 2, court: 1, team_a: ['Sumeet', 'Vinit'], team_b: ['Nadeem', 'Viki'], sitting_out: ['Amresh', 'Sid'] },
      { round_number: 3, court: 1, team_a: ['Amresh', 'Sid'], team_b: ['Sumeet', 'Vinit'], sitting_out: ['Nadeem', 'Viki'] },
    ];

    const result = verifyGeneratedSchedule(players, rounds);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metrics.maxConsecutiveRests).toBe(1);
    expect(result.metrics.hasEmojis).toBe(false);
  });

  it('detects consecutive rest errors', () => {
    const players = ['Nadeem', 'Viki', 'Amresh', 'Sid', 'Sumeet'];
    const rounds = [
      { round_number: 1, court: 1, team_a: ['Nadeem', 'Viki'], team_b: ['Amresh', 'Sid'], sitting_out: ['Sumeet'] },
      { round_number: 2, court: 1, team_a: ['Nadeem', 'Viki'], team_b: ['Amresh', 'Sid'], sitting_out: ['Sumeet'] },
    ];

    const result = verifyGeneratedSchedule(players, rounds);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Sumeet');
    expect(result.metrics.maxConsecutiveRests).toBe(2);
  });

  it('detects Unicode emojis in player names or schedule', () => {
    const players = ['Nadeem 🏆', 'Viki', 'Amresh', 'Sid'];
    const rounds = [
      { round_number: 1, court: 1, team_a: ['Nadeem 🏆', 'Viki'], team_b: ['Amresh', 'Sid'], sitting_out: [] },
    ];

    const result = verifyGeneratedSchedule(players, rounds);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('forbidden Unicode emojis');
    expect(result.metrics.hasEmojis).toBe(true);
  });
});
