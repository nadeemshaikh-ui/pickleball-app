import { describe, it, expect, beforeEach } from 'vitest';
import { saveLocalRoundMirror, getLocalRoundMirror, getScoreAuditLog, restoreRoundsFromAuditLog } from './tournamentOfflineSync';

// Simple in-memory mock for localStorage in node test environment
const mockStorage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => mockStorage.get(key) || null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

(global as any).window = {};
(global as any).localStorage = localStorageMock;

describe('Tournament Offline Sync & Audit Recovery Engine', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('saves local round mirror synchronously without loss', () => {
    const record = {
      id: 'pb_r1_c1',
      session_id: 'pb_test_2026',
      round_number: 1,
      court: 1,
      team_a: ['Rao\'s Paltan'],
      team_b: ['Dabang Dinkers'],
      sitting_out: [],
      score_a: 51,
      score_b: 47
    };

    const mirror = saveLocalRoundMirror('pb_test_2026', record);
    expect(mirror.length).toBe(1);
    expect(mirror[0].score_a).toBe(51);
    expect(mirror[0].score_b).toBe(47);

    const fetched = getLocalRoundMirror('pb_test_2026');
    expect(fetched.length).toBe(1);
    expect(fetched[0].team_a[0]).toBe('Rao\'s Paltan');
  });

  it('maintains an append-only audit trail log', () => {
    saveLocalRoundMirror('pb_test_2026', {
      id: 'pb_r1_c1',
      session_id: 'pb_test_2026',
      round_number: 1,
      court: 1,
      team_a: ['Team A'],
      team_b: ['Team B'],
      sitting_out: [],
      score_a: 51,
      score_b: 40
    });

    saveLocalRoundMirror('pb_test_2026', {
      id: 'pb_r1_c1',
      session_id: 'pb_test_2026',
      round_number: 1,
      court: 1,
      team_a: ['Team A'],
      team_b: ['Team B'],
      sitting_out: [],
      score_a: 51,
      score_b: 49
    });

    const logs = getScoreAuditLog('pb_test_2026');
    expect(logs.length).toBe(2);
    expect(logs[0].score_b).toBe(49); // newest first
    expect(logs[1].score_b).toBe(40);
  });

  it('self-heals and restores round state from audit log', () => {
    saveLocalRoundMirror('pb_test_2026', {
      id: 'pb_r1_c1',
      session_id: 'pb_test_2026',
      round_number: 1,
      court: 1,
      team_a: ['Airavat'],
      team_b: ['Leo\'s SIX'],
      sitting_out: [],
      score_a: 51,
      score_b: 45
    });

    // Simulate accidental clearing of round mirror
    localStorageMock.removeItem('pb_tournament_rounds_mirror_pb_test_2026');
    expect(getLocalRoundMirror('pb_test_2026').length).toBe(0);

    // Perform self-healing restore
    const restored = restoreRoundsFromAuditLog('pb_test_2026');
    expect(restored.length).toBe(1);
    expect(restored[0].score_a).toBe(51);
    expect(restored[0].score_b).toBe(45);
  });
});
