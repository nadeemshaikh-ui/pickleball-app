'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Star } from 'lucide-react';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { fetchRapidFireLog } from '@/lib/rapidFire';
import {
  computeTeamChampionshipStandings,
  computeRapidFireState,
  computeRapidFireBonus,
  computeTeamMatchRecords,
  computeRoundResults,
  computePlayerStats,
  computeMVP,
  computeTeamMVPs,
} from '@/lib/teamChampionship';
import type { RapidFireLogEntry } from '@/lib/teamChampionship';

type SortKey = 'wins' | 'winPct' | 'pointDiff' | 'matchesPlayed';

// Real tournament leaderboard, not just a points table: match record
// (wins-losses, not just weighted points — a team can lead on points
// while having played fewer matches), a round-by-round breakdown of who
// won which match and how many points it was worth, and player-level
// analytics (MVP overall + per team, full stats table) — the points-only
// version of this page told an organizer THAT a team was ahead but
// nothing about HOW, which round, or which players actually did it.
export default function TeamChampionshipResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [rapidFireLog, setRapidFireLog] = useState<RapidFireLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('wins');
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

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
  const playerStats = computePlayerStats(rounds, teams);
  const overallMVP = computeMVP(playerStats);
  const teamMVPs = computeTeamMVPs(playerStats, teams);

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

  const sortedPlayerStats = [...playerStats]
    .filter(s => s.matchesPlayed > 0)
    .sort((a, b) => {
      if (sortKey === 'wins') return b.wins - a.wins || b.winPct - a.winPct;
      if (sortKey === 'winPct') return b.winPct - a.winPct || b.wins - a.wins;
      if (sortKey === 'pointDiff') return b.pointDiff - a.pointDiff;
      return b.matchesPlayed - a.matchesPlayed;
    });

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
      </div>
      <h1>Results</h1>

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

      {overallMVP && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
          <Star size={28} color="#d4af37" fill="#d4af37" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Tournament MVP</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{overallMVP.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {overallMVP.wins}W – {overallMVP.losses}L · {(overallMVP.winPct * 100).toFixed(0)}% win rate · {overallMVP.pointDiff >= 0 ? '+' : ''}{overallMVP.pointDiff} point diff
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: teams.length === 2 ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 16 }}>
        {teams.map(t => {
          const mvp = teamMVPs.get(t.id);
          if (!mvp) return null;
          return (
            <div key={t.id} className="card" style={{ padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{t.label ?? t.id} MVP</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{mvp.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{mvp.wins}W – {mvp.losses}L</div>
            </div>
          );
        })}
      </div>

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
              const isExpanded = expandedStage === stage.stageLabel;
              return (
                <tr key={stage.stageLabel} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setExpandedStage(isExpanded ? null : stage.stageLabel)}>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{stage.stageLabel}</span> {isExpanded ? '▲' : '▼'}
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

      {expandedStage && (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>{expandedStage} — match by match</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {roundResults
              .filter(r => r.stageLabel === expandedStage)
              .map(r => {
                const winnerTeam = r.winnerTeamId ? teams.find(t => t.id === r.winnerTeamId) : null;
                return (
                  <div key={`${r.roundNumber}-${r.court}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)', flexShrink: 0, width: 90 }}>R{r.roundNumber} · Court {r.court}</span>
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
      )}

      <h2 style={{ marginTop: 24 }}>Player Leaderboard</h2>
      <div className="card" style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([
          ['wins', 'Wins'],
          ['winPct', 'Win %'],
          ['pointDiff', 'Point Diff'],
          ['matchesPlayed', 'Matches'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={sortKey === key ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => setSortKey(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Player</th>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Team</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>MP</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>W</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>L</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>Win%</th>
              <th style={{ textAlign: 'right', padding: '8px 6px' }}>+/-</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayerStats.map(s => {
              const team = teams.find(t => t.id === s.teamId);
              return (
                <tr key={s.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 6px', fontWeight: overallMVP?.name === s.name ? 800 : 400 }}>
                    {overallMVP?.name === s.name && '★ '}{s.name}
                  </td>
                  <td style={{ padding: '8px 6px', fontSize: 11, color: 'var(--muted)' }}>{team?.label ?? s.teamId}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px' }}>{s.matchesPlayed}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px' }}>{s.wins}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px' }}>{s.losses}</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px' }}>{(s.winPct * 100).toFixed(0)}%</td>
                  <td style={{ textAlign: 'right', padding: '8px 6px', color: s.pointDiff > 0 ? 'var(--success, #16a34a)' : s.pointDiff < 0 ? 'var(--danger)' : undefined }}>
                    {s.pointDiff >= 0 ? '+' : ''}{s.pointDiff}
                  </td>
                </tr>
              );
            })}
            {sortedPlayerStats.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>No matches scored yet.</td>
              </tr>
            )}
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
