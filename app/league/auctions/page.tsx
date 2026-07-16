'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gavel, Plus } from 'lucide-react';
import { fetchAuctions, createAuction, type AuctionRow } from '@/lib/auctions';
import { isCurrentUserAdmin } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';

export default function AuctionsPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
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
        const [list, admin] = await Promise.all([fetchAuctions(currentClubId!), isCurrentUserAdmin(currentClubId!)]);
        setAuctions(list);
        setIsAdmin(admin);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load auctions.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading]);

  async function handleCreate() {
    if (!currentClubId || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createAuction(currentClubId, newName.trim());
      setNewName('');
      window.location.href = `/league/auctions/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create auction.');
    } finally {
      setCreating(false);
    }
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league" className="text-link-btn">← League</Link>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gavel size={22} /> Auctions</h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      {isAdmin && (
        <div className="card" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input type="text" placeholder="Auction name" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
            <Plus size={14} /> Create
          </button>
        </div>
      )}

      {auctions.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No auctions yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {auctions.map(a => (
          <Link key={a.id} href={`/league/auctions/${a.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{a.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{a.status.replace('_', ' ')}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
