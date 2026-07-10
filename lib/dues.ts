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

// Admin-only at the DB level (RLS policy) — this just surfaces a clean error
// if a non-admin somehow reaches this UI path.
export async function markDuePaid(dueId: string, paid: boolean): Promise<void> {
  const { error } = await supabase
    .from('session_dues')
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq('id', dueId);
  if (error) throw error;
}
