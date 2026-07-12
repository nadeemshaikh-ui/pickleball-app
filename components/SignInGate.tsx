'use client';

import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function SignInGate({ message }: { message: string }) {
  return (
    <main className="page">
      <h1>Sign In Required</h1>
      <p style={{ color: 'var(--muted)', margin: '12px 0' }}>{message}</p>
      <GoogleSignInButton />
    </main>
  );
}
