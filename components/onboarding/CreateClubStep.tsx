'use client';

import { useState } from 'react';
import { createClub } from '@/lib/clubs';

interface CreateClubStepProps {
  onDone: (clubId: string) => void;
  // Fires instead of onDone when this account already has a club — creation
  // was queued for super-admin approval rather than happening instantly.
  onRequestPending?: () => void;
}

export default function CreateClubStep({ onDone, onRequestPending }: CreateClubStepProps) {
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
      const result = await createClub(name.trim(), logoFile);
      if (result.status === 'pending_approval') {
        onRequestPending?.();
      } else {
        onDone(result.club.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create club.');
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Name your club</h2>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Sunday Smashers"
        aria-label="Club name"
        style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      />
      <div>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
          Logo (optional — can add later)
        </label>
        <input type="file" accept="image/*" aria-label="Club logo" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
      </div>
      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <button className="btn-primary" onClick={handleCreate} disabled={submitting}>
        {submitting ? 'Creating…' : 'Create Club'}
      </button>
    </div>
  );
}
