'use client';

import { useEffect, useState } from 'react';
import { signOut, getCurrentUser } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

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
          <GoogleSignInButton />
        </div>
      )}
    </main>
  );
}
