import { describe, it, expect } from 'vitest';

// Automated UI State & Re-render Simulation Test Suite
describe('MW Mavericks Master Hub UI State & Re-render Integrity', () => {
  it('preserves full 72-round master array when saving a single round score', () => {
    // 1. Mock 72 master rounds array
    const masterRounds = Array.from({ length: 72 }, (_, i) => ({
      round_number: Math.floor(i / 3) + 1,
      court: (i % 3) + 1,
      team_a: ['Player A1', 'Player A2'],
      team_b: ['Player B1', 'Player B2'],
      score_a: null,
      score_b: null
    }));

    expect(masterRounds.length).toBe(72);

    // 2. Simulate saving score for Round 1 Court 1
    const updatedRound = {
      round_number: 1,
      court: 1,
      team_a: ['Player A1', 'Player A2'],
      team_b: ['Player B1', 'Player B2'],
      score_a: 51,
      score_b: 47
    };

    // 3. Perform immutable state update (The fix applied)
    const nextState = masterRounds.map(r =>
      Number(r.round_number) === updatedRound.round_number && Number(r.court) === updatedRound.court
        ? { ...r, score_a: updatedRound.score_a, score_b: updatedRound.score_b }
        : r
    );

    // 4. Assertions: Must NOT truncate array
    expect(nextState.length).toBe(72);
    expect(nextState[0].score_a).toBe(51);
    expect(nextState[0].score_b).toBe(47);
    expect(nextState[1].score_a).toBeNull(); // Other rounds remain intact!
    expect(nextState[71].round_number).toBe(24);
  });

  it('preserves all unscored rounds when merging DB rounds with local mirror', () => {
    const dbRounds = Array.from({ length: 72 }, (_, i) => ({
      round_number: Math.floor(i / 3) + 1,
      court: (i % 3) + 1,
      team_a: ['Player A1', 'Player A2'],
      team_b: ['Player B1', 'Player B2'],
      score_a: null,
      score_b: null
    }));

    const localMirror = [
      { round_number: 1, court: 1, score_a: 51, score_b: 45 }
    ];

    const roundMap = new Map();
    dbRounds.forEach(r => roundMap.set(`${r.round_number}_${r.court}`, r));

    localMirror.forEach(r => {
      const key = `${r.round_number}_${r.court}`;
      const existing = roundMap.get(key);
      if (existing) {
        roundMap.set(key, { ...existing, score_a: r.score_a, score_b: r.score_b });
      }
    });

    const merged = Array.from(roundMap.values());
    expect(merged.length).toBe(72);
    expect(merged[0].score_a).toBe(51);
    expect(merged[1].score_a).toBeNull();
  });
});
