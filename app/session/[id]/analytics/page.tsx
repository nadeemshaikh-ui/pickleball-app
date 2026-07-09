'use client';

import { use, useEffect, useState } from 'react';
import { getSession, getRounds, type SessionRow, type RoundRow } from '@/lib/db';
import {
  findClosestGame,
  findBiggestBlowout,
  computeBestPartnership,
  computeLongestWinStreak,
  computeSessionTotals,
} from '@/lib/gameStats';
import SessionNav from '@/components/SessionNav';

function scoreLine(r: RoundRow): string {
  return `${r.team_a.join(' & ')} ${r.score_a} - ${r.score_b} ${r.team_b.join(' & ')}`;
}

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);

  useEffect(() => {
    async function load() {
      const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
      setSession(s);
      setRounds(r);
    }
    load();
  }, [id]);

  const closest = findClosestGame(rounds);
  const blowout = findBiggestBlowout(rounds);
  const bestPartnership = computeBestPartnership(rounds);
  const streak = computeLongestWinStreak(rounds);
  const totals = computeSessionTotals(rounds);

  return (
    <>
      <main className="page">
        <h1>Today&apos;s Analytics</h1>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          {totals.totalGames} of {session?.round_count ? session.round_count * 2 : '…'} games played
        </p>

        <h2>Session Overview</h2>
        <div className="card stat-card">
          <span className="stat-icon" aria-hidden="true">🎯</span>
          <div>
            <div className="stat-label">Total Points Scored</div>
            <div className="stat-value">{totals.totalPoints}</div>
          </div>
        </div>

        <h2>Highlights</h2>

        {closest && (
          <div className="card stat-card">
            <span className="stat-icon" aria-hidden="true">🔥</span>
            <div>
              <div className="stat-label">Closest Game</div>
              <div className="stat-value">{scoreLine(closest)}</div>
            </div>
          </div>
        )}

        {blowout && (
          <div className="card stat-card">
            <span className="stat-icon" aria-hidden="true">💥</span>
            <div>
              <div className="stat-label">Biggest Blowout</div>
              <div className="stat-value">{scoreLine(blowout)}</div>
            </div>
          </div>
        )}

        {bestPartnership && (
          <div className="card stat-card">
            <span className="stat-icon" aria-hidden="true">🤝</span>
            <div>
              <div className="stat-label">Best Partnership</div>
              <div className="stat-value">
                {bestPartnership.players.join(' & ')} — {bestPartnership.wins}/{bestPartnership.gamesPlayed} wins
              </div>
            </div>
          </div>
        )}

        {streak && streak.streak > 0 && (
          <div className="card stat-card">
            <span className="stat-icon" aria-hidden="true">⚡</span>
            <div>
              <div className="stat-label">Longest Win Streak</div>
              <div className="stat-value">{streak.name} — {streak.streak} in a row</div>
            </div>
          </div>
        )}

        {rounds.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No games scored yet — analytics fill in as you play.</p>
        )}
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
