'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinCircleByCode } from '@/lib/circles';
import { useCurrentGroup } from '@/lib/useCurrentGroup';
import SignInGate from '@/components/SignInGate';

export default function JoinCirclePage() {
  const { user, loading, setCurrentGroup } = useCurrentGroup();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to join a circle." />;

  async function handleJoin() {
    if (!code.trim()) {
      setError('Enter the circle code your friend shared with you.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const circle = await joinCircleByCode(code);
      setCurrentGroup({ type: 'circle', circleId: circle.id });
      router.push('/setup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join circle.');
      setJoining(false);
    }
  }

  return (
    <main className="page">
      <h1>Join a Circle</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
        Enter the code someone on your circle shared with you.
      </p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Circle code"
          aria-label="Circle code"
          style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8, textTransform: 'uppercase' }}
        />
        {error && <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{error}</p>}
        <button className="btn-primary" onClick={handleJoin} disabled={joining}>
          {joining ? 'Joining…' : 'Join Circle'}
        </button>
      </div>
      <p style={{ marginTop: 16, fontSize: 13 }}>
        Don't have a code? <a href="/circles/new">Create a circle</a> instead.
      </p>
    </main>
  );
}
