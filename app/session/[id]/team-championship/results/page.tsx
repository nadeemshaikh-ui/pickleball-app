'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { fetchRapidFireLog } from '@/lib/rapidFire';
import {
  computeTeamChampionshipStandings,
  computeRapidFireState,
  computeRapidFireBonus,
  computeTeamMatchRecords,
  computeRoundResults,
} from '@/lib/teamChampionship';
import type { RapidFireLogEntry } from '@/lib/teamChampionship';

// Team standings + round-wise breakdown live here; player-level stats and
// MVP moved to their own page (team-championship/analytics) — real
// feedback: "standings should be where team points n standings are shown,
// round wise points n standings are shown and a separate page for player
// wise stats n analytics."
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
  const matchRecords = computeTeamMatchRecords(rounds, teams, stages);
  const roundResults = computeRoundResults(rounds, teams, stages);

  const rapidFireBonus = session.rapid_fire_config
    ? computeRapidFireBonus(computeRapidFireState(rapidFireLog, session.rapid_fire_config, teams), session.rapid_fire_config)
    : null;

  const maxLeaguePoints = stages.reduce((sum, s) => sum + s.pointsPerWin * (s.roundEnd - s.roundStart + 1), 0);
  const courtCount = session.court_labels.length || 1;
  const unscoredByStage = stages.map(stage => {
    const expectedSlots = courtCount * (stage.roundEnd - stage.roundStart + 1);
    const scoredSlots = rounds.filter(
      r => r.round_number >= stage.roundStart && r.round_number <= stage.roundEnd && r.score_a !== null && r.score_b !== null
    ).length;
    return { stageLabel: stage.stageLabel, scoredSlots, expectedSlots };
  });
  const grandTotals = new Map(teams.map(t => [t.id, (totalsByTeam.get(t.id) ?? 0) + (rapidFireBonus?.get(t.id) ?? 0)]));
  const leaderEntry = [...grandTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const leaderTeam = leaderEntry ? teams.find(t => t.id === leaderEntry[0]) : null;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
      </div>
      <h1>Standings</h1>

      {leaderTeam && (
        <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            <Trophy size={14} /> Leading
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{leaderTeam.label ?? leaderTeam.id}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10, fontSize: 13 }}>
            {teams.map(t => {
              const record = matchRecords.get(t.id) ?? { wins: 0, losses: 0 };
              const isLeading = t.id === leaderTeam.id;
              return (
                <div key={t.id} style={{ opacity: isLeading ? 1 : 0.6 }}>
                  <div style={{ fontWeight: 700 }}>{t.label ?? t.id}</div>
                  <div style={{ color: 'var(--muted)' }}>{record.wins}W – {record.losses}L</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{grandTotals.get(t.id) ?? 0} pts</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Link
        href={`/session/${id}/team-championship/analytics`}
        className="btn-secondary"
        style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}
      >
        Player Stats & MVP →
      </Link>

      <h2>Stage Points</h2>
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
            {stageBreakdown.map(stage => {
              const unscored = unscoredByStage.find(u => u.stageLabel === stage.stageLabel);
              const isIncomplete = unscored && unscored.scoredSlots < unscored.expectedSlots;
              return (
                <tr key={stage.stageLabel} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 6px' }}>
                    {stage.stageLabel}
                    {isIncomplete && (
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--warning, #b45309)', fontWeight: 700 }}>
                        {unscored.scoredSlots}/{unscored.expectedSlots} matches scored
                      </span>
                    )}
                  </td>
                  {teams.map(t => (
                    <td key={t.id} style={{ textAlign: 'right', padding: '8px 6px' }}>{stage.totalsByTeam.get(t.id) ?? 0}</td>
                  ))}
                </tr>
              );
            })}
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

      <h2 style={{ marginTop: 24 }}>Round by Round</h2>
      {stages.map(stage => {
        const stageRoundResults = roundResults.filter(r => r.stageLabel === stage.stageLabel);
        if (stageRoundResults.length === 0) return null;
        return (
          <div key={stage.stageLabel} className="card" style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>
              {stage.stageLabel} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({stage.pointsPerWin} pt/win)</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stageRoundResults.map(r => {
                const winnerTeam = r.winnerTeamId ? teams.find(t => t.id === r.winnerTeamId) : null;
                return (
                  <div key={`${r.roundNumber}-${r.court}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <Link href={`/session/${id}/team-championship/round/${r.roundNumber}`} style={{ color: 'var(--muted)', flexShrink: 0, width: 90 }}>
                      R{r.roundNumber} · Court {r.court}
                    </Link>
                    <span style={{ flex: 1, textAlign: 'center' }}>
                      {r.teamA.join(' & ')} <strong>{r.scoreA ?? '–'}</strong> vs <strong>{r.scoreB ?? '–'}</strong> {r.teamB.join(' & ')}
                    </span>
                    <span style={{ flexShrink: 0, width: 90, textAlign: 'right', fontWeight: 700 }}>
                      {winnerTeam ? `${winnerTeam.label ?? winnerTeam.id} +${r.pointsPerWin}` : 'Unscored'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {roundResults.length === 0 && <p style={{ color: 'var(--muted)' }}>No rounds set up yet.</p>}

      {session.rapid_fire_config && rapidFireLog.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
          Rapid Fire hasn&apos;t started yet — <Link href={`/session/${id}/team-championship/rapid-fire`}>open the live scoreboard</Link>.
        </p>
      )}
    </main>
  );
}
