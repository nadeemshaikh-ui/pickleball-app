import { supabase } from './supabase';

export interface LadderStandingRow {
  player_name: string;
  rung: number;
  enrolled: boolean;
  wins: number;
  losses: number;
  last_moved_at: string | null;
  created_at: string;
}

export async function fetchLadderStandings(): Promise<LadderStandingRow[]> {
  const { data, error } = await supabase
    .from('ladder_standings')
    .select('*')
    .eq('enrolled', true)
    .order('rung', { ascending: true });
  if (error) throw error;
  return data as LadderStandingRow[];
}

// Puts a newcomer on the bottom rung. Re-enrolling someone who left keeps
// their old rung rather than sending them back to the bottom — only a full
// admin reset renumbers everyone. Runs as a single atomic RPC (advisory-lock
// serialized server-side) rather than a client-side read-then-insert, so two
// concurrent enrolls can't compute the same "next rung".
export async function enrollInLadder(playerName: string): Promise<void> {
  const { error } = await supabase.rpc('enroll_in_ladder', { target_name: playerName });
  if (error) throw error;
}

export async function unenrollFromLadder(playerName: string): Promise<void> {
  const { error } = await supabase.from('ladder_standings').update({ enrolled: false }).eq('player_name', playerName);
  if (error) throw error;
}

// Admin-only at the DB level (RLS + a raise inside the function itself) —
// this just surfaces the real error message instead of a generic RPC failure.
export async function resetLadder(): Promise<void> {
  const { error } = await supabase.rpc('reset_ladder');
  if (error) throw error;
}
