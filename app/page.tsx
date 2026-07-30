'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import { getOwnPlayer } from '@/lib/players';
import { getLatestActiveSession, deleteSession, type SessionRow } from '@/lib/db';
import { fetchLifetimeLeaderboard, fetchStreaks, type LifetimePlayerStats } from '@/lib/leagueStats';
import { fetchStreakRecords } from '@/lib/streakRecords';
import { fetchPendingChallenges } from '@/lib/challenges';
import {
  listPendingJoinRequests,
  listMyPendingJoinRequests,
  listMyPendingClubCreationRequests,
  checkAndExecutePendingJoinCode,
  type JoinRequestRow,
  type ClubRow,
  type ClubCreationRequestRow,
} from '@/lib/clubs';
import { computeBadges, buildBadgeInput, type Badge } from '@/lib/badges';
import SignInGate from '@/components/SignInGate';
import { Flame, Crown, Zap, Bell, Trash2 } from 'lucide-react';
import BadgeMedallion from '@/components/BadgeMedallion';

export default function HomePage() {
  const router = useRouter();
  const { user, currentClub, currentClubId, setCurrentClubId, isCurrentClubAdmin, loading: clubLoading } = useCurrentClub();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [streak, setStreak] = useState(0);
  const [isStreakKing, setIsStreakKing] = useState(false);
  const [pendingChallengeCount, setPendingChallengeCount] = useState(0);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequestRow[]>([]);
  const [myPendingRequests, setMyPendingRequests] = useState<(JoinRequestRow & { club: ClubRow })[]>([]);
  const [myPendingClubCreationRequests, setMyPendingClubCreationRequests] = useState<ClubCreationRequestRow[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [ownStats, setOwnStats] = useState<LifetimePlayerStats | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);

  useEffect(() => {
    getLatestActiveSession(currentClubId).then(setActiveSession).catch(() => setActiveSession(null));
  }, [currentClubId]);

  async function handleAbandonSession() {
    if (!activeSession) return;
    if (!confirm('Are you sure you want to abandon and delete this active session? All round scores logged so far will be permanently removed.')) return;
    try {
      await deleteSession(activeSession.id);
      setActiveSession(null);
    } catch (err) {
      alert('Failed to abandon session. Please try again.');
    }
  }

  useEffect(() => {
    if (clubLoading) return;
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }
    async function checkAuth() {
      const joinedClub = await checkAndExecutePendingJoinCode(user!.id);
      if (joinedClub) {
        setCurrentClubId(joinedClub.id);
        router.replace(`/clubs/${joinedClub.id}`);
        return;
      }
      const done = await hasCompletedOnboarding(user!.id);
      if (!done) {
        router.replace('/onboarding');
        return;
      }
      setCheckingOnboarding(false);
    }
    checkAuth();
  }, [user, clubLoading, router, setCurrentClubId]);

  useEffect(() => {
    if (checkingOnboarding || !user || currentClubId) return;
    listMyPendingJoinRequests().then(setMyPendingRequests).catch(() => setMyPendingRequests([]));
    listMyPendingClubCreationRequests().then(setMyPendingClubCreationRequests).catch(() => setMyPendingClubCreationRequests([]));
  }, [checkingOnboarding, user, currentClubId]);

  useEffect(() => {
    if (checkingOnboarding || !user || !currentClubId) {
      setDashboardLoading(false);
      return;
    }
    // ClubSwitcher (in the global header) can change currentClubId without
    // unmounting this page — without a staleness guard, a slow response for
    // the club the user just switched AWAY from could resolve after the
    // effect re-ran, see own=null for that stale club, and wrongly
    // force-navigate a user looking at a perfectly valid club.
    let cancelled = false;
    async function load() {
      setDashboardLoading(true);
      try {
        const own = await getOwnPlayer(currentClubId!, user!.id);
        if (cancelled) return;
        if (!own) {
          // Member with no player row yet — pre-existing account from before
          // onboarding shipped, or any other edge case that slipped past it.
          // getInitialStep(hasClub=true) routes straight to ProfileStep, and
          // upsertOwnPlayer is idempotent, so this is a safe one-way fallback.
          router.replace('/onboarding');
          return;
        }
        const [streaks, records, challenges, leaderboard] = await Promise.all([
          fetchStreaks(currentClubId!),
          fetchStreakRecords(currentClubId!),
          fetchPendingChallenges(currentClubId!, own?.name ?? ''),
          fetchLifetimeLeaderboard(currentClubId!),
        ]);
        if (cancelled) return;
        if (own) {
          setStreak(streaks.get(own.name) ?? 0);
          const winRecordHolder = records.find(r => r.streakType === 'win')?.holderName;
          setIsStreakKing(winRecordHolder === own.name);

          const statsRow = leaderboard.find(p => p.name === own.name) ?? null;
          setOwnStats(statsRow);
          const rankedIndex = leaderboard.filter(p => !p.provisional).findIndex(p => p.name === own.name);
          setRank(rankedIndex >= 0 ? rankedIndex + 1 : null);

          buildBadgeInput(currentClubId!, own.name, own.games_played, own.elo_rating).then(input => setBadges(computeBadges(input)));
        }
        setPendingChallengeCount(challenges.length);
        if (isCurrentClubAdmin) {
          setPendingJoinRequests(await listPendingJoinRequests(currentClubId!));
        } else {
          setPendingJoinRequests([]);
        }
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [checkingOnboarding, user, currentClubId, isCurrentClubAdmin]);

  if (clubLoading || checkingOnboarding) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to plan sessions and track your league stats." />;

  return (
    <main className="page">
      <Link href={currentClubId ? `/clubs/${currentClubId}` : '/clubs'} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: 'inherit', textDecoration: 'none' }}>
        {currentClub?.logo_url && (
          <img src={currentClub.logo_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {currentClub?.name ?? 'Pickleball Session'}
            {isCurrentClubAdmin && (
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 4, padding: '2px 6px' }}>
                Admin
              </span>
            )}
          </h1>
        </div>
      </Link>

      {activeSession && (
        <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, rgba(0, 180, 216, 0.08) 0%, rgba(0, 119, 182, 0.12) 100%)', border: '1.5px solid var(--primary)', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
              <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--primary)' }}>
                Ongoing Session Active
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', background: 'var(--card)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                #{activeSession.id}
              </span>
              <button
                onClick={handleAbandonSession}
                title="Abandon & Delete Session"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} /> Abandon
              </button>
            </div>
          </div>

          <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 800 }}>
            {activeSession.group_name ?? (activeSession.club_id ? 'Club Session' : 'Guest Event')}
          </h3>

          <p style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--muted)' }}>
            {activeSession.players.length} Players · {activeSession.round_count} Rounds · Courts {activeSession.court_labels.join(' & ')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Link href={`/session/${activeSession.id}/schedule`} className="btn-primary" style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center' }}>
              📅 Schedule
            </Link>
            <Link href={`/session/${activeSession.id}/play`} className="btn-primary" style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', background: 'var(--dark)' }}>
              🎾 Score
            </Link>
            <Link href={`/session/${activeSession.id}/leaderboard`} className="btn-primary" style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              🏆 Ranks
            </Link>
          </div>
        </div>
      )}

      {!currentClubId && (
        <div className="card" style={{ marginBottom: 12 }}>
          {myPendingRequests.length > 0 || myPendingClubCreationRequests.length > 0 ? (
            <>
              {myPendingRequests.map(r => (
                <p key={r.id} style={{ margin: 0 }}>
                  <Bell size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Your request to join <strong>{r.club.name}</strong> is pending — we&apos;ll let you in once the admin approves you.
                </p>
              ))}
              {myPendingClubCreationRequests.map(r => (
                <p key={r.id} style={{ margin: 0 }}>
                  <Bell size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Your request to create <strong>{r.requested_name}</strong> is pending super-admin review.
                </p>
              ))}
            </>
          ) : (
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              You&apos;re not in a club yet. <Link href="/clubs">Create or join one</Link> to start a session.
            </p>
          )}
        </div>
      )}

      {!dashboardLoading && ownStats && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Rank</div><div style={{ fontWeight: 800, fontSize: 20 }}>{rank ? `#${rank}` : '—'}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Record</div><div style={{ fontWeight: 800, fontSize: 20 }}>{ownStats.wins}-{ownStats.losses}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Streak</div><div style={{ fontWeight: 800, fontSize: 20, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{streak > 0 ? <><Flame size={16} /> {streak}</> : '—'}{isStreakKing && <Crown size={16} />}</div></div>
          </div>

          {badges.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              {badges.slice(0, 5).map(b => (
                <BadgeMedallion key={b.id} badge={b} size={32} />
              ))}
              {badges.length > 5 && (
                <Link href="/league/badges" style={{ fontSize: 11, color: 'var(--muted)' }}>+{badges.length - 5} more</Link>
              )}
            </div>
          )}

          <Link href="/league/stats" style={{ display: 'block', textAlign: 'right', fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            View full stats →
          </Link>
        </div>
      )}

      {!dashboardLoading && !ownStats && currentClubId && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>You&apos;re in!</p>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Play your first session to start tracking stats, streaks, and badges.
          </p>
          <Link href="/setup" className="btn-primary" style={{ display: 'inline-block', marginTop: 10 }}>
            Start a session
          </Link>
        </div>
      )}

      {pendingChallengeCount > 0 && (
        <Link href="/league/h2h" className="card" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--text-accent, inherit)' }}>
          <Zap size={15} /> {pendingChallengeCount} pending challenge{pendingChallengeCount === 1 ? '' : 's'} — respond
        </Link>
      )}

      {isCurrentClubAdmin && pendingJoinRequests.length > 0 && currentClubId && (
        <Link href={`/clubs/${currentClubId}/settings`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--text-accent, inherit)' }}>
          <Bell size={15} /> {pendingJoinRequests.length} pending join request{pendingJoinRequests.length === 1 ? '' : 's'} — review
        </Link>
      )}
    </main>
  );
}
