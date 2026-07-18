'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import SignInGate from '@/components/SignInGate';
import CreateClubStep from '@/components/onboarding/CreateClubStep';

export default function NewClubPage() {
  const router = useRouter();
  const { setCurrentClubId, user, loading: clubLoading } = useCurrentClub();
  const [pending, setPending] = useState(false);

  if (clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to create a club." />;

  if (pending) {
    return (
      <main className="page">
        <Link href="/clubs" className="text-link-btn">← Clubs</Link>
        <h1>Request Sent</h1>
        <div className="card">
          <p style={{ margin: 0 }}>
            You already have a club, so a new one needs approval — we&apos;ll let you know once it&apos;s reviewed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <Link href="/clubs" className="text-link-btn">← Clubs</Link>
      <h1>Create a Club</h1>
      <div style={{ marginTop: 12 }}>
        <CreateClubStep
          onDone={clubId => {
            setCurrentClubId(clubId);
            router.push(`/clubs/${clubId}/settings`);
          }}
          onRequestPending={() => setPending(true)}
        />
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
        You&apos;ll be this club&apos;s admin. You&apos;ll get a join code on the next screen to share with your group.
      </p>
    </main>
  );
}
