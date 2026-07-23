'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { computePlayerStats, computeMVP, computeTeamMVPs } from '@/lib/teamChampionship';

type SortKey = 'wins' | 'winPct' | 'pointDiff' | 'matchesPlayed';

// Player-level stats and MVP, split out of the team standings page — real
// feedback: "a separate page for player wise stats n analytics."
export default function TeamChampionshipAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('wins');

  useEffect(() => {
    async function load() {
      const s = await getSession(id);
      setSession(s);
      setRounds(await getRounds(id));
    }
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Session not found.</p></main>;
  if (session.format !== 'team_championship' || !session.squads) {
    return <main className="page"><p>This session isn&apos;t a Team Championship, or is missing its team setup.</p></main>;
  }

  const teams = session.squads;
  const playerStats = computePlayerStats(rounds, teams);
  const overallMVP = computeMVP(playerStats);
  const teamMVPs = computeTeamMVPs(playerStats, teams);

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
        <Link href={`/session/${id}/team-championship/results`} className="text-link-btn">← Standings</Link>
      </div>
      <h1>Player Stats & Analytics</h1>

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

      <h2>Player Leaderboard</h2>
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
    </main>
  );
}
