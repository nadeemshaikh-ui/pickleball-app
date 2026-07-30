'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import JoinClubStep from '@/components/onboarding/JoinClubStep';
import ProfileStep from '@/components/onboarding/ProfileStep';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { requestToJoinClub, joinClubByCode, PENDING_JOIN_CODE_KEY, type ClubRow } from '@/lib/clubs';
import { markOnboardingComplete } from '@/lib/onboarding';
import { isAnonymousUser } from '@/lib/auth';

export default function JoinClubPage() {
  return (
    <Suspense fallback={<main className="page"><p>Loading…</p></main>}>
      <JoinClubInner />
    </Suspense>
  );
}

function JoinClubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code');
  const { setCurrentClubId, user, loading: clubLoading } = useCurrentClub();
  const [pendingClub, setPendingClub] = useState<ClubRow | null>(null);
  const [requestedClubName, setRequestedClubName] = useState<string | null>(null);
  const [joiningCode, setJoiningCode] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Stash join code in sessionStorage as soon as visitor lands on the invite URL
  useEffect(() => {
    if (codeParam && typeof window !== 'undefined') {
      sessionStorage.setItem(PENDING_JOIN_CODE_KEY, codeParam.toUpperCase());
    }
  }, [codeParam]);

  const isRealUser = user && !isAnonymousUser(user);

  // Auto-join if signed in with Google and a ?code= parameter (or pending_join_code) is present
  useEffect(() => {
    if (clubLoading || !isRealUser || joiningCode) return;
    const targetCode = codeParam || (typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_JOIN_CODE_KEY) : null);
    if (!targetCode) return;

    async function autoJoin() {
      setJoiningCode(true);
      setJoinError(null);
      try {
        const club = await joinClubByCode(targetCode!);
        await markOnboardingComplete(user!.id);
        if (typeof window !== 'undefined') sessionStorage.removeItem(PENDING_JOIN_CODE_KEY);
        setCurrentClubId(club.id);
        router.push(`/clubs/${club.id}`);
      } catch (e) {
        setJoinError(e instanceof Error ? e.message : 'Failed to join club.');
        setJoiningCode(false);
      }
    }
    autoJoin();
  }, [user, isRealUser, codeParam, clubLoading, joiningCode, setCurrentClubId, router]);

  if (clubLoading || joiningCode) return <main className="page"><p>Joining club…</p></main>;

  // Guest or signed out visitor clicking an invite link with ?code=XYZ
  if (!isRealUser && codeParam) {
    const redirectUrl = typeof window !== 'undefined' ? window.location.href : `/clubs/join?code=${codeParam}`;
    return (
      <main className="page">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>🎾 You&apos;ve Been Invited!</h1>
        <div className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 15 }}>
            You received a direct invite to join a Pickleball club (Code: <strong>{codeParam.toUpperCase()}</strong>).
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            Sign in with Google to join instantly — your real name, email, and photo will be synced automatically!
          </p>
          <div style={{ marginTop: 8 }}>
            <GoogleSignInButton redirectTo={redirectUrl} label="Sign in with Google to Join Instantly" />
          </div>
        </div>
      </main>
    );
  }

  // Generic guest or signed out user
  if (!isRealUser) {
    return (
      <main className="page">
        <Link href="/clubs" className="text-link-btn">← Clubs</Link>
        <h1>Join a Club</h1>
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
            Sign in with Google to join or request access to a club.
          </p>
          <GoogleSignInButton />
        </div>
      </main>
    );
  }

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
      {joinError && <p style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 8 }}>{joinError}</p>}
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
