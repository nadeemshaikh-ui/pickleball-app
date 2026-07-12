'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import SignInGate from '@/components/SignInGate';
import JoinClubStep from '@/components/onboarding/JoinClubStep';

export default function JoinClubPage() {
  const router = useRouter();
  const { setCurrentClubId, user, loading: clubLoading } = useCurrentClub();

  if (clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to join a club." />;

  return (
    <main className="page">
      <Link href="/clubs" className="text-link-btn">← Clubs</Link>
      <h1>Join a Club</h1>
      <div style={{ marginTop: 12 }}>
        <JoinClubStep
          onJoined={clubId => {
            setCurrentClubId(clubId);
            router.push('/setup');
          }}
        />
      </div>
    </main>
  );
}
