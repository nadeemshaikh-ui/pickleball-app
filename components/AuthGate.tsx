'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasCompletedOnboarding } from '@/lib/onboarding';

// Side-effect-only: renders nothing, just redirects a signed-in user who
// hasn't finished onboarding yet to /onboarding. This component lives in
// the root layout, which persists across client-side navigation in the
// App Router, so its check runs once per full page load (including the
// full-page redirect Supabase's Google OAuth flow does on sign-in) — the
// onboarding flow itself navigates away when it's done, so there's no
// need to re-check mid-session.
export default function AuthGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked || pathname?.startsWith('/onboarding')) return;
    async function check() {
      const user = await getCurrentUser();
      if (!user) {
        setChecked(true);
        return;
      }
      const done = await hasCompletedOnboarding(user.id);
      setChecked(true);
      if (!done) router.replace('/onboarding');
    }
    check();
  }, [checked, pathname, router]);

  return null;
}
