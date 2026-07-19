'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, Plus, Calendar, Sparkles } from 'lucide-react';
import { fetchTournaments, createTournament, type TournamentRow } from '@/lib/tournaments';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';

type StatusFilter = 'all' | TournamentRow['status'];

const STATUS_LABEL: Record<TournamentRow['status'], string> = {
  draft: 'Draft',
  active: 'Live',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_COLOR: Record<TournamentRow['status'], string> = {
  draft: 'var(--muted)',
  active: '#16a34a',
  completed: '#2563eb',
  archived: 'var(--muted)',
};

// Shown only when the club has never created a real tournament — gives a
// first-time admin something concrete to look at (format + status badge)
// before they commit to building their own, rather than a bare "no
// tournaments yet" line. Not clickable, not real data.
const EXAMPLE_TOURNAMENTS: { name: string; format: string; status: TournamentRow['status'] }[] = [
  { name: 'Summer Smash 2026', format: 'Group → Knockout', status: 'completed' },
  { name: 'Monsoon Mixer', format: 'League', status: 'active' },
];

function StatusBadge({ status }: { status: TournamentRow['status'] }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        color: STATUS_COLOR[status],
        border: `1px solid ${STATUS_COLOR[status]}`,
        borderRadius: 999,
        padding: '2px 8px',
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function TournamentsPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const [user, list] = await Promise.all([getCurrentUser(), fetchTournaments(currentClubId!)]);
        setUserId(user?.id ?? null);
        setTournaments(list);
        if (user) setIsAdmin(await isCurrentUserAdmin(currentClubId!));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tournaments.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading]);

  async function handleCreate() {
    if (!currentClubId || !userId || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createTournament(currentClubId, newName.trim(), userId);
      setNewName('');
      window.location.href = `/tournaments/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tournament.');
    } finally {
      setCreating(false);
    }
  }

  // Mystery Partner is a distinct entry point (own button, own flow framing
  // on the resulting page via ?mystery=1) rather than "Create Tournament"
  // with an optional draw buried mid-page — same underlying tournament +
  // team + stage tables, since the draw/manual-pairing, group stage, and
  // top-N-by-wins-then-point-diff qualification it needs already exist and
  // already match spec, this only needed a real front door.
  const [creatingMystery, setCreatingMystery] = useState(false);
  async function handleCreateMystery() {
    if (!currentClubId || !userId) return;
    setCreatingMystery(true);
    setError(null);
    try {
      const id = await createTournament(currentClubId, 'Mystery Partner Night', userId);
      window.location.href = `/tournaments/${id}?mystery=1`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start Mystery Partner.');
      setCreatingMystery(false);
    }
  }

  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: tournaments.length, draft: 0, active: 0, completed: 0, archived: 0 };
    for (const t of tournaments) counts[t.status]++;
    return counts;
  }, [tournaments]);

  const visibleTournaments = filter === 'all' ? tournaments : tournaments.filter(t => t.status === filter);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/" className="text-link-btn">← Home</Link>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} /> Tournaments</h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          {!showCreateForm ? (
            <button className="btn-primary" onClick={() => setShowCreateForm(true)} style={{ width: '100%' }}>
              <Plus size={14} /> Create Tournament
            </button>
          ) : (
            <div className="card" style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Tournament name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          )}
          <Link
            href="/setup?format=team_championship"
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, width: '100%' }}
          >
            <Plus size={14} /> Start a Team Championship
          </Link>
          <button
            className="btn-secondary"
            onClick={handleCreateMystery}
            disabled={creatingMystery}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, width: '100%' }}
          >
            <Sparkles size={14} /> {creatingMystery ? 'Starting…' : 'Start Mystery Partner'}
          </button>
        </div>
      )}

      {tournaments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {(['all', 'active', 'draft', 'completed', 'archived'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f as TournamentRow['status']]} ({filterCounts[f]})
            </button>
          ))}
        </div>
      )}

      {tournaments.length === 0 ? (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
            No tournaments yet — here's what a couple look like once set up:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {EXAMPLE_TOURNAMENTS.map(ex => (
              <div key={ex.name} className="card" style={{ opacity: 0.6, cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>{ex.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: 999, padding: '1px 6px' }}>
                    EXAMPLE
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{ex.format}</div>
                <StatusBadge status={ex.status} />
              </div>
            ))}
          </div>
        </>
      ) : visibleTournaments.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No {filter} tournaments.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {visibleTournaments.map(t => (
            <Link key={t.id} href={`/tournaments/${t.id}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 700 }}>{t.name}</span>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                <Calendar size={12} />
                {new Date(t.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
