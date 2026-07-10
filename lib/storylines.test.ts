import { describe, it, expect } from 'vitest';
import { buildStorylines } from './storylines';

describe('buildStorylines', () => {
  it('surfaces the hottest streak in the roster', () => {
    const streaks = new Map([['Alice', 5], ['Bob', 1]]);
    const lines = buildStorylines(['Alice', 'Bob'], streaks, []);
    expect(lines).toContain('🔥 Alice is on a 5-game win streak');
  });

  it('omits the streak line when nobody clears the threshold', () => {
    const streaks = new Map([['Alice', 2], ['Bob', 1]]);
    const lines = buildStorylines(['Alice', 'Bob'], streaks, []);
    expect(lines.some(l => l.includes('win streak'))).toBe(false);
  });

  it('surfaces the closest eligible rivalry', () => {
    const rivalries = [
      { players: ['Alice', 'Bob'] as [string, string], record: [3, 3] as [number, number], gamesTogether: 6 },
      { players: ['Alice', 'Carl'] as [string, string], record: [5, 0] as [number, number], gamesTogether: 5 },
    ];
    const lines = buildStorylines(['Alice', 'Bob', 'Carl'], new Map(), rivalries);
    expect(lines).toContain('⚔️ Closest rivalry tonight: Alice vs Bob — 3-3');
  });

  it('excludes rivalries below the games threshold', () => {
    const rivalries = [{ players: ['Alice', 'Bob'] as [string, string], record: [1, 0] as [number, number], gamesTogether: 1 }];
    const lines = buildStorylines(['Alice', 'Bob'], new Map(), rivalries);
    expect(lines.some(l => l.includes('rivalry'))).toBe(false);
  });

  it('returns an empty array when nothing qualifies', () => {
    expect(buildStorylines(['Alice', 'Bob'], new Map(), [])).toEqual([]);
  });
});
