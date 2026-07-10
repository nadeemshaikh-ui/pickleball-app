'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentClub } from '@/lib/useCurrentClub';
import SignInGate from '@/components/SignInGate';

export default function ClubsPage() {
  const router = useRouter();
  const { clubs, currentClubId, setCurrentClubId, user, loading } = useCurrentClub();

  function handleSwitch(clubId: string) {
    setCurrentClubId(clubId);
    router.push('/setup');
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to see your clubs, or create a new one." />;

  return (
    <main className="page">
      <h1>Your Clubs</h1>

      {clubs.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '12px 0' }}>
          You're not in a club yet. Create one or join with a code.
        </p>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {clubs.map(m => (
          <div key={m.club_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {m.club.logo_url ? (
              <img src={m.club.logo_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee', display: 'inline-block' }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                {m.club.name} {m.club_id === currentClubId && <span style={{ fontSize: 12, color: 'var(--dark)' }}>✓ Active</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.role === 'admin' ? 'Admin' : 'Member'}</div>
            </div>
            {m.club_id !== currentClubId && (
              <button className="btn-secondary" style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }} onClick={() => handleSwitch(m.club_id)}>
                Switch
              </button>
            )}
            {m.role === 'admin' && (
              <Link href={`/clubs/${m.club_id}/settings`} className="text-link-btn">
                Settings
              </Link>
            )}
          </div>
        ))}
      </div>

      <Link href="/clubs/new" className="btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
        + Create a Club
      </Link>
      <Link href="/clubs/join" className="btn-secondary" style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>
        Join a Club
      </Link>
    </main>
  );
}
