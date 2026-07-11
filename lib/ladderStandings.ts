import { supabase } from './supabase';
import { applyLadderMovement, isValidLadderChallenge, sideRung, type LadderPlayer, type LadderRungChange } from './ladder';
import { recordBadgeHolderChange } from './badgeHolders';

export type { LadderRungChange };

export interface LadderStandingRow {
  club_id: string;
  player_name: string;
  rung: number;
  enrolled: boolean;
  wins: number;
  losses: number;
  last_moved_at: string | null;
  created_at: string;
}

export async function fetchLadderStandings(clubId: string): Promise<LadderStandingRow[]> {
  const { data, error } = await supabase
    .from('ladder_standings')
    .select('*')
    .eq('club_id', clubId)
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
export async function enrollInLadder(clubId: string, playerName: string): Promise<void> {
  const { error } = await supabase.rpc('enroll_in_ladder', { target_club_id: clubId, target_name: playerName });
  if (error) throw error;
}

export async function unenrollFromLadder(clubId: string, playerName: string): Promise<void> {
  const { error } = await supabase
    .from('ladder_standings')
    .update({ enrolled: false })
    .eq('club_id', clubId)
    .eq('player_name', playerName);
  if (error) throw error;
}

// Admin-only at the DB level (RLS + a raise inside the function itself) —
// this just surfaces the real error message instead of a generic RPC failure.
export async function resetLadder(clubId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_ladder', { target_club_id: clubId });
  if (error) throw error;
  await syncLadderChampion(clubId);
}

// Crowns whoever currently sits on rung 1 as the "Ladder Champion" badge
// holder — called after anything that can move rung 1 (a challenge upset,
// or an admin reset). No-op if nobody is enrolled yet.
async function syncLadderChampion(clubId: string): Promise<void> {
  const { data, error } = await supabase
    .from('ladder_standings')
    .select('player_name')
    .eq('club_id', clubId)
    .eq('enrolled', true)
    .eq('rung', 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  await recordBadgeHolderChange(clubId, 'ladder_champion', data.player_name);
}

// Called after a doubles score is saved in a session flagged `is_ladder`.
// No-op (returns []) unless all 4 players are currently enrolled on the
// ladder and the two sides' average rungs are within LADDER_CHALLENGE_RANGE
// — exactly the "counts toward rung movement" condition described at Setup.
// A valid challenge always updates each side's ladder win/loss tally; rungs
// only swap if the result was an upset (see applyLadderMovement). Plain
// per-row updates, not an advisory-locked RPC like enroll/reset — scoring
// happens one court at a time from a single scorer, so the concurrent-write
// risk those two guard against doesn't apply here.
export async function resolveLadderChallenge(clubId: string, teamA: string[], teamB: string[], aWon: boolean): Promise<LadderRungChange[]> {
  const names = [...teamA, ...teamB];
  const { data, error } = await supabase
    .from('ladder_standings')
    .select('player_name, rung, wins, losses')
    .eq('club_id', clubId)
    .eq('enrolled', true)
    .in('player_name', names);
  if (error) throw error;

  type Row = { player_name: string; rung: number; wins: number; losses: number };
  const rowByName = new Map((data as Row[]).map(r => [r.player_name, r]));
  if (names.some(n => !rowByName.has(n))) return [];

  const toLadderPlayers = (side: string[]): [LadderPlayer, LadderPlayer] => [
    { name: side[0], rung: rowByName.get(side[0])!.rung },
    { name: side[1], rung: rowByName.get(side[1])!.rung },
  ];
  const sideA = toLadderPlayers(teamA);
  const sideB = toLadderPlayers(teamB);
  if (!isValidLadderChallenge(sideRung([sideA[0].rung, sideA[1].rung]), sideRung([sideB[0].rung, sideB[1].rung]))) return [];

  const winners = aWon ? sideA : sideB;
  const losers = aWon ? sideB : sideA;
  const rungChanges = applyLadderMovement(winners, losers);
  const rungByName = new Map(rungChanges.map(c => [c.name, c.rung]));
  const now = new Date().toISOString();

  await Promise.all(
    names.map(name => {
      const row = rowByName.get(name)!;
      const isWinner = winners.some(w => w.name === name);
      return supabase
        .from('ladder_standings')
        .update({
          rung: rungByName.get(name) ?? row.rung,
          wins: row.wins + (isWinner ? 1 : 0),
          losses: row.losses + (isWinner ? 0 : 1),
          last_moved_at: now,
        })
        .eq('club_id', clubId)
        .eq('player_name', name);
    })
  );

  if (rungChanges.some(c => c.rung === 1)) await syncLadderChampion(clubId);

  return rungChanges;
}
