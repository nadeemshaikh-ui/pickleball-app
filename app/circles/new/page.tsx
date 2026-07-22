'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCircle } from '@/lib/circles';
import { useCurrentGroup } from '@/lib/useCurrentGroup';
import SignInGate from '@/components/SignInGate';

export default function NewCirclePage() {
  const { user, loading, setCurrentGroup } = useCurrentGroup();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to play with friends." />;

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give your circle a name — e.g. "Sunday Regulars".');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const circle = await createCircle(name);
      setCurrentGroup({ type: 'circle', circleId: circle.id });
      router.push('/setup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create circle.');
      setCreating(false);
    }
  }

  return (
    <main className="page">
      <h1>Play with Friends</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
        No club needed — just you and whoever you're playing with tonight. Create a circle, share the code, start scoring.
      </p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Circle name — e.g. Sunday Regulars"
          aria-label="Circle name"
          style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
        />
        {error && <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{error}</p>}
        <button className="btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create Circle'}
        </button>
      </div>
      <p style={{ marginTop: 16, fontSize: 13 }}>
        Already have a code? <a href="/circles/join">Join a circle</a> instead.
      </p>
    </main>
  );
}
