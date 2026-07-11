'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import { getOwnPlayer } from '@/lib/players';
import { fetchStreaks } from '@/lib/leagueStats';
import { fetchStreakRecords } from '@/lib/streakRecords';
import { fetchPendingChallenges } from '@/lib/challenges';
import { listPendingJoinRequests, type JoinRequestRow } from '@/lib/clubs';
import { flightForRating } from '@/lib/flights';
import SignInGate from '@/components/SignInGate';

export default function HomePage() {
  const router = useRouter();
  const { user, clubs, currentClub, currentClubId, isCurrentClubAdmin, setCurrentClubId, loading: clubLoading } = useCurrentClub();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [flight, setFlight] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [isStreakKing, setIsStreakKing] = useState(false);
  const [pendingChallengeCount, setPendingChallengeCount] = useState(0);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequestRow[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    if (clubLoading) return;
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }
    hasCompletedOnboarding(user.id).then(done => {
      if (!done) {
        router.replace('/onboarding');
        return;
      }
      setCheckingOnboarding(false);
    });
  }, [user, clubLoading, router]);

  useEffect(() => {
    if (checkingOnboarding || !user || !currentClubId) {
      setDashboardLoading(false);
      return;
    }
    async function load() {
      setDashboardLoading(true);
      try {
        const own = await getOwnPlayer(currentClubId!, user!.id);
        const [streaks, records, challenges] = await Promise.all([
          fetchStreaks(currentClubId!),
          fetchStreakRecords(currentClubId!),
          fetchPendingChallenges(currentClubId!, own?.name ?? ''),
        ]);
        if (own) {
          setFlight(flightForRating(own.elo_rating));
          setStreak(streaks.get(own.name) ?? 0);
          setIsStreakKing(records.find(r => r.streakType === 'win')?.holderName === own.name);
        }
        setPendingChallengeCount(challenges.length);
        if (isCurrentClubAdmin) {
          setPendingJoinRequests(await listPendingJoinRequests(currentClubId!));
        } else {
          setPendingJoinRequests([]);
        }
      } finally {
        setDashboardLoading(false);
      }
    }
    load();
  }, [checkingOnboarding, user, currentClubId, isCurrentClubAdmin]);

  if (clubLoading || checkingOnboarding) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to plan sessions and track your league stats." />;

  return (
    <main className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {currentClub?.logo_url && (
          <img src={currentClub.logo_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div>
          <h1 style={{ margin: 0 }}>{currentClub?.name ?? 'Pickleball Session'}</h1>
          {clubs.length > 1 && (
            <select
              aria-label="Switch club"
              value={currentClubId ?? ''}
              onChange={e => setCurrentClubId(e.target.value)}
              style={{ fontSize: 12, marginTop: 2 }}
            >
              {clubs.map(m => (
                <option key={m.club_id} value={m.club_id}>{m.club.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!dashboardLoading && flight && (
        <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Flight</div>
            <div style={{ fontWeight: 800 }}>{flight}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Streak</div>
            <div style={{ fontWeight: 800 }}>{streak > 0 ? `🔥 ${streak}` : '—'}{isStreakKing && ' 👑'}</div>
          </div>
          {pendingChallengeCount > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Challenges</div>
              <div style={{ fontWeight: 800 }}>🥊 {pendingChallengeCount}</div>
            </div>
          )}
        </div>
      )}

      {isCurrentClubAdmin && pendingJoinRequests.length > 0 && currentClubId && (
        <Link href={`/clubs/${currentClubId}/settings`} className="card" style={{ display: 'block', marginBottom: 12, color: 'var(--text-accent, inherit)' }}>
          🔔 {pendingJoinRequests.length} pending join request{pendingJoinRequests.length === 1 ? '' : 's'} — review
        </Link>
      )}

      <Link href="/setup" className="btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
        New Session
      </Link>
      <Link href="/register" className="btn-secondary" style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>
        My Profile
      </Link>
      {isCurrentClubAdmin && currentClubId && (
        <Link href={`/clubs/${currentClubId}/settings`} className="btn-secondary" style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>
          Club Settings
        </Link>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Link href="/league" className="btn-secondary" style={{ flex: 1, textAlign: 'center' }}>🏆 League</Link>
        <Link href="/league/wrapped" className="btn-secondary" style={{ flex: 1, textAlign: 'center' }}>🎁 Wrapped</Link>
        <Link href="/league/badges" className="btn-secondary" style={{ flex: 1, textAlign: 'center' }}>🏅 Badges</Link>
      </div>
    </main>
  );
}
