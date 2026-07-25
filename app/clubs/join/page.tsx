'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import SignInGate from '@/components/SignInGate';
import JoinClubStep from '@/components/onboarding/JoinClubStep';
import ProfileStep from '@/components/onboarding/ProfileStep';
import { requestToJoinClub, type ClubRow } from '@/lib/clubs';

export default function JoinClubPage() {
  const router = useRouter();
  const { setCurrentClubId, user, loading: clubLoading } = useCurrentClub();
  const [pendingClub, setPendingClub] = useState<ClubRow | null>(null);
  const [requestedClubName, setRequestedClubName] = useState<string | null>(null);

  if (clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to join a club." />;

  if (requestedClubName) {
    return (
      <main className="page">
        <Link href="/clubs" className="text-link-btn">← Clubs</Link>
        <h1>Request Sent</h1>
        <div className="card">
          <p style={{ margin: 0 }}>
            Your request to join <strong>{requestedClubName}</strong> is pending — you&apos;ll get access once the admin approves you.
          </p>
        </div>
      </main>
    );
  }

  if (pendingClub) {
    return (
      <main className="page">
        <Link href="/clubs" className="text-link-btn">← Clubs</Link>
        <h1>Set up your profile</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>For {pendingClub.name} — the admin will see this when reviewing your request.</p>
        <div style={{ marginTop: 12 }}>
          <ProfileStep
            clubId={pendingClub.id}
            onSubmit={async fields => {
              await requestToJoinClub(pendingClub.id, fields);
              setRequestedClubName(pendingClub.name);
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <Link href="/clubs" className="text-link-btn">← Clubs</Link>
      <h1>Join a Club</h1>
      <div style={{ marginTop: 12 }}>
        <JoinClubStep
          onJoined={clubId => {
            setCurrentClubId(clubId);
            router.push(`/clubs/${clubId}`);
          }}
          onRequestStart={club => setPendingClub(club)}
        />
      </div>
    </main>
  );
}
