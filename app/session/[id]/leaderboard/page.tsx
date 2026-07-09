'use client';

import { use, useEffect, useState } from 'react';
import { getSession, getRounds, type SessionRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotals, type PlayerStats } from '@/lib/analytics';
import SessionNav from '@/components/SessionNav';

const POLL_INTERVAL_MS = 4000;

export default function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [squadTotals, setSquadTotals] = useState<{ gold: number; black: number } | null>(null);
  const [gamesCompleted, setGamesCompleted] = useState(0);
  const [gamesTotal, setGamesTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [s, rounds] = await Promise.all([getSession(id), getRounds(id)]);
      if (cancelled) return;
      setSession(s);
      setLeaderboard(computeLeaderboard(rounds));
      setGamesTotal(rounds.length);
      setGamesCompleted(rounds.filter(r => r.score_a !== null).length);
      if (s.format === 'squad_rivalry' && s.squads) {
        setSquadTotals(computeSquadTotals(rounds, s.squads));
      }
    }

    load();
    // Live-updating leaderboard: simple polling rather than a Supabase
    // realtime subscription — this is a basic, low-traffic hobby app, so
    // polling every few seconds is far cheaper to build and run than wiring
    // up realtime channels for a handful of concurrent viewers.
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  return (
    <>
      <main className="page">
        <h1>Leaderboard</h1>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          {gamesCompleted} of {gamesTotal} games played — updates live
        </p>

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

        <h2>Standings</h2>
        <div className="card">
          {leaderboard.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No games scored yet.</p>
          )}
          {leaderboard.map((p, i) => {
            const maxWins = Math.max(1, ...leaderboard.map(x => x.wins));
            return (
              <div key={p.name} className="leaderboard-row">
                <span className={`rank-badge rank-${i + 1 <= 3 ? i + 1 : ''}`}>{i + 1}</span>
                <span className="leaderboard-name">{p.name}</span>
                <div className="win-bar-track" style={{ maxWidth: 80 }}>
                  <div className="win-bar-fill" style={{ width: `${(p.wins / maxWins) * 100}%` }} />
                </div>
                <span className="leaderboard-stats">
                  {p.wins}W-{p.losses}L · {p.pointsFor}-{p.pointsAgainst}
                </span>
              </div>
            );
          })}
        </div>
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
