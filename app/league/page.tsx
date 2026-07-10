'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchLifetimeLeaderboard,
  fetchPlayerOfTheMonthBoard,
  fetchBestDuos,
  refreshLeagueStats,
  MIN_GAMES_FOR_RANKING,
  MIN_GAMES_FOR_DUO_RANKING,
  type LifetimePlayerStats,
  type RankedPlayer,
  type RankedDuo,
} from '@/lib/leagueStats';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { shareToWhatsApp } from '@/lib/whatsapp';
import Avatar from '@/components/Avatar';

export default function LeaguePage() {
  const [lifetime, setLifetime] = useState<LifetimePlayerStats[]>([]);
  const [potm, setPotm] = useState<RankedPlayer[]>([]);
  const [duos, setDuos] = useState<RankedDuo[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function load() {
    const [lb, pb, db] = await Promise.all([
      fetchLifetimeLeaderboard(),
      fetchPlayerOfTheMonthBoard(),
      fetchBestDuos(),
      preloadPlayerPhotos(),
    ]);
    setLifetime(lb);
    setPotm(pb);
    setDuos(db);
  }

  useEffect(() => {
    async function init() {
      const [user] = await Promise.all([getCurrentUser(), load()]);
      if (user) setIsAdmin(await isCurrentUserAdmin());
      setLoading(false);
    }
    init();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshLeagueStats();
      await load();
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }

  function shareText(): string {
    const lines = ['🏆 League Standings', ''];
    lifetime
      .filter(p => !p.provisional)
      .slice(0, 10)
      .forEach((p, i) => lines.push(`${i + 1}. ${p.name} — ${(p.winPct * 100).toFixed(0)}% (${p.gamesPlayed} games)`));
    const monthLeader = potm.find(p => !p.provisional);
    if (monthLeader) {
      lines.push('', `🌟 Player of the Month: ${monthLeader.name}`);
    }
    return lines.join('\n');
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;

  const rankedLifetime = lifetime.filter(p => !p.provisional);
  const provisionalLifetime = lifetime.filter(p => p.provisional);
  const monthLeader = potm.find(p => !p.provisional) ?? null;
  const rankedDuos = duos.filter(d => !d.provisional).slice(0, 5);

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/setup" className="text-link-btn">+ New Session</Link>
        {isAdmin && (
          <button className="icon-btn" aria-label="Share league standings on WhatsApp" onClick={() => shareToWhatsApp(shareText())}>
            📤
          </button>
        )}
      </div>

      <h1>League</h1>

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : '🔄 Refresh Stats Now'}
          </button>
          {refreshError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6 }}>{refreshError}</p>}
        </div>
      )}

      {monthLeader && (
        <>
          <h2>🌟 Player of the Month</h2>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={monthLeader.name} size={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{monthLeader.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                {monthLeader.wins}W {monthLeader.losses}L this month ({(monthLeader.winPct * 100).toFixed(0)}%)
              </div>
            </div>
          </div>
        </>
      )}

      <h2>Lifetime Leaderboard</h2>
      <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', marginBottom: 4 }}>
        Ranked by confidence-adjusted win rate — accounts for how many games played, not just raw win%. Min {MIN_GAMES_FOR_RANKING} games to rank.
      </p>
      <div className="card">
        {rankedLifetime.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nobody's hit {MIN_GAMES_FOR_RANKING} games yet.</p>}
        {rankedLifetime.map((p, i) => (
          <div key={p.name} className="leaderboard-row">
            <span className={`rank-badge rank-${i + 1 <= 3 ? i + 1 : ''}`}>{i + 1}</span>
            <Avatar name={p.name} size={24} />
            <span className="leaderboard-name">{p.name}</span>
            <span className="leaderboard-stats">
              {p.wins}W-{p.losses}L · {(p.winPct * 100).toFixed(0)}% · {p.gamesPlayed} games
            </span>
          </div>
        ))}
      </div>

      {provisionalLifetime.length > 0 && (
        <>
          <h2>Still Building a Record</h2>
          <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', marginBottom: 4 }}>
            Fewer than {MIN_GAMES_FOR_RANKING} games — shown here, not yet ranked.
          </p>
          <div className="card">
            {provisionalLifetime.map(p => (
              <div key={p.name} className="leaderboard-row">
                <Avatar name={p.name} size={24} />
                <span className="leaderboard-name">{p.name}</span>
                <span className="leaderboard-stats">
                  {p.wins}W-{p.losses}L · {p.gamesPlayed} games
                </span>
              </div>
            ))}
          </div>
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
    </main>
  );
}
