import { supabase } from './supabase';
import { computeDuesSplit } from './duesSplit';

export interface DueRow {
  id: string;
  session_id: string;
  player_name: string;
  amount_owed: number;
  paid: boolean;
  paid_at: string | null;
}

export { computeDuesSplit };

export async function createSessionDues(sessionId: string, courtCost: number, ballCost: number, players: string[]): Promise<void> {
  const split = computeDuesSplit(courtCost, ballCost, players);
  if (split.length === 0) return;
  const { error } = await supabase.from('session_dues').insert(
    split.map(s => ({ session_id: sessionId, player_name: s.name, amount_owed: s.amount }))
  );
  if (error) throw error;
}

export async function fetchSessionDues(sessionId: string): Promise<DueRow[]> {
  const { data, error } = await supabase.from('session_dues').select('*').eq('session_id', sessionId).order('player_name');
  if (error) throw error;
  return data as DueRow[];
}

export interface MyDueRow extends DueRow {
  session_created_at: string;
  session_format: string;
  session_booker_upi_vpa: string | null;
}

// Net-balance view: one player's unpaid dues across every session in a club,
// so they don't have to open each session's Results page to find what they
// owe in total.
export async function fetchMyDuesForClub(clubId: string, playerName: string): Promise<MyDueRow[]> {
  const { data, error } = await supabase
    .from('session_dues')
    .select('*, session:sessions!inner(club_id, created_at, format, booker_upi_vpa)')
    .eq('player_name', playerName)
    .eq('paid', false)
    .eq('session.club_id', clubId)
    .order('created_at', { referencedTable: 'sessions', ascending: false });
  if (error) throw error;
  return (data as unknown as (DueRow & { session: { created_at: string; format: string; booker_upi_vpa: string | null } })[]).map(d => ({
    ...d,
    session_created_at: d.session.created_at,
    session_format: d.session.format,
    session_booker_upi_vpa: d.session.booker_upi_vpa,
  }));
}

// Admin-only at the DB level (RLS policy) — this just surfaces a clean error
// if a non-admin somehow reaches this UI path.
export async function markDuePaid(dueId: string, paid: boolean): Promise<void> {
  const { error } = await supabase
    .from('session_dues')
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq('id', dueId);
  if (error) throw error;
}
