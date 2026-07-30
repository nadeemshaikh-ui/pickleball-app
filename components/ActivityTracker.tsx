'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { logActivity } from '@/lib/activityLogger';
import { useCurrentClub } from '@/lib/useCurrentClub';

export function ActivityTracker() {
  const pathname = usePathname();
  const { user, currentClubId } = useCurrentClub();
  const lastLoggedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastLoggedPath.current) return;
    lastLoggedPath.current = pathname;

    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'Guest');
    const userEmail = user?.email || null;

    logActivity({
      path: pathname,
      action: 'page_view',
      userId: user?.id || null,
      userEmail,
      userName,
      clubId: currentClubId || null,
    });
  }, [pathname, user, currentClubId]);

  return null;
}
