'use client';

import { useEffect, useState } from 'react';
import { signInWithGoogle, signOut, getCurrentUser } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';

export default function LoginPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function handleSignIn() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;

  return (
    <main className="page">
      <h1>Sign In</h1>
      {user ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p>Signed in as {user.email}</p>
          <button className="btn-secondary" onClick={handleSignOut} style={{ marginTop: 12 }}>
            Sign Out
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
            Sign in with Google to register as a player, edit your profile, or use admin tools.
          </p>
          <button className="btn-primary" onClick={handleSignIn}>Sign in with Google</button>
        </div>
      )}
      {error && <p style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 12 }}>{error}</p>}
    </main>
  );
}
