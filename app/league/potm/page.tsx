'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { fetchPlayerOfTheMonthBoard, fetchYearlyLeaderboard, type RankedPlayer } from '@/lib/leagueStats';
import { useCurrentClub } from '@/lib/useCurrentClub';
import Avatar from '@/components/Avatar';

export default function PlayerOfTheMonthPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [board, setBoard] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubLoading || !currentClubId) return;
    setLoading(true);
    const fetcher = period === 'month' ? fetchPlayerOfTheMonthBoard : fetchYearlyLeaderboard;
    fetcher(currentClubId)
      .then(setBoard)
      .finally(() => setLoading(false));
  }, [currentClubId, clubLoading, period]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  const ranked = board.filter(p => !p.provisional);
  const provisional = board.filter(p => p.provisional);

  return (
    <main className="page">
      <Link href="/league" className="text-link-btn">← League</Link>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={22} /> Player of the {period === 'month' ? 'Month' : 'Year'}</h1>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, marginBottom: 16 }}>
        <button className={period === 'month' ? 'btn-primary' : 'btn-secondary'} style={{ minHeight: 32, padding: '4px 14px', fontSize: 13 }} onClick={() => setPeriod('month')}>Monthly</button>
        <button className={period === 'year' ? 'btn-primary' : 'btn-secondary'} style={{ minHeight: 32, padding: '4px 14px', fontSize: 13 }} onClick={() => setPeriod('year')}>Yearly</button>
      </div>

      {ranked.length === 0 && <p className="card" style={{ color: 'var(--muted)', fontSize: 14 }}>No ranked players yet this {period}.</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 4px' }}>#</th>
              <th style={{ padding: '6px 4px' }}>Player</th>
              <th style={{ padding: '6px 4px', textAlign: 'right' }}>W</th>
              <th style={{ padding: '6px 4px', textAlign: 'right' }}>L</th>
              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Win %</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => (
              <tr key={p.name} style={{ borderBottom: '1px solid var(--border)', fontWeight: i === 0 ? 700 : 400 }}>
                <td style={{ padding: '8px 4px' }}>{i === 0 ? <Sparkles size={14} /> : i + 1}</td>
                <td style={{ padding: '8px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={p.name} size={22} /> {p.name}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{p.wins}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{p.losses}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{(p.winPct * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {provisional.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, marginTop: 20, color: 'var(--muted)' }}>Not yet ranked (too few games)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {provisional.map(p => (
                  <tr key={p.name} style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <td style={{ padding: '6px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={p.name} size={18} /> {p.name}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{p.gamesPlayed} games</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
