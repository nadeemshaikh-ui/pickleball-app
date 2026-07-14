'use client';

import { use, useEffect, useRef, useState } from 'react';
import { Ban, CheckCircle2, IndianRupee, Swords as SwordsIcon } from 'lucide-react';
import { getSession, getRounds, type SessionRow, type RoundRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotals, type PlayerStats } from '@/lib/analytics';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import Link from 'next/link';
import SessionNav from '@/components/SessionNav';
import Avatar from '@/components/Avatar';
import Celebration from '@/components/Celebration';
import ConfirmModal from '@/components/ConfirmModal';
import NewSessionLink from '@/components/NewSessionLink';
import SessionDate from '@/components/SessionDate';
import GroupHeader from '@/components/GroupHeader';
import RecapImageTemplate from '@/components/RecapImageTemplate';
import { WhatsAppIcon } from '@/components/icons';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { fetchSessionDues, markDuePaid, type DueRow } from '@/lib/dues';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { fetchStreaks, fetchMvpCounts } from '@/lib/leagueStats';
import { flightForRating } from '@/lib/flights';
import { computeBadges, type Badge } from '@/lib/badges';
import { listPlayers, getOwnPlayer } from '@/lib/players';
import { fetchConfirmations, confirmParticipation, voidSession, type Confirmation } from '@/lib/sessionConfirmations';
import { getClubUpiVpa } from '@/lib/clubs';
import { shareToWhatsApp } from '@/lib/whatsapp';

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
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [ownUserId, setOwnUserId] = useState<string | null>(null);
  const [ownPlayerName, setOwnPlayerName] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [upiVpa, setUpiVpa] = useState<string | null>(null);
  const [winnerBadges, setWinnerBadges] = useState<Badge[]>([]);
  const [winnerStreak, setWinnerStreak] = useState(0);
  const [winnerMvpCount, setWinnerMvpCount] = useState(0);
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
      setConfirmations(await fetchConfirmations(id));
      getClubUpiVpa(s.club_id).then(setUpiVpa).catch(() => setUpiVpa(null));
      if (user) {
        setIsAdmin(await isCurrentUserAdmin(s.club_id));
        const own = await getOwnPlayer(s.club_id, user.id);
        if (own) {
          setOwnUserId(user.id);
          setOwnPlayerName(own.name);
        }
      }
      const celebratedKey = `celebrated-${id}`;
      if (s.status === 'completed' && board.length > 0 && !sessionStorage.getItem(celebratedKey)) {
        setShowCelebration(true);
        sessionStorage.setItem(celebratedKey, '1');
        const winnerName = board[0].name;
        try {
          const [streaks, mvpCounts, players] = await Promise.all([fetchStreaks(s.club_id), fetchMvpCounts(s.club_id), listPlayers(s.club_id)]);
          const winnerPlayer = players.find(p => p.name === winnerName);
          const streak = streaks.get(winnerName) ?? 0;
          const mvpCount = mvpCounts.get(winnerName) ?? 0;
          setWinnerStreak(streak);
          setWinnerMvpCount(mvpCount);
          if (winnerPlayer) {
            setWinnerBadges(
              computeBadges({
                gamesPlayed: winnerPlayer.games_played,
                currentStreak: streak,
                mvpCount,
                flight: flightForRating(winnerPlayer.elo_rating),
              })
            );
          }
        } catch {
          // Celebration still shows without the badge/streak/MVP flourish — not worth blocking on.
        }
      }
    }
    load();
  }, [id]);

  async function handleConfirm() {
    if (!session || !ownUserId || !ownPlayerName) return;
    setConfirming(true);
    try {
      await confirmParticipation(id, session.club_id, ownPlayerName, ownUserId);
      setConfirmations(await fetchConfirmations(id));
    } finally {
      setConfirming(false);
    }
  }

  async function handleVoid() {
    setShowVoidConfirm(false);
    setVoiding(true);
    try {
      await voidSession(id);
      setSession(await getSession(id));
    } finally {
      setVoiding(false);
    }
  }

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
        <Celebration
          winnerName={top3[0].name}
          onDismiss={() => setShowCelebration(false)}
          badges={winnerBadges}
          streak={winnerStreak}
          mvpCount={winnerMvpCount}
        />
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
        {session && <SessionDate createdAt={session.created_at} venue={session.venue} />}

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

        {session && session.status === 'voided' && (
          <p className="card" style={{ color: 'var(--danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ban size={16} /> This session was voided — its matches don't count toward league stats, badges, or streaks.
          </p>
        )}

        {session && session.status !== 'voided' && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={14} /> {confirmations.length}/{session.players.length} players confirmed they played
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {ownPlayerName && !confirmations.some(c => c.playerName === ownPlayerName) && (
                <button className="btn-primary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={handleConfirm} disabled={confirming}>
                  {confirming ? 'Confirming…' : 'Yes, I played this'}
                </button>
              )}
              {isAdmin && (
                <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setShowVoidConfirm(true)} disabled={voiding}>
                  {voiding ? 'Voiding…' : <><Ban size={13} /> Void Session</>}
                </button>
              )}
            </div>
            {showVoidConfirm && (
              <ConfirmModal
                title="Void this session?"
                message={
                  confirmations.length > 0
                    ? `${confirmations.length} player${confirmations.length === 1 ? ' has' : 's have'} already confirmed they played this session. Void anyway? Its matches will stop counting toward league stats, badges, and streaks.`
                    : 'Its matches will stop counting toward league stats, badges, and streaks.'
                }
                confirmLabel="Void Session"
                danger
                onConfirm={handleVoid}
                onCancel={() => setShowVoidConfirm(false)}
              />
            )}
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
          For/Ag = Points For/Against
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leaderboard.map(p => (
            <div key={p.name} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Avatar name={p.name} size={22} />
                {p.name}
                <Link
                  href={`/league/h2h?vs=${encodeURIComponent(p.name)}`}
                  aria-label={`Head-to-head vs ${p.name}`}
                  title="Head-to-head match history"
                  style={{ display: 'inline-flex', color: 'var(--muted)', fontWeight: 400 }}
                >
                  <SwordsIcon size={13} />
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 13 }}>
                <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Wins</div>{p.wins}</div>
                <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Losses</div>{p.losses}</div>
                <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>For</div>{p.pointsFor}</div>
                <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Ag</div>{p.pointsAgainst}</div>
              </div>
            </div>
          ))}
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
                  {!d.paid && (session?.booker_upi_vpa ?? upiVpa) && (
                    <a
                      href={`tez://upi/pay?pa=${encodeURIComponent(session?.booker_upi_vpa ?? upiVpa!)}&pn=${encodeURIComponent('Pickleball Session')}&am=${d.amount_owed}&cu=INR`}
                      className="text-link-btn"
                      style={{ fontSize: 12, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <IndianRupee size={12} /> Pay
                    </a>
                  )}
                  {!d.paid && isAdmin && (session?.booker_upi_vpa ?? upiVpa) && (
                    <button
                      className="text-link-btn"
                      style={{ fontSize: 12, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="Remind via WhatsApp"
                      aria-label={`Remind ${d.player_name} via WhatsApp`}
                      onClick={() =>
                        shareToWhatsApp(
                          `Hey ${d.player_name}, you owe ₹${d.amount_owed} for the session. Pay via UPI to ${session?.booker_upi_vpa ?? upiVpa}`
                        )
                      }
                    >
                      <WhatsAppIcon size={12} />
                    </button>
                  )}
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
