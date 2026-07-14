'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianRupee } from 'lucide-react';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { getOwnPlayer } from '@/lib/players';
import { fetchMyDuesForClub, type MyDueRow } from '@/lib/dues';
import { getClubUpiVpa } from '@/lib/clubs';
import { formatLabel } from '@/lib/formatLabel';
import type { Format } from '@/lib/db';
import SignInGate from '@/components/SignInGate';

export default function MyDuesPage() {
  const { user, currentClubId, loading: clubLoading } = useCurrentClub();
  const [dues, setDues] = useState<MyDueRow[]>([]);
  const [clubUpiVpa, setClubUpiVpa] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubLoading || !user || !currentClubId) {
      setLoading(false);
      return;
    }
    (async () => {
      const own = await getOwnPlayer(currentClubId, user.id);
      const [rows, vpa] = await Promise.all([
        own ? fetchMyDuesForClub(currentClubId, own.name) : Promise.resolve([]),
        getClubUpiVpa(currentClubId),
      ]);
      setDues(rows);
      setClubUpiVpa(vpa);
      setLoading(false);
    })();
  }, [clubLoading, user, currentClubId]);

  if (clubLoading || loading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to see what you owe." />;

  const total = dues.reduce((sum, d) => sum + d.amount_owed, 0);

  return (
    <main className="page">
      <h1>My Dues</h1>

      <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total you owe</div>
        <div style={{ fontSize: 32, fontWeight: 800 }}>₹{total}</div>
      </div>

      {dues.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nothing outstanding — you&apos;re all settled up.</p>}

      {dues.map(d => {
        const vpa = d.session_booker_upi_vpa ?? clubUpiVpa;
        return (
          <div key={d.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>₹{d.amount_owed}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {formatLabel(d.session_format as Format)} · {new Date(d.session_created_at).toLocaleDateString()}
              </div>
            </div>
            {vpa && (
              <a
                href={`tez://upi/pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent('Pickleball Session')}&am=${d.amount_owed}&cu=INR`}
                className="btn-secondary"
                style={{ minHeight: 32, padding: '4px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <IndianRupee size={12} /> Pay
              </a>
            )}
            <Link href={`/session/${d.session_id}/results`} className="text-link-btn" style={{ fontSize: 12 }}>
              View
            </Link>
          </div>
        );
      })}
    </main>
  );
}
