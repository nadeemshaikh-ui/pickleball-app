'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Swords, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { fetchRivalriesForPlayer, type Rivalry } from '@/lib/leagueStats';
import { fetchPersonalBests, type PersonalBests } from '@/lib/personalBests';
import { fetchMatchHistory, type MatchHistoryEntry } from '@/lib/matchHistory';
import { fetchPendingChallenges, createChallenge, type Challenge } from '@/lib/challenges';
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
  const [ownPlayerName, setOwnPlayerName] = useState<string | null>(null);
  const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]);
  const [challenging, setChallenging] = useState<string | null>(null);

  // Expanded opponent card — mirrors the ?vs= query param (deep-linkable,
  // shareable) but renders inline under that opponent's own card instead of
  // a separate section elsewhere on the page.
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
      setOwnPlayerName(own?.name ?? null);
      if (own) fetchPendingChallenges(currentClubId!, own.name).then(setPendingChallenges).catch(() => setPendingChallenges([]));
      setLoading(false);
    }
    init();
  }, [currentClubId, clubLoading]);

  async function handleChallenge(opponentName: string) {
    if (!currentClubId || !ownPlayerName) return;
    setChallenging(opponentName);
    try {
      await createChallenge(currentClubId, ownPlayerName, opponentName);
      setPendingChallenges(await fetchPendingChallenges(currentClubId, ownPlayerName));
    } finally {
      setChallenging(null);
    }
  }

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

  function toggleHistoryFor(name: string) {
    router.push(opponent === name ? '/league/h2h' : `/league/h2h?vs=${encodeURIComponent(name)}`);
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
        <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Biggest Win</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{bests.biggestMarginOwnScore}-{bests.biggestMarginOppScore}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>vs {bests.biggestMarginOpponents} (+{bests.biggestMargin})</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Best Streak</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{bests.longestStreak}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>games</div>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 15 }}>Record vs Every Opponent</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 8 }}>Tap a name to see match-by-match history.</p>
      {rivalries.length === 0 && <p className="card" style={{ color: 'var(--muted)', fontSize: 14 }}>No games logged against anyone yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rivalries.map(r => {
          const name = r.players[1];
          const isOpen = opponent === name;
          return (
            <div key={name} className="card" style={{ opacity: r.provisional ? 0.5 : 1, padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleHistoryFor(name)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Avatar name={name} size={28} />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{name}</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{r.record[0]}-{r.record[1]}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 60, textAlign: 'right' }}>{r.gamesTogether} games</span>
                {isOpen ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 14px' }}>
                  {historyLoading && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>}
                  {!historyLoading && matchHistory.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>No matches found between these two.</p>
                  )}
                  {!historyLoading &&
                    matchHistory.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: i < matchHistory.length - 1 ? '1px solid var(--border)' : undefined,
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                            {new Date(m.date).toLocaleDateString()} · {formatLabel(m.format as Format)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {m.yourPartner ?? '—'} vs {m.opponentPartner ?? '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>{m.yourScore}-{m.opponentScore}</div>
                          <div style={{ fontWeight: 700, fontSize: 11, color: m.won ? 'var(--accent, #3f6b4a)' : 'var(--danger)' }}>
                            {m.won ? 'Won' : 'Lost'}
                          </div>
                        </div>
                      </div>
                    ))}
                  {selected === ownPlayerName && (
                    <button
                      className="text-link-btn"
                      style={{ fontSize: 12, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      disabled={challenging === name || pendingChallenges.some(c => c.opponentName === name || c.challengerName === name)}
                      onClick={() => handleChallenge(name)}
                    >
                      {pendingChallenges.some(c => c.opponentName === name || c.challengerName === name)
                        ? 'Challenge pending'
                        : <><Zap size={12} /> Challenge</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
