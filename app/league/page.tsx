'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchPlayerOfTheMonthBoard,
  fetchBestDuos,
  fetchClosestRivalries,
  refreshLeagueStats,
  MIN_GAMES_FOR_DUO_RANKING,
  MIN_GAMES_FOR_RIVALRY,
  type RankedPlayer,
  type RankedDuo,
  type Rivalry,
} from '@/lib/leagueStats';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { shareToWhatsApp } from '@/lib/whatsapp';
import Avatar from '@/components/Avatar';

export default function LeaguePage() {
  const [potm, setPotm] = useState<RankedPlayer[]>([]);
  const [duos, setDuos] = useState<RankedDuo[]>([]);
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function load() {
    const [pb, db, rv] = await Promise.all([
      fetchPlayerOfTheMonthBoard(),
      fetchBestDuos(),
      fetchClosestRivalries(),
      preloadPlayerPhotos(),
    ]);
    setPotm(pb);
    setDuos(db);
    setRivalries(rv);
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
    const monthLeader = potm.find(p => !p.provisional);
    if (monthLeader) {
      lines.push(`🌟 Player of the Month: ${monthLeader.name}`, '');
    }
    duos
      .filter(d => !d.provisional)
      .slice(0, 5)
      .forEach(d => lines.push(`👯 ${d.players[0]} & ${d.players[1]} — ${(d.winPct * 100).toFixed(0)}% together`));
    return lines.join('\n');
  }

  function monthlyRecapText(): string {
    const now = new Date();
    const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const lines = [`📅 ${monthName} Recap`, ''];
    const monthLeader = potm.find(p => !p.provisional);
    if (monthLeader) {
      lines.push(`🌟 Player of the Month: ${monthLeader.name} — ${monthLeader.wins}W ${monthLeader.losses}L (${(monthLeader.winPct * 100).toFixed(0)}%)`, '');
    }
    const topDuo = duos.find(d => !d.provisional);
    if (topDuo) {
      lines.push(`👯 Best Duo: ${topDuo.players[0]} & ${topDuo.players[1]} — ${(topDuo.winPct * 100).toFixed(0)}% together`, '');
    }
    const topRivalry = rivalries.find(r => !r.provisional);
    if (topRivalry) {
      lines.push(`⚔️ Closest Rivalry: ${topRivalry.players[0]} vs ${topRivalry.players[1]} — ${topRivalry.record[0]}-${topRivalry.record[1]}`);
    }
    return lines.join('\n');
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;

  const monthLeader = potm.find(p => !p.provisional) ?? null;
  const rankedDuos = duos.filter(d => !d.provisional).slice(0, 5);
  const rankedRivalries = rivalries.filter(r => !r.provisional).slice(0, 5);

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

      <Link href="/league/stats" className="btn-secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 12 }}>
        📊 View Full Lifetime Stats
      </Link>

      {isAdmin && (
        <button
          className="btn-secondary"
          style={{ display: 'block', width: '100%', textAlign: 'center', marginBottom: 20 }}
          onClick={() => shareToWhatsApp(monthlyRecapText())}
        >
          📅 Share Monthly Recap
        </button>
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

      <h2>⚔️ Closest Rivalries</h2>
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
    </main>
  );
}
