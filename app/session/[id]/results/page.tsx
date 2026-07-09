'use client';

import { use, useEffect, useState } from 'react';
import { getSession, getRounds, type SessionRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotals, type PlayerStats } from '@/lib/analytics';
import SessionNav from '@/components/SessionNav';

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [squadTotals, setSquadTotals] = useState<{ gold: number; black: number } | null>(null);

  useEffect(() => {
    async function load() {
      const [s, rounds] = await Promise.all([getSession(id), getRounds(id)]);
      setSession(s);
      setLeaderboard(computeLeaderboard(rounds));
      if (s.format === 'squad_rivalry' && s.squads) {
        setSquadTotals(computeSquadTotals(rounds, s.squads));
      }
    }
    load();
  }, [id]);

  const top3 = leaderboard.slice(0, 3);

  return (
    <>
      <main className="page">
        <h1>Results</h1>

        {squadTotals && (
          <div className="card" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>GOLD</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{squadTotals.gold}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>BLACK</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{squadTotals.black}</div>
            </div>
          </div>
        )}

        <h2>Podium</h2>
        <div className="card">
          {top3.map((p, i) => (
            <div key={p.name} className="leaderboard-row">
              <span className={`rank-badge rank-${i + 1}`}>{i + 1}</span>
              <span className="leaderboard-name">{p.name}</span>
              <span className="leaderboard-stats">{p.wins}W {p.losses}L ({(p.winPct * 100).toFixed(0)}%)</span>
            </div>
          ))}
        </div>

        <h2>Full Leaderboard</h2>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 8 }}>Player</th>
                <th style={{ paddingBottom: 8 }}>W</th>
                <th style={{ paddingBottom: 8 }}>L</th>
                <th style={{ paddingBottom: 8 }}>For</th>
                <th style={{ paddingBottom: 8 }}>Ag</th>
                <th style={{ paddingBottom: 8 }}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(p => (
                <tr key={p.name} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0', fontWeight: 700 }}>{p.name}</td>
                  <td style={{ textAlign: 'center' }}>{p.wins}</td>
                  <td style={{ textAlign: 'center' }}>{p.losses}</td>
                  <td style={{ textAlign: 'center' }}>{p.pointsFor}</td>
                  <td style={{ textAlign: 'center' }}>{p.pointsAgainst}</td>
                  <td style={{ textAlign: 'center' }}>{p.pointsFor - p.pointsAgainst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Wins per Player</h2>
        <div className="card">
          {leaderboard.map(p => (
            <div key={p.name} className="leaderboard-row">
              <span className="leaderboard-name" style={{ flex: '0 0 80px' }}>{p.name}</span>
              <div className="win-bar-track">
                <div className="win-bar-fill" style={{ width: `${(p.wins / Math.max(1, session?.round_count ?? 1)) * 100}%` }} />
              </div>
              <span className="leaderboard-stats">{p.wins}</span>
            </div>
          ))}
        </div>
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
