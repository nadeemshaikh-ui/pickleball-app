'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClub } from '@/lib/clubs';
import { useCurrentClub } from '@/lib/useCurrentClub';

export default function NewClubPage() {
  const router = useRouter();
  const { setCurrentClubId } = useCurrentClub();
  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give your club a name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const club = await createClub(name.trim(), logoFile);
      setCurrentClubId(club.id);
      router.push(`/clubs/${club.id}/settings`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create club.');
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <Link href="/clubs" className="text-link-btn">← Clubs</Link>
      <h1>Create a Club</h1>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Club name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Sunday Smashers"
            aria-label="Club name"
            style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Logo (optional — can add later)
          </label>
          <input type="file" accept="image/*" aria-label="Club logo" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}

      <button className="btn-primary" onClick={handleCreate} disabled={submitting} style={{ width: '100%', marginTop: 20 }}>
        {submitting ? 'Creating…' : 'Create Club'}
      </button>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
        You'll be this club's admin. You'll get a join code on the next screen to share with your group.
      </p>
    </main>
  );
}
