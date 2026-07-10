'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchLifetimeLeaderboard,
  MIN_GAMES_FOR_RANKING,
  type LifetimePlayerStats,
} from '@/lib/leagueStats';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { shareToWhatsApp } from '@/lib/whatsapp';
import Avatar from '@/components/Avatar';

type SortKey = 'rank' | 'wins' | 'winPct' | 'gamesPlayed' | 'pointsFor';

export default function LeagueStatsPage() {
  const [lifetime, setLifetime] = useState<LifetimePlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('rank');

  useEffect(() => {
    async function init() {
      const [lb, , user] = await Promise.all([fetchLifetimeLeaderboard(), preloadPlayerPhotos(), getCurrentUser()]);
      setLifetime(lb);
      if (user) setIsAdmin(await isCurrentUserAdmin());
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <main className="page"><p>Loading…</p></main>;

  const rankedLifetime = lifetime.filter(p => !p.provisional);
  const provisionalLifetime = lifetime.filter(p => p.provisional);

  const sorted = [...rankedLifetime];
  if (sortKey === 'wins') sorted.sort((a, b) => b.wins - a.wins);
  else if (sortKey === 'winPct') sorted.sort((a, b) => b.winPct - a.winPct);
  else if (sortKey === 'gamesPlayed') sorted.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  else if (sortKey === 'pointsFor') sorted.sort((a, b) => b.pointsFor - a.pointsFor);
  // 'rank' keeps the incoming Wilson-score order from fetchLifetimeLeaderboard

  function shareText(): string {
    const lines = ['📊 Lifetime League Stats', ''];
    sorted.slice(0, 15).forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} — ${p.wins}W-${p.losses}L (${(p.winPct * 100).toFixed(0)}%), ${p.gamesPlayed} games`);
    });
    return lines.join('\n');
  }

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league" className="text-link-btn">← League</Link>
        {isAdmin && (
          <button className="icon-btn" aria-label="Share lifetime stats on WhatsApp" onClick={() => shareToWhatsApp(shareText())}>
            📤
          </button>
        )}
      </div>

      <h1>Lifetime Stats</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 8px', marginTop: 4 }}>
        Min {MIN_GAMES_FOR_RANKING} games to be ranked. Default order is confidence-adjusted (Wilson score) — accounts
        for sample size, not just raw win%.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, marginBottom: 12 }}>
        {([
          ['rank', 'Ranked'],
          ['wins', 'Wins'],
          ['winPct', 'Win %'],
          ['gamesPlayed', 'Games'],
          ['pointsFor', 'Points'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            className={sortKey === key ? 'btn-primary' : 'btn-secondary'}
            style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }}
            onClick={() => setSortKey(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {sorted.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nobody's hit {MIN_GAMES_FOR_RANKING} games yet.</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingBottom: 8 }}>#</th>
              <th style={{ textAlign: 'left', paddingBottom: 8 }}>Player</th>
              <th style={{ paddingBottom: 8 }}>W</th>
              <th style={{ paddingBottom: 8 }}>L</th>
              <th style={{ paddingBottom: 8 }}>Win%</th>
              <th style={{ paddingBottom: 8 }}>Games</th>
              <th style={{ paddingBottom: 8 }}>For</th>
              <th style={{ paddingBottom: 8 }}>Ag</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.name} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0' }}>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={p.name} size={22} />
                    {p.name}
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>{p.wins}</td>
                <td style={{ textAlign: 'center' }}>{p.losses}</td>
                <td style={{ textAlign: 'center' }}>{(p.winPct * 100).toFixed(0)}%</td>
                <td style={{ textAlign: 'center' }}>{p.gamesPlayed}</td>
                <td style={{ textAlign: 'center' }}>{p.pointsFor}</td>
                <td style={{ textAlign: 'center' }}>{p.pointsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </main>
  );
}
