'use client';

import { use, useEffect, useState } from 'react';
import { getSession, getRounds, type SessionRow, type RoundRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotals, type PlayerStats } from '@/lib/analytics';
import { formatRecapAsText } from '@/lib/recapText';
import { shareToWhatsApp } from '@/lib/whatsapp';
import Link from 'next/link';
import SessionNav from '@/components/SessionNav';
import Avatar from '@/components/Avatar';
import Celebration from '@/components/Celebration';
import NewSessionLink from '@/components/NewSessionLink';
import SessionDate from '@/components/SessionDate';

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [squadTotals, setSquadTotals] = useState<{ gold: number; black: number } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
      setSession(s);
      setRounds(r);
      const board = computeLeaderboard(r);
      setLeaderboard(board);
      if (s.format === 'squad_rivalry' && s.squads) {
        setSquadTotals(computeSquadTotals(r, s.squads));
      }
      const celebratedKey = `celebrated-${id}`;
      if (s.status === 'completed' && board.length > 0 && !sessionStorage.getItem(celebratedKey)) {
        setShowCelebration(true);
        sessionStorage.setItem(celebratedKey, '1');
      }
    }
    load();
  }, [id]);

  const top3 = leaderboard.slice(0, 3);

  async function handleCopyRecap() {
    await navigator.clipboard.writeText(formatRecapAsText(leaderboard, rounds));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {showCelebration && top3[0] && (
        <Celebration winnerName={top3[0].name} onDismiss={() => setShowCelebration(false)} />
      )}
      <main className="page">
        <NewSessionLink />
        <h1>Results</h1>
        {session && <SessionDate createdAt={session.created_at} />}

        <button
          className="btn-primary"
          onClick={() => shareToWhatsApp(formatRecapAsText(leaderboard, rounds))}
          style={{ width: '100%', marginTop: 16 }}
        >
          Share on WhatsApp
        </button>
        <button className="btn-secondary" onClick={handleCopyRecap} style={{ width: '100%', marginTop: 8 }}>
          {copied ? 'Copied!' : 'Copy Recap as Text'}
        </button>

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
              <Avatar name={p.name} />
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
                  <td style={{ padding: '8px 0', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={p.name} size={22} />
                      {p.name}
                    </div>
                  </td>
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
              <Avatar name={p.name} size={22} />
              <span className="leaderboard-name" style={{ flex: '0 0 70px' }}>{p.name}</span>
              <div className="win-bar-track">
                <div className="win-bar-fill" style={{ width: `${(p.wins / Math.max(1, session?.round_count ?? 1)) * 100}%` }} />
              </div>
              <span className="leaderboard-stats">{p.wins}</span>
            </div>
          ))}
        </div>

        <Link href="/setup" className="btn-primary" style={{ width: '100%', marginTop: 24, textAlign: 'center' }}>
          Start New Session
        </Link>
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
