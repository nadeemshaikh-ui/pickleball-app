'use client';

import { use, useEffect, useState } from 'react';
import { getSession, getRounds, type SessionRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotals, type PlayerStats } from '@/lib/analytics';

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
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Results</h1>

      {squadTotals && (
        <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <strong>Squad Totals</strong>
          <div>Gold: {squadTotals.gold}</div>
          <div>Black: {squadTotals.black}</div>
        </div>
      )}

      <h2>Podium</h2>
      <ol>
        {top3.map(p => (
          <li key={p.name}>{p.name} — {p.wins}W {p.losses}L ({(p.winPct * 100).toFixed(0)}%)</li>
        ))}
      </ol>

      <h2>Full Leaderboard</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Player</th>
            <th>W</th>
            <th>L</th>
            <th>Pts For</th>
            <th>Pts Against</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map(p => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td style={{ textAlign: 'center' }}>{p.wins}</td>
              <td style={{ textAlign: 'center' }}>{p.losses}</td>
              <td style={{ textAlign: 'center' }}>{p.pointsFor}</td>
              <td style={{ textAlign: 'center' }}>{p.pointsAgainst}</td>
              <td style={{ textAlign: 'center' }}>{p.pointsFor - p.pointsAgainst}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Wins per Player</h2>
      {leaderboard.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ width: 80, fontSize: 12 }}>{p.name}</div>
          <div style={{ background: '#1a5f3f', height: 16, width: `${(p.wins / Math.max(1, session?.round_count ?? 1)) * 200}px` }} />
          <div style={{ marginLeft: 8, fontSize: 12 }}>{p.wins}</div>
        </div>
      ))}
    </main>
  );
}
