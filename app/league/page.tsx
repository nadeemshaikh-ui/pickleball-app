'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Share2, RefreshCw, Sparkles, Swords, BarChart3, ListOrdered, Gift, Award, ScrollText, CalendarDays } from 'lucide-react';
import {
  fetchPlayerOfTheMonthBoard,
  fetchBestDuos,
  fetchClosestRivalries,
  refreshLeagueStats,
  syncTheRealKing,
  MIN_GAMES_FOR_DUO_RANKING,
  MIN_GAMES_FOR_RIVALRY,
  type RankedPlayer,
  type RankedDuo,
  type Rivalry,
} from '@/lib/leagueStats';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { shareElementAsImage } from '@/lib/shareImage';
import { useCurrentClub } from '@/lib/useCurrentClub';
import Avatar from '@/components/Avatar';

export default function LeaguePage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [potm, setPotm] = useState<RankedPlayer[]>([]);
  const [duos, setDuos] = useState<RankedDuo[]>([]);
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const snapshotCaptureRef = useRef<HTMLDivElement>(null);

  async function load(clubId: string) {
    const [pb, db, rv] = await Promise.all([
      fetchPlayerOfTheMonthBoard(clubId),
      fetchBestDuos(clubId),
      fetchClosestRivalries(clubId),
      preloadPlayerPhotos(),
    ]);
    setPotm(pb);
    setDuos(db);
    setRivalries(rv);
  }

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const [user] = await Promise.all([getCurrentUser(), load(currentClubId!)]);
        if (user) setIsAdmin(await isCurrentUserAdmin(currentClubId!));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load league stats.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading]);

  async function handleRefresh() {
    if (!currentClubId) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshLeagueStats();
      await syncTheRealKing(currentClubId);
      await load(currentClubId);
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleShareSnapshot(filename: string) {
    if (!snapshotCaptureRef.current) return;
    setImageShareError(null);
    try {
      const result = await shareElementAsImage(snapshotCaptureRef.current, filename);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;
  if (loadError) return <main className="page"><p style={{ color: 'var(--danger)' }}>{loadError}</p></main>;

  const monthLeader = potm.find(p => !p.provisional) ?? null;
  const rankedDuos = duos.filter(d => !d.provisional).slice(0, 5);
  const rankedRivalries = rivalries.filter(r => !r.provisional).slice(0, 5);

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/setup" className="text-link-btn">+ New Session</Link>
        {isAdmin && (
          <button className="icon-btn" aria-label="Share league standings image on WhatsApp" onClick={() => handleShareSnapshot('league-standings.png')}>
            <Share2 size={16} />
          </button>
        )}
      </div>

      <h1>League</h1>

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} /> Refresh Stats Now</span>}
          </button>
          {refreshError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6 }}>{refreshError}</p>}
        </div>
      )}

      {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{imageShareError}</p>}

      <div ref={snapshotCaptureRef}>
        {monthLeader && (
          <>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={17} /> Player of the Month</h2>
            <Link href="/league/potm" className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'inherit', textDecoration: 'none' }}>
              <Avatar name={monthLeader.name} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{monthLeader.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                  {monthLeader.wins}W {monthLeader.losses}L this month ({(monthLeader.winPct * 100).toFixed(0)}%)
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>View Full Board →</span>
            </Link>
          </>
        )}

        <h2>Best Duos</h2>
        <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', marginBottom: 4 }}>
          Scramble/Fixed Partners/Court Swap only — Squad Rivalry teammates are forced, not chosen. Min {MIN_GAMES_FOR_DUO_RANKING} games together.
        </p>
        <div className="card">
          {rankedDuos.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No duo has played {MIN_GAMES_FOR_DUO_RANKING}+ games together yet.</p>}
          {rankedDuos.map(d => (
            <div key={d.players.join('|')} className="leaderboard-row">
              <Avatar name={d.players[0]} size={22} />
              <Avatar name={d.players[1]} size={22} />
              <span className="leaderboard-name">{d.players[0]} & {d.players[1]}</span>
              <span className="leaderboard-stats">
                {d.wins}/{d.gamesPlayed} wins ({(d.winPct * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Swords size={17} /> Closest Rivalries</h2>
        <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', marginBottom: 4 }}>
          Head-to-head record across every session played against each other. Min {MIN_GAMES_FOR_RIVALRY} games.
        </p>
        <div className="card">
          {rankedRivalries.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No rivalry has {MIN_GAMES_FOR_RIVALRY}+ head-to-head games yet.</p>}
          {rankedRivalries.map(r => (
            <div key={r.players.join('|')} className="leaderboard-row">
              <Avatar name={r.players[0]} size={22} />
              <Avatar name={r.players[1]} size={22} />
              <span className="leaderboard-name">{r.players[0]} vs {r.players[1]}</span>
              <span className="leaderboard-stats">
                {r.record[0]}-{r.record[1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Link href="/league/stats" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', marginBottom: 12, marginTop: 16 }}>
        <BarChart3 size={15} /> View Full Lifetime Stats
      </Link>

      <Link href="/league/ladder" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', marginBottom: 12 }}>
        <ListOrdered size={15} /> View Ladder League
      </Link>

      <Link href="/league/wrapped" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', marginBottom: 12 }}>
        <Gift size={15} /> Your Pickleball Wrapped
      </Link>

      <Link href="/league/badges" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', marginBottom: 12 }}>
        <Award size={15} /> Badge Gallery
      </Link>

      <Link href="/league/sessions" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', marginBottom: 12 }}>
        <ScrollText size={15} /> Session History
      </Link>

      {isAdmin && (
        <button
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', textAlign: 'center', marginBottom: 20 }}
          onClick={() => handleShareSnapshot('league-monthly-recap.png')}
        >
          <CalendarDays size={15} /> Share Monthly Recap
        </button>
      )}
    </main>
  );
}
