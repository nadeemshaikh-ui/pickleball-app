'use client';

import { useState } from 'react';
import { signInWithGoogle } from '@/lib/auth';

export default function SignInGate({ message }: { message: string }) {
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    }
  }

  return (
    <main className="page">
      <h1>Sign In Required</h1>
      <p style={{ color: 'var(--muted)', margin: '12px 0' }}>{message}</p>
      <button className="btn-primary" onClick={handleSignIn}>
        Sign in with Google
      </button>
      {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}
    </main>
  );
}
