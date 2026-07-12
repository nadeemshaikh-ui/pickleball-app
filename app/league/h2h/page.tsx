'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Swords } from 'lucide-react';
import { fetchRivalriesForPlayer, type Rivalry } from '@/lib/leagueStats';
import { fetchPersonalBests, type PersonalBests } from '@/lib/personalBests';
import { listPlayers } from '@/lib/players';
import { useCurrentClub } from '@/lib/useCurrentClub';
import Avatar from '@/components/Avatar';

export default function HeadToHeadPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [names, setNames] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [bests, setBests] = useState<PersonalBests | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubLoading || !currentClubId) return;
    listPlayers(currentClubId).then(players => {
      const sorted = players.map(p => p.name).sort();
      setNames(sorted);
      if (sorted.length > 0) setSelected(sorted[0]);
      setLoading(false);
    });
  }, [currentClubId, clubLoading]);

  useEffect(() => {
    if (!currentClubId || !selected) return;
    Promise.all([fetchRivalriesForPlayer(currentClubId, selected), fetchPersonalBests(currentClubId, selected)]).then(([r, b]) => {
      setRivalries(r);
      setBests(b);
    });
  }, [currentClubId, selected]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  return (
    <main className="page">
      <Link href="/league/stats" className="text-link-btn">← Stats</Link>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Swords size={22} /> Head-to-Head</h1>

      <div className="card" style={{ marginTop: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>Player</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          aria-label="Select player"
          style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
        >
          {names.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {bests && bests.biggestMargin !== null && (
        <>
          <h2 style={{ fontSize: 15 }}>Personal Bests</h2>
          <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>
            <p style={{ margin: 0 }}>
              Biggest win: {bests.biggestMarginOwnScore}-{bests.biggestMarginOppScore} vs {bests.biggestMarginOpponents} (margin of {bests.biggestMargin})
            </p>
            <p style={{ margin: '4px 0 0' }}>Longest-ever win streak: {bests.longestStreak}</p>
          </div>
        </>
      )}

      <h2 style={{ fontSize: 15 }}>Record vs Every Opponent</h2>
      {rivalries.length === 0 && <p className="card" style={{ color: 'var(--muted)', fontSize: 14 }}>No games logged against anyone yet.</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 4px' }}>Opponent</th>
              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Record</th>
              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Games</th>
            </tr>
          </thead>
          <tbody>
            {rivalries.map(r => (
              <tr key={r.players[1]} style={{ borderBottom: '1px solid var(--border)', opacity: r.provisional ? 0.5 : 1 }}>
                <td style={{ padding: '8px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={r.players[1]} size={22} /> {r.players[1]}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>{r.record[0]}-{r.record[1]}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--muted)' }}>{r.gamesTogether}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
