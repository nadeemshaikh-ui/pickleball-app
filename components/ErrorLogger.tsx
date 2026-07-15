'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { logClientError } from '@/lib/errorLog';

// Passive, always-on client error capture — mounted once in the root
// layout, no opt-in required (unlike DevModePanel, which only shows errors
// in the browser that hit them). Writes every uncaught error/rejection to
// app_error_log so a club admin or super admin can see what's actually
// breaking for real users, not just whoever happens to report it.
export default function ErrorLogger() {
  const pathname = usePathname();
  const { user, currentClubId } = useCurrentClub();

  useEffect(() => {
    function report(message: string, stack?: string) {
      logClientError({ clubId: currentClubId, userId: user?.id ?? null, message, stack, path: pathname });
    }
    const onError = (e: ErrorEvent) => report(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      report(String(reason?.message ?? reason ?? 'Unhandled rejection'), reason?.stack);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [pathname, user, currentClubId]);

  return null;
}
