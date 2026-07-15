import { supabase } from './supabase';

export interface PredictionRow {
  round_id: string;
  predictor_name: string;
  picked_team: 'a' | 'b';
}

// One pick per (round, player) — enforced by a unique constraint, not just
// client-side; the insert throws if the round is already picked, callers
// should already be hiding the UI for a round the player picked, this is
// the safety net.
export async function submitPrediction(roundId: string, clubId: string, predictorName: string, pickedTeam: 'a' | 'b'): Promise<void> {
  const { error } = await supabase
    .from('round_predictions')
    .insert({ round_id: roundId, club_id: clubId, predictor_name: predictorName, picked_team: pickedTeam });
  if (error) throw error;
}

export async function fetchPredictionsForRounds(roundIds: string[]): Promise<Map<string, PredictionRow[]>> {
  const map = new Map<string, PredictionRow[]>();
  if (roundIds.length === 0) return map;
  const { data, error } = await supabase.from('round_predictions').select('round_id, predictor_name, picked_team').in('round_id', roundIds);
  if (error) throw error;
  for (const row of data as PredictionRow[]) {
    const list = map.get(row.round_id) ?? [];
    list.push(row);
    map.set(row.round_id, list);
  }
  return map;
}

// Correct/total for one player across a set of already-scored rounds —
// used on the Results screen to show "your picks tonight: 3/5".
export function computePredictionAccuracy(
  rounds: { id: string; score_a: number | null; score_b: number | null }[],
  predictions: Map<string, PredictionRow[]>,
  playerName: string
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const r of rounds) {
    if (r.score_a === null || r.score_b === null) continue;
    const mine = predictions.get(r.id)?.find(p => p.predictor_name === playerName);
    if (!mine) continue;
    total++;
    const aWon = r.score_a > r.score_b;
    const pickedA = mine.picked_team === 'a';
    if (aWon === pickedA) correct++;
  }
  return { correct, total };
}
