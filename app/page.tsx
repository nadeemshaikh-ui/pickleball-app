'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import { getOwnPlayer } from '@/lib/players';
import { fetchLifetimeLeaderboard, fetchStreaks, fetchMvpCounts, fetchBestDuos, type LifetimePlayerStats } from '@/lib/leagueStats';
import { fetchStreakRecords } from '@/lib/streakRecords';
import { fetchPendingChallenges } from '@/lib/challenges';
import { listPendingJoinRequests, type JoinRequestRow } from '@/lib/clubs';
import { flightForRating } from '@/lib/flights';
import { computeBadges, type Badge } from '@/lib/badges';
import SignInGate from '@/components/SignInGate';
import { Flame, Crown, Zap, Bell, Trophy, Gift, Award } from 'lucide-react';
import BadgeMedallion from '@/components/BadgeMedallion';

const POWER_DUO_MIN_GAMES = 10;
const POWER_DUO_MIN_WIN_RATE = 0.7;

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
  const [ownStats, setOwnStats] = useState<LifetimePlayerStats | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [mvpCount, setMvpCount] = useState(0);
  const [badges, setBadges] = useState<Badge[]>([]);

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
        const [streaks, records, challenges, leaderboard, mvpCounts, duos] = await Promise.all([
          fetchStreaks(currentClubId!),
          fetchStreakRecords(currentClubId!),
          fetchPendingChallenges(currentClubId!, own?.name ?? ''),
          fetchLifetimeLeaderboard(currentClubId!),
          fetchMvpCounts(currentClubId!),
          fetchBestDuos(currentClubId!),
        ]);
        if (own) {
          const flightName = flightForRating(own.elo_rating);
          setFlight(flightName);
          setStreak(streaks.get(own.name) ?? 0);
          const winRecordHolder = records.find(r => r.streakType === 'win')?.holderName;
          const lossRecordHolder = records.find(r => r.streakType === 'loss')?.holderName;
          setIsStreakKing(winRecordHolder === own.name);

          const statsRow = leaderboard.find(p => p.name === own.name) ?? null;
          setOwnStats(statsRow);
          const rankedIndex = leaderboard.filter(p => !p.provisional).findIndex(p => p.name === own.name);
          setRank(rankedIndex >= 0 ? rankedIndex + 1 : null);
          setMvpCount(mvpCounts.get(own.name) ?? 0);

          const ownDuos = duos.filter(d => d.players.includes(own.name));
          const eligibleDuos = duos.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
          const topDuo = eligibleDuos.length > 0 ? [...eligibleDuos].sort((a, b) => b.winPct - a.winPct)[0] : null;
          setBadges(
            computeBadges({
              gamesPlayed: own.games_played,
              currentStreak: streaks.get(own.name) ?? 0,
              mvpCount: mvpCounts.get(own.name) ?? 0,
              flight: flightName,
              isWinStreakRecordHolder: winRecordHolder === own.name,
              isLossStreakRecordHolder: lossRecordHolder === own.name,
              duoCount: ownDuos.length,
              hasPowerDuo: ownDuos.some(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES && d.winPct >= POWER_DUO_MIN_WIN_RATE),
              isClubTopDuo: topDuo !== null && topDuo.players.includes(own.name),
            })
          );
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
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 10 }}>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Rank</div><div style={{ fontWeight: 800 }}>{rank ? `#${rank}` : '—'}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Record</div><div style={{ fontWeight: 800 }}>{ownStats ? `${ownStats.wins}-${ownStats.losses}` : '—'}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Win%</div><div style={{ fontWeight: 800 }}>{ownStats ? `${(ownStats.winPct * 100).toFixed(0)}%` : '—'}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Games</div><div style={{ fontWeight: 800 }}>{ownStats?.gamesPlayed ?? '—'}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>MVP</div><div style={{ fontWeight: 800 }}>{mvpCount}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Flight</div><div style={{ fontWeight: 800 }}>{flight}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Streak</div><div style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{streak > 0 ? <><Flame size={13} /> {streak}</> : '—'}{isStreakKing && <Crown size={13} />}</div></div>
            {pendingChallengeCount > 0 && (
              <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Challenges</div><div style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Zap size={13} /> {pendingChallengeCount}</div></div>
            )}
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
        </div>
      )}

      {isCurrentClubAdmin && pendingJoinRequests.length > 0 && currentClubId && (
        <Link href={`/clubs/${currentClubId}/settings`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--text-accent, inherit)' }}>
          <Bell size={15} /> {pendingJoinRequests.length} pending join request{pendingJoinRequests.length === 1 ? '' : 's'} — review
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
        <Link href="/league" className="btn-secondary" style={{ flex: 1, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Trophy size={14} /> League</Link>
        <Link href="/league/wrapped" className="btn-secondary" style={{ flex: 1, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Gift size={14} /> Wrapped</Link>
        <Link href="/league/badges" className="btn-secondary" style={{ flex: 1, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Award size={14} /> Badges</Link>
      </div>
    </main>
  );
}
