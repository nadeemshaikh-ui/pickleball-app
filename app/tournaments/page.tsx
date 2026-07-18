'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Plus } from 'lucide-react';
import { fetchTournaments, createTournament, type TournamentRow } from '@/lib/tournaments';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';

export default function TournamentsPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      setTournaments(await fetchTournaments(currentClubId));
      window.location.href = `/tournaments/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tournament.');
    } finally {
      setCreating(false);
    }
  }

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
        <div className="card" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Tournament name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
            <Plus size={14} /> Create
          </button>
        </div>
      )}

      {tournaments.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No tournaments yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tournaments.map(t => (
          <Link key={t.id} href={`/tournaments/${t.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{t.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{t.status}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
