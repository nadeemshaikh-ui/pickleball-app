import { supabase } from './supabase';
import { buildBadgeInput, computeBadges, type Badge } from './badges';
import { fetchCurrentBadgeHolders } from './badgeHolders';
import type { ClubRow } from './clubs';

export interface ClubStatsSummary {
  clubId: string;
  clubName: string;
  playerName: string;
  games: number;
  wins: number;
  losses: number;
  badges: Badge[];
  crownsHeld: string[]; // badge ids currently held by this player in this club
  tournamentMatchesPlayed: number;
  tournamentMatchesWon: number;
}

export interface CombinedPlayerStats {
  targetUserId: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  perClub: ClubStatsSummary[];
}

// Fetches an arbitrary user's club memberships, not just the caller's own —
// the privacy boundary is enforced by Postgres, not application code:
// club_members' SELECT RLS policy is is_club_member(club_id), so this
// silently returns only rows for clubs the CALLING (viewing) session also
// belongs to, regardless of whose user_id is being queried. No manual
// set-intersection needed — a viewer literally cannot fetch a row for a
// club they don't share with the target.
async function fetchSharedMemberships(targetUserId: string): Promise<{ clubId: string; club: ClubRow }[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('club_id, club:clubs(id, name, logo_url, logo_url_2, join_code, created_by, created_at, upi_vpa)')
    .eq('user_id', targetUserId);
  if (error) throw error;
  return (data as unknown as { club_id: string; club: ClubRow }[]).map(r => ({ clubId: r.club_id, club: r.club }));
}

// Ratings are deliberately excluded — elo isn't comparable across clubs'
// different pools (agreed during planning; each club's own rank stays
// club-scoped, only games/wins/losses/badges/crowns/tournament record
// combine here).
export async function fetchCombinedPlayerStats(targetUserId: string): Promise<CombinedPlayerStats> {
  const memberships = await fetchSharedMemberships(targetUserId);
  const perClub: ClubStatsSummary[] = [];

  for (const m of memberships) {
    const { data: playerRow, error: playerError } = await supabase
      .from('players')
      .select('name, elo_rating, games_played')
      .eq('club_id', m.clubId)
      .eq('user_id', targetUserId)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!playerRow) continue; // registered as a club member but hasn't set up a player profile in this club yet
    const name = playerRow.name;

    const [{ data: statsRow, error: statsError }, holders, { data: teamRows, error: teamsError }] = await Promise.all([
      supabase.from('league_player_stats').select('games_played, wins, losses').eq('club_id', m.clubId).eq('name', name).maybeSingle(),
      fetchCurrentBadgeHolders(m.clubId),
      supabase.from('tournament_teams').select('id').eq('club_id', m.clubId).contains('player_names', [name]),
    ]);
    if (statsError) throw statsError;
    if (teamsError) throw teamsError;

    const teamIds = (teamRows ?? []).map(t => t.id);
    let tournamentMatchesPlayed = 0;
    let tournamentMatchesWon = 0;
    if (teamIds.length > 0) {
      const { data: matchRows, error: matchesError } = await supabase
        .from('tournament_matches')
        .select('team_a_id, team_b_id, score_a, score_b, status')
        .eq('status', 'completed')
        .or(`team_a_id.in.(${teamIds.join(',')}),team_b_id.in.(${teamIds.join(',')})`);
      if (matchesError) throw matchesError;
      for (const match of matchRows ?? []) {
        if (match.score_a === null || match.score_b === null) continue;
        tournamentMatchesPlayed++;
        const teamWasA = teamIds.includes(match.team_a_id ?? '');
        const won = teamWasA ? match.score_a > match.score_b : match.score_b > match.score_a;
        if (won) tournamentMatchesWon++;
      }
    }

    const games = statsRow?.games_played ?? 0;
    const wins = statsRow?.wins ?? 0;
    const losses = statsRow?.losses ?? 0;

    const badgeInput = await buildBadgeInput(m.clubId, name, playerRow.games_played, playerRow.elo_rating);
    const badges = computeBadges(badgeInput);
    const crownsHeld = [...holders.entries()].filter(([, holder]) => holder.holderName === name).map(([badgeId]) => badgeId);

    perClub.push({
      clubId: m.clubId,
      clubName: m.club.name,
      playerName: name,
      games,
      wins,
      losses,
      badges,
      crownsHeld,
      tournamentMatchesPlayed,
      tournamentMatchesWon,
    });
  }

  return {
    targetUserId,
    totalGames: perClub.reduce((sum, c) => sum + c.games, 0),
    totalWins: perClub.reduce((sum, c) => sum + c.wins, 0),
    totalLosses: perClub.reduce((sum, c) => sum + c.losses, 0),
    perClub,
  };
}
