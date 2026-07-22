'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser, signInAnonymously } from '@/lib/auth';
import { hasCompletedOnboarding } from '@/lib/onboarding';

// Side-effect-only: renders nothing. Two jobs:
// 1. Silent anon sign-in for a brand-new visitor with no session at all —
//    the "no form" entry point for circles/guest mode. A user who already
//    has a real (Google or prior-anon) session is left untouched.
// 2. Redirects a signed-in user who hasn't finished onboarding to
//    /onboarding — unchanged from before, now also covers fresh anon users.
// This component lives in the root layout, which persists across
// client-side navigation in the App Router, so its check runs once per full
// page load (including the full-page redirect Supabase's Google OAuth flow
// does on sign-in) — the onboarding flow itself navigates away when it's
// done, so there's no need to re-check mid-session.
export default function AuthGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked || pathname?.startsWith('/onboarding') || pathname?.startsWith('/login')) return;
    async function check() {
      let user = await getCurrentUser();
      if (!user) {
        await signInAnonymously();
        user = await getCurrentUser();
      }
      if (!user) {
        setChecked(true);
        return;
      }
      const done = await hasCompletedOnboarding(user.id);
      setChecked(true);
      if (!done) router.replace('/onboarding');
    }
    check().catch(() => setChecked(true));
  }, [checked, pathname, router]);

  return null;
}
