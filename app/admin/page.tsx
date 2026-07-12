'use client';

import { useEffect, useState } from 'react';
import { isSuperAdmin, listAllClubsForSuperAdmin, type SuperAdminClubRow } from '@/lib/clubs';

export default function SuperAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [clubs, setClubs] = useState<SuperAdminClubRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await isSuperAdmin();
      setAllowed(ok);
      if (ok) setClubs(await listAllClubsForSuperAdmin());
      setLoading(false);
    })();
  }, []);

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!allowed) return <main className="page"><p>Not authorized.</p></main>;

  return (
    <main className="page">
      <h1>All Clubs ({clubs.length})</h1>
      <div className="card">
        {clubs.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{c.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.member_count} member{c.member_count === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
