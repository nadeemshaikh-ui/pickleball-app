import { supabase } from './supabase';

export interface Confirmation {
  playerName: string;
  userId: string;
  confirmedAt: string;
}

export async function fetchConfirmations(sessionId: string): Promise<Confirmation[]> {
  const { data, error } = await supabase.from('session_confirmations').select('*').eq('session_id', sessionId);
  if (error) throw error;
  return data.map((r: { player_name: string; user_id: string; confirmed_at: string }) => ({
    playerName: r.player_name,
    userId: r.user_id,
    confirmedAt: r.confirmed_at,
  }));
}

export async function confirmParticipation(sessionId: string, clubId: string, playerName: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('session_confirmations')
    .upsert({ session_id: sessionId, club_id: clubId, player_name: playerName, user_id: userId }, { onConflict: 'session_id,player_name' });
  if (error) throw error;
}

// Admin-only, enforced by RLS ("admins can void sessions" policy). Nulls
// every round's scores rather than deleting them — every league_* view
// already filters WHERE score_a IS NOT NULL, so this removes a voided
// session from every leaderboard/badge/streak computation without touching
// any view definition. Round history stays visible, just unscored.
export async function voidSession(sessionId: string): Promise<void> {
  const { error: roundsError } = await supabase
    .from('rounds')
    .update({ score_a: null, score_b: null })
    .eq('session_id', sessionId);
  if (roundsError) throw roundsError;

  const { error: sessionError } = await supabase.from('sessions').update({ status: 'voided' }).eq('id', sessionId);
  if (sessionError) throw sessionError;
}
