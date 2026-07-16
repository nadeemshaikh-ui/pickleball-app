'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { listSessions, type SessionRow } from '@/lib/db';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { formatLabel } from '@/lib/formatLabel';
import { useCurrentClub } from '@/lib/useCurrentClub';

function SessionHistoryContent() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  // Pre-filled from a ?player= deep link (e.g. the cross-club profile page's
  // "See matches" button), but still editable via the dropdown below.
  const [playerFilter, setPlayerFilter] = useState(searchParams.get('player') ?? '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    Promise.all([listSessions(currentClubId), listPlayers(currentClubId)])
      .then(([s, p]) => {
        setSessions(s);
        setPlayers(p);
      })
      .finally(() => setLoading(false));
  }, [currentClubId, clubLoading]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  const filteredSessions = playerFilter ? sessions.filter(s => s.players.includes(playerFilter)) : sessions;

  return (
    <main className="page">
      <Link href="/league" className="text-link-btn">← League</Link>
      <h1>Session History</h1>

      {players.length > 0 && (
        <select value={playerFilter} onChange={e => setPlayerFilter(e.target.value)} style={{ marginBottom: 12, width: '100%' }}>
          <option value="">All players</option>
          {players.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      )}

      {filteredSessions.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          {playerFilter ? `No sessions found for ${playerFilter}.` : 'No sessions played yet.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {filteredSessions.map(s => (
          <Link key={s.id} href={`/session/${s.id}/results`} className="card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {new Date(s.created_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {formatLabel(s.format)}
                  {s.venue ? ` — ${s.venue}` : ''}
                  {s.status === 'voided' ? ' — voided' : ''}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.players.length} players</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

// useSearchParams() requires a Suspense boundary for Next's static-generation
// pass (build failed without this: "should be wrapped in a suspense boundary").
export default function SessionHistoryPage() {
  return (
    <Suspense fallback={<main className="page"><p>Loading…</p></main>}>
      <SessionHistoryContent />
    </Suspense>
  );
}
