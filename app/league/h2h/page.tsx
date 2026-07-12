'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Swords, X } from 'lucide-react';
import { fetchRivalriesForPlayer, type Rivalry } from '@/lib/leagueStats';
import { fetchPersonalBests, type PersonalBests } from '@/lib/personalBests';
import { fetchMatchHistory, type MatchHistoryEntry } from '@/lib/matchHistory';
import { listPlayers } from '@/lib/players';
import { getCurrentUser } from '@/lib/auth';
import { getOwnPlayer } from '@/lib/players';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { formatLabel } from '@/lib/formatLabel';
import type { Format } from '@/lib/db';
import Avatar from '@/components/Avatar';

export default function HeadToHeadPage() {
  return (
    <Suspense fallback={<main className="page"><p>Loading…</p></main>}>
      <HeadToHeadPageInner />
    </Suspense>
  );
}

function HeadToHeadPageInner() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [names, setNames] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [bests, setBests] = useState<PersonalBests | null>(null);
  const [loading, setLoading] = useState(true);

  const opponent = searchParams.get('vs');
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (clubLoading || !currentClubId) return;
    async function init() {
      const [players, user] = await Promise.all([listPlayers(currentClubId!), getCurrentUser()]);
      const sorted = players.map(p => p.name).sort();
      setNames(sorted);
      const own = user ? await getOwnPlayer(currentClubId!, user.id) : null;
      setSelected(own?.name ?? sorted[0] ?? '');
      setLoading(false);
    }
    init();
  }, [currentClubId, clubLoading]);

  useEffect(() => {
    if (!currentClubId || !selected) return;
    Promise.all([fetchRivalriesForPlayer(currentClubId, selected), fetchPersonalBests(currentClubId, selected)]).then(([r, b]) => {
      setRivalries(r);
      setBests(b);
    });
  }, [currentClubId, selected]);

  useEffect(() => {
    if (!currentClubId || !selected || !opponent) {
      setMatchHistory([]);
      return;
    }
    setHistoryLoading(true);
    fetchMatchHistory(currentClubId, selected, opponent)
      .then(setMatchHistory)
      .finally(() => setHistoryLoading(false));
  }, [currentClubId, selected, opponent]);

  function showHistoryFor(name: string) {
    router.push(`/league/h2h?vs=${encodeURIComponent(name)}`);
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  return (
    <main className="page">
      <Link href="/league/stats" className="text-link-btn">← Stats</Link>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Swords size={22} /> Head-to-Head</h1>

      <div className="card" style={{ marginTop: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>Viewing as</label>
        <select
          value={selected}
          onChange={e => {
            setSelected(e.target.value);
            router.push('/league/h2h');
          }}
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

      {opponent && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>
              {selected} vs {opponent} — Match History
            </h2>
            <button className="icon-btn" aria-label="Close match history" onClick={() => router.push('/league/h2h')} style={{ width: 28, height: 28 }}>
              <X size={16} />
            </button>
          </div>
          {historyLoading && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>}
          {!historyLoading && matchHistory.length === 0 && (
            <p className="card" style={{ color: 'var(--muted)', fontSize: 14 }}>No matches found between these two.</p>
          )}
          {matchHistory.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>Date</th>
                    <th style={{ padding: '6px 4px' }}>Format</th>
                    <th style={{ padding: '6px 4px' }}>Partners</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Score</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {matchHistory.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 4px', color: 'var(--muted)' }}>{new Date(m.date).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 4px', color: 'var(--muted)' }}>{formatLabel(m.format as Format)}</td>
                      <td style={{ padding: '8px 4px', fontSize: 12, color: 'var(--muted)' }}>
                        {m.yourPartner ?? '—'} vs {m.opponentPartner ?? '—'}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>{m.yourScore}-{m.opponentScore}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: m.won ? 'var(--accent, #3f6b4a)' : 'var(--danger)' }}>
                        {m.won ? 'Won' : 'Lost'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 style={{ fontSize: 15 }}>Record vs Every Opponent</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 8 }}>Tap a name to see match-by-match history.</p>
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
              <tr
                key={r.players[1]}
                onClick={() => showHistoryFor(r.players[1])}
                style={{ borderBottom: '1px solid var(--border)', opacity: r.provisional ? 0.5 : 1, cursor: 'pointer', background: opponent === r.players[1] ? 'var(--background)' : undefined }}
              >
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
