import { supabase } from './supabase';

export interface Challenge {
  id: string;
  challengerName: string;
  opponentName: string;
  status: 'pending' | 'completed';
  result: 'challenger_won' | 'opponent_won' | null;
  createdAt: string;
}

// Called from the score-save flow with the two teams that just played and
// who won. Resolves the oldest pending challenge between any challenger/
// opponent pair found facing off across the two teams.
export async function resolveChallengesForRound(clubId: string, teamA: string[], teamB: string[], teamAWon: boolean): Promise<void> {
  const { data, error } = await supabase.from('league_challenges').select('*').eq('club_id', clubId).eq('status', 'pending');
  if (error) throw error;
  const pending = (data ?? []).map(mapChallenge);

  for (const c of pending) {
    const challengerInA = teamA.includes(c.challengerName);
    const challengerInB = teamB.includes(c.challengerName);
    const opponentInA = teamA.includes(c.opponentName);
    const opponentInB = teamB.includes(c.opponentName);
    const facingOff = (challengerInA && opponentInB) || (challengerInB && opponentInA);
    if (!facingOff) continue;
    const challengerWon = (challengerInA && teamAWon) || (challengerInB && !teamAWon);
    await resolveChallenge(c.id, challengerWon ? 'challenger_won' : 'opponent_won');
  }
}

export async function fetchPendingChallenges(clubId: string, playerName: string): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('league_challenges')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .or(`challenger_name.eq.${playerName},opponent_name.eq.${playerName}`);
  if (error) throw error;
  return data.map(mapChallenge);
}

export async function createChallenge(clubId: string, challengerName: string, opponentName: string): Promise<void> {
  const { error } = await supabase
    .from('league_challenges')
    .insert({ club_id: clubId, challenger_name: challengerName, opponent_name: opponentName });
  if (error) throw error;
}

// Called when challenger and opponent are found on opposite teams in a
// newly-recorded round. Resolves the oldest pending challenge between them.
async function resolveChallenge(challengeId: string, result: 'challenger_won' | 'opponent_won'): Promise<void> {
  const { error } = await supabase
    .from('league_challenges')
    .update({ status: 'completed', result, resolved_at: new Date().toISOString() })
    .eq('id', challengeId);
  if (error) throw error;
}

function mapChallenge(r: {
  id: string;
  challenger_name: string;
  opponent_name: string;
  status: 'pending' | 'completed';
  result: 'challenger_won' | 'opponent_won' | null;
  created_at: string;
}): Challenge {
  return {
    id: r.id,
    challengerName: r.challenger_name,
    opponentName: r.opponent_name,
    status: r.status,
    result: r.result,
    createdAt: r.created_at,
  };
}
