'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { fetchPublicTournament, type PublicTournamentData } from '@/lib/tournamentPublic';
import { computeStandings, type StandingsRow } from '@/lib/tournamentStandings';
import type { LeagueGroupResults } from '@/lib/tournamentStages';
import TournamentStandingsTable from '@/components/TournamentStandingsTable';
import TournamentFixturesList from '@/components/TournamentFixturesList';
import TournamentBracketTree from '@/components/TournamentBracketTree';
import type { TournamentMatchRow } from '@/lib/tournamentMatches';
import type { TournamentTeamRow } from '@/lib/tournamentTeams';

const BRACKET_STAGE_TYPES = ['knockout', 'page_playoff', 'simple_semifinal'];

// Read-only spectator page — no auth, no write access. Works signed-out
// because fetchPublicTournament calls a SECURITY DEFINER function granted to
// anon; the raw tournament_* tables themselves have zero anon grants. This
// route needs no layout/route-group work to hide app chrome from an
// anonymous visitor — GlobalNav/AuthGate already no-op when there's no user.
export default function WatchTournamentPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicTournament(shareToken)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load tournament.'))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!data) return <main className="page"><p>Tournament not found.</p></main>;

  const teams: TournamentTeamRow[] = data.teams.map(t => ({
    id: t.id,
    tournament_id: data.tournament.id,
    club_id: '',
    name: t.name,
    player_names: t.playerNames,
    logo_url: t.logoUrl,
    seed: t.seed,
    created_at: '',
  }));

  return (
    <main className="page">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} /> {data.tournament.name}</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize', marginBottom: 16 }}>{data.tournament.status}</p>

      {[...data.stages].sort((a, b) => a.stageOrder - b.stageOrder).map(stage => {
        const stageMatches: TournamentMatchRow[] = data.matches
          .filter(m => m.stageId === stage.id)
          .map(m => ({
            id: m.id,
            stage_id: m.stageId,
            club_id: '',
            round_label: m.roundLabel,
            group_label: m.groupLabel,
            match_order: m.matchOrder,
            bracket_round: m.bracketRound,
            bracket_slot: m.bracketSlot,
            team_a_id: m.teamAId,
            team_b_id: m.teamBId,
            winner_next_match_id: m.winnerNextMatchId,
            winner_next_slot: m.winnerNextSlot,
            loser_next_match_id: m.loserNextMatchId,
            loser_next_slot: m.loserNextSlot,
            is_bye: m.isBye,
            scheduled_at: m.scheduledAt,
            score_a: m.scoreA,
            score_b: m.scoreB,
            status: m.status,
            created_at: '',
          }));

        const isBracket = BRACKET_STAGE_TYPES.includes(stage.stageType);
        // Prefer the frozen results (correct pointsPerWin + the actual
        // advancingTeamIds used to seed the next stage) once a stage is
        // completed; only live-compute for a stage still in progress, where
        // no frozen snapshot exists yet.
        const frozenStandings = (stage.results as LeagueGroupResults | null)?.standings;
        const standings: StandingsRow[] = !isBracket
          ? (frozenStandings ?? computeStandings(stageMatches, teams, { pointsPerWin: stage.config.pointsPerWin }))
          : [];

        return (
          <section key={stage.id} style={{ marginBottom: 28 }}>
            <h2>{stage.name}</h2>
            {!isBracket && standings.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <TournamentStandingsTable standings={standings} teamNames={new Map(teams.map(t => [t.id, t.name]))} />
              </div>
            )}
            {isBracket ? (
              <TournamentBracketTree matches={stageMatches} teams={teams} />
            ) : (
              <TournamentFixturesList matches={stageMatches} teams={teams} />
            )}
          </section>
        );
      })}
    </main>
  );
}
