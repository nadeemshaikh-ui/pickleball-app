'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { markOnboardingComplete, getInitialStep, type OnboardingStep } from '@/lib/onboarding';
import BranchStep from '@/components/onboarding/BranchStep';
import CreateClubStep from '@/components/onboarding/CreateClubStep';
import JoinClubStep from '@/components/onboarding/JoinClubStep';
import ProfileStep from '@/components/onboarding/ProfileStep';
import TourStep from '@/components/onboarding/TourStep';
import DoneStep from '@/components/onboarding/DoneStep';

// 5 dots: branch, the create/join sub-step, profile, tour, done — so filling
// in a club name or searching for one actually advances the bar instead of
// looking stuck on step 1.
const DOT_COUNT = 5;
function dotIndexFor(step: OnboardingStep): number {
  switch (step) {
    case 'branch': return 0;
    case 'create-club':
    case 'join-club': return 1;
    case 'profile': return 2;
    case 'tour': return 3;
    case 'done': return 4;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { clubs, currentClubId, setCurrentClubId, loading: clubLoading } = useCurrentClub();
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);

  // Decide the starting step once club membership has loaded. Someone who
  // already belongs to a club (closed the tab mid-wizard last time) skips
  // straight to the profile step instead of re-asking "new club or join?".
  useEffect(() => {
    if (clubLoading || step !== null) return;
    setStep(getInitialStep(clubs.length > 0));
    if (clubs.length > 0 && currentClubId) setActiveClubId(currentClubId);
  }, [clubLoading, clubs, currentClubId, step]);

  async function finish() {
    const user = await getCurrentUser();
    if (user) await markOnboardingComplete(user.id);
    router.push('/setup');
  }

  // Requesting to join doesn't grant a club yet — landing on /setup would
  // just dead-end them ("join or create a club"). Mark onboarding done and
  // send them to Home instead, which shows a persistent "request pending"
  // banner until an admin approves them.
  async function finishPendingRequest() {
    const user = await getCurrentUser();
    if (user) await markOnboardingComplete(user.id);
    router.push('/');
  }

  if (step === null) {
    return (
      <main className="page">
        <p>Loading…</p>
      </main>
    );
  }

  const currentDotIndex = dotIndexFor(step);

  return (
    <main className="page">
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 24,
              height: 6,
              borderRadius: 3,
              background: i <= currentDotIndex ? 'var(--primary)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {step === 'branch' && <BranchStep onPick={choice => setStep(choice === 'create' ? 'create-club' : 'join-club')} />}

      {step === 'create-club' && (
        <CreateClubStep
          onDone={clubId => {
            setCurrentClubId(clubId);
            setActiveClubId(clubId);
            setStep('profile');
          }}
        />
      )}

      {step === 'join-club' && (
        <JoinClubStep
          onJoined={clubId => {
            setCurrentClubId(clubId);
            setActiveClubId(clubId);
            setStep('profile');
          }}
          onRequestSent={finishPendingRequest}
        />
      )}

      {step === 'profile' && activeClubId && <ProfileStep clubId={activeClubId} onDone={() => setStep('tour')} />}

      {step === 'tour' && <TourStep onSkip={finish} onDone={() => setStep('done')} />}

      {step === 'done' && <DoneStep onFinish={finish} />}
    </main>
  );
}
