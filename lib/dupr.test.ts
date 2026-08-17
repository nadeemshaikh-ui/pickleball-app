import { describe, it, expect } from 'vitest';
import { validateDUPREligibility, decomposeMatchForDUPR, buildDUPRMatchPayload } from './dupr';

describe('DUPR Engine Unit Tests & Math Verification', () => {
  it('validates match eligibility correctly when all players have DUPR IDs', () => {
    const playerDUPRMap = new Map<string, string>([
      ['Tarang', 'K9X2P4'],
      ['Aum', 'M8W3Q1'],
      ['Rohan', 'R2Y4L9'],
      ['Nirbhay', 'N5Z6K2']
    ]);

    const result = validateDUPREligibility(['Tarang', 'Aum'], ['Rohan', 'Nirbhay'], playerDUPRMap);
    expect(result.eligible).toBe(true);
    expect(result.unlinkedPlayers).toHaveLength(0);
  });

  it('detects unlinked players and flags match as ineligible for DUPR', () => {
    const playerDUPRMap = new Map<string, string>([
      ['Tarang', 'K9X2P4'],
      ['Aum', 'M8W3Q1']
      // Rohan and Nirbhay are unlinked
    ]);

    const result = validateDUPREligibility(['Tarang', 'Aum'], ['Rohan', 'Nirbhay'], playerDUPRMap);
    expect(result.eligible).toBe(false);
    expect(result.unlinkedPlayers).toEqual(['Rohan', 'Nirbhay']);
  });

  it('decomposes 51-point rapid fire continuous match with strict 17-point ceiling per sub-line', () => {
    const lines = decomposeMatchForDUPR(['Tarang', 'Aum'], ['Rohan', 'Nirbhay'], 51, 30, 'team_championship');
    expect(lines).toHaveLength(3);
    lines.forEach(line => {
      expect(line.teamAScore).toBeLessThanOrEqual(17);
      expect(line.teamBScore).toBeLessThanOrEqual(17);
      expect(line.teamAScore).toBeGreaterThanOrEqual(0);
      expect(line.teamBScore).toBeGreaterThanOrEqual(0);
    });
  });

  it('resolves SINGLES vs DOUBLES format correctly', () => {
    const session: any = { id: 's1', club_id: 'c1', format: 'scramble', is_dupr_rated: true };
    const roundSingles: any = { id: 'r1', session_id: 's1', team_a: ['Tarang'], team_b: ['Rohan'], score_a: 11, score_b: 8 };
    const playerDUPRMap = new Map<string, string>([['Tarang', 'K9X2P4'], ['Rohan', 'R2Y4L9']]);

    const payload = buildDUPRMatchPayload(roundSingles, session, playerDUPRMap);
    expect(payload?.format).toBe('SINGLES');
  });

  it('strips empty DUPR IDs and returns null payload if unlinked', () => {
    const session: any = { id: 's1', club_id: 'c1', format: 'scramble', is_dupr_rated: true };
    const round: any = { id: 'r1', session_id: 's1', team_a: ['Tarang', 'Aum'], team_b: ['Rohan', 'Nirbhay'], score_a: 11, score_b: 8 };
    const playerDUPRMap = new Map<string, string>([
      ['Tarang', 'K9X2P4'],
      ['Aum', '  '], // Empty string ID
      ['Rohan', 'R2Y4L9'],
      ['Nirbhay', 'N5Z6K2']
    ]);

    const payload = buildDUPRMatchPayload(round, session, playerDUPRMap);
    expect(payload).toBeNull();
  });
});
