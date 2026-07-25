'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Calendar } from 'lucide-react';
import { listTeamChampionshipHistory, type SessionRow } from '@/lib/db';
import { useCurrentClub } from '@/lib/useCurrentClub';

export default function TeamChampionshipHistoryPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    listTeamChampionshipHistory(currentClubId)
      .then(setSessions)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load history.'))
      .finally(() => setLoading(false));
  }, [currentClubId, clubLoading]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/tournaments" className="text-link-btn">← Tournaments</Link>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} /> Team Championship History</h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      {sessions.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No completed Team Championships yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => {
            const squadNames = (s.squads ?? []).map(sq => sq.label).filter(Boolean) as string[];
            return (
              <Link
                key={s.id}
                href={`/session/${s.id}/team-championship/results`}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'inherit' }}
              >
                <span style={{ fontWeight: 700 }}>
                  {s.group_name || squadNames.join(' vs ') || 'Team Championship'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                  <Calendar size={12} />
                  {new Date(s.event_date ?? s.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
