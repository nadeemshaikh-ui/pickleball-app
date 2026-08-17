import { supabase } from './supabase';
import type { SessionRow, RoundRow } from './db';
import type { PlayerRow } from './players';

export interface DUPRMatchPayload {
  clubId?: string;
  matchDate: string;
  format: 'DOUBLES' | 'SINGLES';
  teamA: string[]; // DUPR IDs of Team A players
  teamB: string[]; // DUPR IDs of Team B players
  scores: Array<{ teamAScore: number; teamBScore: number }>;
  isDuprRated: boolean;
}

export interface DUPRPlayerProfile {
  duprId: string;
  fullName: string;
  rating: number;
  verified: boolean;
}

/**
 * Validates if a match is eligible for DUPR submission.
 * Checks that all players in the match have a valid, non-empty linked DUPR ID.
 */
export function validateDUPREligibility(
  teamA: string[],
  teamB: string[],
  playerDUPRMap: Map<string, string>
): { eligible: boolean; unlinkedPlayers: string[] } {
  const allMatchPlayers = [...teamA, ...teamB];
  const unlinkedPlayers = allMatchPlayers.filter(p => {
    const id = playerDUPRMap.get(p);
    return !id || id.trim().length === 0;
  });

  return {
    eligible: unlinkedPlayers.length === 0,
    unlinkedPlayers,
  };
}

/**
 * Decomposes continuous or multi-line rapid fire matches into
 * standard sub-line doubles matches (max 17 pts per game) for DUPR submission.
 */
export function decomposeMatchForDUPR(
  teamA: [string, string] | string[],
  teamB: [string, string] | string[],
  scoreA: number,
  scoreB: number,
  format: string
): Array<{ teamAScore: number; teamBScore: number }> {
  if (format === 'team_championship' && (scoreA > 21 || scoreB > 21)) {
    // Clean proportional 3-line split with 17-point ceiling per sub-line
    const line1A = Math.min(17, Math.round(scoreA / 3));
    const line1B = Math.min(17, Math.round(scoreB / 3));

    const line2A = Math.min(17, Math.round(scoreA / 3));
    const line2B = Math.min(17, Math.round(scoreB / 3));

    const line3A = Math.min(17, Math.max(0, scoreA - line1A - line2A));
    const line3B = Math.min(17, Math.max(0, scoreB - line1B - line2B));

    return [
      { teamAScore: line1A, teamBScore: line1B },
      { teamAScore: line2A, teamBScore: line2B },
      { teamAScore: line3A, teamBScore: line3B },
    ];
  }

  return [{ teamAScore: Math.min(21, scoreA), teamBScore: Math.min(21, scoreB) }];
}

/**
 * Builds the official DUPR payload for a completed round/match.
 */
export function buildDUPRMatchPayload(
  round: RoundRow,
  session: SessionRow,
  playerDUPRMap: Map<string, string>
): DUPRMatchPayload | null {
  if (!session.is_dupr_rated) return null;
  if (round.score_a === null || round.score_b === null) return null;

  const teamADuprIds = round.team_a.map(p => (playerDUPRMap.get(p) || '').trim()).filter(id => id.length > 0);
  const teamBDuprIds = round.team_b.map(p => (playerDUPRMap.get(p) || '').trim()).filter(id => id.length > 0);

  const eligibility = validateDUPREligibility(round.team_a, round.team_b, playerDUPRMap);
  if (!eligibility.eligible) {
    console.warn(`Round #${round.id} skipped for DUPR: missing DUPR IDs for [${eligibility.unlinkedPlayers.join(', ')}]`);
    return null;
  }

  const matchFormat: 'DOUBLES' | 'SINGLES' = (round.team_a as string[]).length === 1 && (round.team_b as string[]).length === 1 ? 'SINGLES' : 'DOUBLES';
  const scores = decomposeMatchForDUPR(round.team_a, round.team_b, round.score_a, round.score_b, session.format);

  return {
    clubId: session.club_id || undefined,
    matchDate: session.event_date || (session.created_at ? new Date(session.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
    format: matchFormat,
    teamA: teamADuprIds,
    teamB: teamBDuprIds,
    scores,
    isDuprRated: true,
  };
}

/**
 * Submits all completed DUPR-eligible rounds in a session to DUPR.
 */
export async function submitSessionMatchesToDUPR(sessionId: string): Promise<{ submittedCount: number; skippedCount: number }> {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if (!session || !session.is_dupr_rated) {
    return { submittedCount: 0, skippedCount: 0 };
  }

  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId);
  if (!rounds || rounds.length === 0) {
    return { submittedCount: 0, skippedCount: 0 };
  }

  const { data: players } = await supabase.from('players').select('*').eq('club_id', session.club_id);
  const playerDUPRMap = new Map<string, string>();
  (players || []).forEach((p: PlayerRow) => {
    if (p.dupr_id && p.dupr_id.trim()) playerDUPRMap.set(p.name, p.dupr_id.trim());
  });

  let submittedCount = 0;
  let skippedCount = 0;

  for (const round of rounds) {
    const payload = buildDUPRMatchPayload(round, session, playerDUPRMap);
    if (payload) {
      try {
        await fetch('/api/dupr/submit-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        submittedCount++;
      } catch (e) {
        console.error('DUPR match submission error:', e);
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  return { submittedCount, skippedCount };
}
