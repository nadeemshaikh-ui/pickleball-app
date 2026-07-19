'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { fetchRapidFireLog } from '@/lib/rapidFire';
import { computeTeamChampionshipStandings, computeRapidFireState, computeRapidFireBonus } from '@/lib/teamChampionship';
import type { RapidFireLogEntry } from '@/lib/teamChampionship';

// Stage-by-stage points breakdown + Rapid Fire bonus + grand total —
// mirrors the reference tournament's own points table (Stage 1/2/3
// subtotals, Rapid Fire bonus, total out of whatever the configured max
// is), but every number is derived from stage_config/rapid_fire_config,
// not hardcoded to that one tournament's 90+10=100 shape.
export default function TeamChampionshipResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [rapidFireLog, setRapidFireLog] = useState<RapidFireLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const s = await getSession(id);
      setSession(s);
      const [r, rf] = await Promise.all([getRounds(id), s.rapid_fire_config ? fetchRapidFireLog(id) : Promise.resolve([])]);
      setRounds(r);
      setRapidFireLog(rf);
    }
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load results.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Session not found.</p></main>;
  if (session.format !== 'team_championship' || !session.squads || !session.stage_config) {
    return <main className="page"><p>This session isn&apos;t a Team Championship, or is missing its team/stage setup.</p></main>;
  }

  const teams = session.squads;
  const stages = session.stage_config;
  const { totalsByTeam, stageBreakdown } = computeTeamChampionshipStandings(rounds, teams, stages);

  const rapidFireBonus = session.rapid_fire_config
    ? computeRapidFireBonus(computeRapidFireState(rapidFireLog, session.rapid_fire_config, teams), session.rapid_fire_config)
    : null;

  const maxLeaguePoints = stages.reduce((sum, s) => sum + s.pointsPerWin * (s.roundEnd - s.roundStart + 1), 0);
  const grandTotals = new Map(teams.map(t => [t.id, (totalsByTeam.get(t.id) ?? 0) + (rapidFireBonus?.get(t.id) ?? 0)]));
  const leader = [...grandTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const leaderTeam = leader ? teams.find(t => t.id === leader[0]) : null;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
      </div>
      <h1>Results</h1>

      {leaderTeam && (
        <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Leading</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{leaderTeam.label ?? leaderTeam.id}</div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Stage</th>
              {teams.map(t => (
                <th key={t.id} style={{ textAlign: 'right', padding: '8px 6px' }}>{t.label ?? t.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stageBreakdown.map(stage => (
              <tr key={stage.stageLabel} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 6px' }}>{stage.stageLabel}</td>
                {teams.map(t => (
                  <td key={t.id} style={{ textAlign: 'right', padding: '8px 6px' }}>{stage.totalsByTeam.get(t.id) ?? 0}</td>
                ))}
              </tr>
            ))}
            <tr style={{ borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
              <td style={{ padding: '8px 6px' }}>League total (of {maxLeaguePoints})</td>
              {teams.map(t => (
                <td key={t.id} style={{ textAlign: 'right', padding: '8px 6px' }}>{totalsByTeam.get(t.id) ?? 0}</td>
              ))}
            </tr>
            {rapidFireBonus && (
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 6px' }}>Rapid Fire bonus</td>
                {teams.map(t => (
                  <td key={t.id} style={{ textAlign: 'right', padding: '8px 6px' }}>{rapidFireBonus.get(t.id) ?? 0}</td>
                ))}
              </tr>
            )}
            <tr style={{ fontWeight: 900, fontSize: 15 }}>
              <td style={{ padding: '8px 6px' }}>Total</td>
              {teams.map(t => (
                <td key={t.id} style={{ textAlign: 'right', padding: '8px 6px' }}>{grandTotals.get(t.id) ?? 0}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {session.rapid_fire_config && rapidFireLog.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
          Rapid Fire hasn&apos;t started yet — <Link href={`/session/${id}/team-championship/rapid-fire`}>open the live scoreboard</Link>.
        </p>
      )}
    </main>
  );
}
