'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchStages, type TournamentStageRow, type LeagueGroupResults } from '@/lib/tournamentStages';
import { fetchStageMatches, recordTournamentMatchScore, type TournamentMatchRow } from '@/lib/tournamentMatches';
import { fetchTournamentTeams, type TournamentTeamRow } from '@/lib/tournamentTeams';
import { fetchStageStandings, type StandingsRow } from '@/lib/tournamentStandings';
import { useCurrentClub } from '@/lib/useCurrentClub';
import TournamentStandingsTable from '@/components/TournamentStandingsTable';
import TournamentFixturesList from '@/components/TournamentFixturesList';
import TournamentBracketTree from '@/components/TournamentBracketTree';
import DoubleEliminationBracket from '@/components/DoubleEliminationBracket';

const BRACKET_STAGE_TYPES = ['knockout', 'page_playoff', 'simple_semifinal', 'double_elimination'];

export default function TournamentStagePage() {
  const { tournamentId, stageId } = useParams<{ tournamentId: string; stageId: string }>();
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [stage, setStage] = useState<TournamentStageRow | null>(null);
  const [matches, setMatches] = useState<TournamentMatchRow[]>([]);
  const [teams, setTeams] = useState<TournamentTeamRow[]>([]);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoringMatch, setScoringMatch] = useState<TournamentMatchRow | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const stages = await fetchStages(tournamentId);
    const s = stages.find(x => x.id === stageId) ?? null;
    const [m, t] = await Promise.all([fetchStageMatches(stageId), fetchTournamentTeams(tournamentId)]);
    setStage(s);
    setMatches(m);
    setTeams(t);
    if (s && !BRACKET_STAGE_TYPES.includes(s.stage_type)) {
      // Prefer the frozen results once completed (correct pointsPerWin +
      // the actual advancingTeamIds used to seed the next stage); only
      // live-compute for a stage still in progress.
      const frozen = (s.results as LeagueGroupResults | null)?.standings;
      setStandings(frozen ?? (await fetchStageStandings(stageId, { pointsPerWin: s.config.pointsPerWin })));
    }
  }

  useEffect(() => {
    if (clubLoading || !currentClubId) return;
    setLoading(true);
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load stage.'))
      .finally(() => setLoading(false));
  }, [currentClubId, clubLoading, tournamentId, stageId]);

  function openScoreEntry(match: TournamentMatchRow) {
    setScoringMatch(match);
    setScoreA(match.score_a?.toString() ?? '');
    setScoreB(match.score_b?.toString() ?? '');
  }

  async function handleSaveScore() {
    if (!scoringMatch || scoreA === '' || scoreB === '') return;
    setSaving(true);
    setError(null);
    try {
      await recordTournamentMatchScore(scoringMatch.id, Number(scoreA), Number(scoreB));
      setScoringMatch(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save score.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId || !stage) return <main className="page"><p>Stage not found.</p></main>;

  const isBracket = BRACKET_STAGE_TYPES.includes(stage.stage_type);

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/league/tournaments/${tournamentId}`} className="text-link-btn">← {stage.name}</Link>
      </div>

      <h1>{stage.name}</h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      {!isBracket && standings.length > 0 && (
        <>
          <h2>Standings</h2>
          <div className="card" style={{ marginBottom: 20 }}>
            <TournamentStandingsTable standings={standings} teamNames={new Map(teams.map(t => [t.id, t.name]))} />
          </div>
        </>
      )}

      <h2>{isBracket ? 'Bracket' : 'Fixtures'}</h2>
      {stage.stage_type === 'double_elimination' ? (
        <DoubleEliminationBracket matches={matches} teams={teams} onScoreClick={openScoreEntry} />
      ) : isBracket ? (
        <TournamentBracketTree matches={matches} teams={teams} onScoreClick={openScoreEntry} />
      ) : (
        <TournamentFixturesList matches={matches} teams={teams} onScoreClick={openScoreEntry} />
      )}

      {scoringMatch && (
        <div className="card" style={{ position: 'sticky', bottom: 12, marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Enter score:</span>
          <input type="number" placeholder="Score A" value={scoreA} onChange={e => setScoreA(e.target.value)} style={{ width: 80 }} />
          <span>–</span>
          <input type="number" placeholder="Score B" value={scoreB} onChange={e => setScoreB(e.target.value)} style={{ width: 80 }} />
          <button className="btn-primary" onClick={handleSaveScore} disabled={saving || scoreA === '' || scoreB === ''}>
            Save
          </button>
          <button className="text-link-btn" onClick={() => setScoringMatch(null)}>Cancel</button>
        </div>
      )}
    </main>
  );
}
