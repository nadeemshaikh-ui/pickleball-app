import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRapidFireLog, recordRapidFirePoint } from './rapidFire';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('rapidFire database engine unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchRapidFireLog', () => {
    it('fetches and maps rapid fire log entries successfully', async () => {
      const mockData = [
        { event_order: 1, scoring_team_id: 'team1', on_court_players: ['p1', 'p2'] }
      ];
      
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const orderMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
      
      (supabase.from as any).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        order: orderMock
      });

      const result = await fetchRapidFireLog('session-abc');

      expect(supabase.from).toHaveBeenCalledWith('rapid_fire_log');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('session_id', 'session-abc');
      expect(orderMock).toHaveBeenCalledWith('event_order', { ascending: true });
      expect(result).toEqual([
        { eventOrder: 1, scoringTeamId: 'team1', onCourtPlayers: ['p1', 'p2'] }
      ]);
    });

    it('throws error if the database query fails', async () => {
      const mockError = new Error('DB Connection Error');
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError })
      });

      await expect(fetchRapidFireLog('session-abc')).rejects.toThrow('DB Connection Error');
    });
  });

  describe('recordRapidFirePoint', () => {
    it('inserts a rapid fire point cleanly on the first attempt', async () => {
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ count: 5, error: null });
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'rapid_fire_log') return { select: selectMock, eq: eqMock, insert: insertMock };
      });

      await recordRapidFirePoint('session-xyz', 'team2', ['Alice', 'Bob']);

      expect(insertMock).toHaveBeenCalledWith({
        session_id: 'session-xyz',
        event_order: 6,
        scoring_team_id: 'team2',
        on_court_players: ['Alice', 'Bob']
      });
    });

    it('retries gracefully on unique_violation (23505) race conditions', async () => {
      let attempt = 0;
      
      const eqMockCount = vi.fn().mockImplementation(() => {
        attempt++;
        return Promise.resolve({ count: attempt === 1 ? 5 : 6, error: null });
      });

      const insertMock = vi.fn().mockImplementation(() => {
        return Promise.resolve({ error: attempt === 1 ? { code: '23505' } : null });
      });

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMockCount,
        insert: insertMock
      });

      await recordRapidFirePoint('session-xyz', 'team2', ['Alice', 'Bob']);
      
      expect(insertMock).toHaveBeenCalledTimes(2);
      expect(insertMock).toHaveBeenLastCalledWith({
        session_id: 'session-xyz',
        event_order: 7,
        scoring_team_id: 'team2',
        on_court_players: ['Alice', 'Bob']
      });
    });
  });
});
