'use client';

import { use, useEffect, useRef, useState } from 'react';
import { getSession, getRounds, type SessionRow, type RoundRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotals, type PlayerStats } from '@/lib/analytics';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import Link from 'next/link';
import SessionNav from '@/components/SessionNav';
import Avatar from '@/components/Avatar';
import Celebration from '@/components/Celebration';
import NewSessionLink from '@/components/NewSessionLink';
import SessionDate from '@/components/SessionDate';
import GroupHeader from '@/components/GroupHeader';
import RecapImageTemplate from '@/components/RecapImageTemplate';
import { WhatsAppIcon } from '@/components/icons';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { fetchSessionDues, markDuePaid, type DueRow } from '@/lib/dues';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [squadTotals, setSquadTotals] = useState<{ gold: number; black: number } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [recapFile, setRecapFile] = useState<File | null>(null);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const [dues, setDues] = useState<DueRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const recapCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [s, r, , user] = await Promise.all([getSession(id), getRounds(id), preloadPlayerPhotos(), getCurrentUser()]);
      setSession(s);
      setRounds(r);
      const board = computeLeaderboard(r);
      setLeaderboard(board);
      if (s.format === 'squad_rivalry' && s.squads) {
        setSquadTotals(computeSquadTotals(r, s.squads));
      }
      setDues(await fetchSessionDues(id));
      if (user) setIsAdmin(await isCurrentUserAdmin());
      const celebratedKey = `celebrated-${id}`;
      if (s.status === 'completed' && board.length > 0 && !sessionStorage.getItem(celebratedKey)) {
        setShowCelebration(true);
        sessionStorage.setItem(celebratedKey, '1');
      }
    }
    load();
  }, [id]);

  async function handleTogglePaid(due: DueRow) {
    await markDuePaid(due.id, !due.paid);
    setDues(await fetchSessionDues(id));
  }

  // Pre-render the recap image as soon as the data it needs is ready, well
  // before the user clicks share — see lib/shareImage.ts for why this
  // matters (the click handler must not await any rendering work itself).
  useEffect(() => {
    if (!session || leaderboard.length === 0 || !recapCaptureRef.current) return;
    renderElementToImage(recapCaptureRef.current, `recap-${id}.png`)
      .then(setRecapFile)
      .catch(() => setRecapFile(null));
  }, [session, leaderboard, rounds, id]);

  async function handleShareRecap() {
    if (!recapFile) return;
    setImageShareError(null);
    try {
      const result = await shareCachedImage(recapFile);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  const top3 = leaderboard.slice(0, 3);

  return (
    <>
      {showCelebration && top3[0] && (
        <Celebration winnerName={top3[0].name} onDismiss={() => setShowCelebration(false)} />
      )}
      <main className="page">
        <div className="page-header-row">
          <NewSessionLink />
          <button
            className="icon-btn"
            aria-label="Share recap image on WhatsApp"
            onClick={handleShareRecap}
            disabled={!recapFile}
          >
            <WhatsAppIcon size={24} />
          </button>
        </div>
        {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{imageShareError}</p>}

        {/* Off-screen recap capture — pre-rendered ahead of the share click. */}
        {session && (
          <div style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden="true">
            <div ref={recapCaptureRef}>
              <RecapImageTemplate session={session} leaderboard={leaderboard} rounds={rounds} />
            </div>
          </div>
        )}

        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        <h1>Results</h1>
        {session && <SessionDate createdAt={session.created_at} />}

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
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', padding: '0 8px', marginBottom: 4 }}>
          Rank · Player · Win–Loss (Win %)
        </p>
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
        <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', marginBottom: 4 }}>
          W = Wins · L = Losses · For/Ag = Points For/Against · Diff = Point Differential
        </p>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 8 }}>Player</th>
                <th style={{ paddingBottom: 8 }} title="Wins">W</th>
                <th style={{ paddingBottom: 8 }} title="Losses">L</th>
                <th style={{ paddingBottom: 8 }} title="Points For">For</th>
                <th style={{ paddingBottom: 8 }} title="Points Against">Ag</th>
                <th style={{ paddingBottom: 8 }} title="Point Differential">Diff</th>
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

        {dues.length > 0 && (
          <>
            <h2>Dues</h2>
            <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', marginBottom: 4 }}>
              ₹{dues[0].amount_owed} per head · court + ball cost split evenly
            </p>
            <div className="card">
              {dues.map(d => (
                <div key={d.id} className="leaderboard-row">
                  <Avatar name={d.player_name} size={22} />
                  <span className="leaderboard-name">{d.player_name}</span>
                  <span className="leaderboard-stats">₹{d.amount_owed}</span>
                  {isAdmin ? (
                    <button
                      className={d.paid ? 'btn-primary' : 'btn-secondary'}
                      style={{ minHeight: 32, padding: '4px 10px', fontSize: 12, marginLeft: 8 }}
                      onClick={() => handleTogglePaid(d)}
                    >
                      {d.paid ? '✓ Paid' : 'Mark Paid'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: d.paid ? 'var(--dark)' : 'var(--muted)', marginLeft: 8, fontWeight: 700 }}>
                      {d.paid ? '✓ Paid' : 'Unpaid'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <Link href="/setup" className="btn-primary" style={{ width: '100%', marginTop: 24, textAlign: 'center' }}>
          Start New Session
        </Link>
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
