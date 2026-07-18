import { supabase } from './supabase';
import type { RapidFireLogEntry } from './teamChampionship';

export interface RapidFireLogRow {
  id: string;
  session_id: string;
  event_order: number;
  scoring_team_id: string;
  on_court_players: string[];
  created_at: string;
}

export async function fetchRapidFireLog(sessionId: string): Promise<RapidFireLogEntry[]> {
  const { data, error } = await supabase
    .from('rapid_fire_log')
    .select('*')
    .eq('session_id', sessionId)
    .order('event_order', { ascending: true });
  if (error) throw error;
  return (data as RapidFireLogRow[]).map(r => ({
    eventOrder: r.event_order,
    scoringTeamId: r.scoring_team_id,
    onCourtPlayers: r.on_court_players,
  }));
}

// Single-scorer-device assumption (same as every other live-scoring screen
// in this app) means a same-instant double-tap race is unlikely, but not
// impossible — event_order is derived from the current log length, so two
// concurrent inserts could both compute the same next order and collide on
// the (session_id, event_order) unique constraint. One retry with a fresh
// count covers that without adding real locking machinery for a scenario
// this app already accepts elsewhere.
export async function recordRapidFirePoint(sessionId: string, scoringTeamId: string, onCourtPlayers: string[]): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { count, error: countError } = await supabase
      .from('rapid_fire_log')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    if (countError) throw countError;

    const { error: insertError } = await supabase.from('rapid_fire_log').insert({
      session_id: sessionId,
      event_order: (count ?? 0) + 1,
      scoring_team_id: scoringTeamId,
      on_court_players: onCourtPlayers,
    });
    if (!insertError) return;
    if (insertError.code !== '23505' || attempt === 1) throw insertError; // 23505 = unique_violation
  }
}
