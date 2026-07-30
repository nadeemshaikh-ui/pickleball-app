'use client';

import { useState } from 'react';
import { signInWithGoogle } from '@/lib/auth';

interface GoogleSignInButtonProps {
  redirectTo?: string;
  label?: string;
}

export default function GoogleSignInButton({ redirectTo, label = 'Sign in with Google' }: GoogleSignInButtonProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    try {
      await signInWithGoogle(redirectTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={handleSignIn}>
        {label}
      </button>
      {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}
    </>
  );
}
