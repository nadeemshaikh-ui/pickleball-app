'use client';

import { useCallback, useEffect, useState } from 'react';
import { listMyClubs, type ClubMembership } from './clubs';
import { getCurrentUser } from './auth';
import type { User } from '@supabase/supabase-js';

const STORAGE_KEY = 'currentClubId';

// The signed-in user's active club, persisted across visits. Falls back to
// the first club in their membership list if nothing's stored yet or the
// stored id no longer matches a club they belong to (e.g. they were
// removed). Returns user=null for a signed-out visitor — callers should
// show a sign-in gate in that case, not the empty-club-list messaging
// (an unauthenticated visitor and a signed-in zero-club member look
// identical to listMyClubs, which silently returns [] for both).
export function useCurrentClub() {
  const [clubs, setClubs] = useState<ClubMembership[]>([]);
  const [currentClubId, setCurrentClubIdState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (!currentUser) {
        setClubs([]);
        setCurrentClubIdState(null);
        return;
      }
      const memberships = await listMyClubs();
      setClubs(memberships);
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const stillValid = stored && memberships.some(m => m.club_id === stored);
      setCurrentClubIdState(stillValid ? stored : (memberships[0]?.club_id ?? null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function setCurrentClubId(clubId: string) {
    setCurrentClubIdState(clubId);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, clubId);
  }

  const currentMembership = clubs.find(m => m.club_id === currentClubId) ?? null;

  return {
    clubs,
    currentClubId,
    currentClub: currentMembership?.club ?? null,
    isCurrentClubAdmin: currentMembership?.role === 'admin',
    user,
    loading,
    setCurrentClubId,
    refresh,
  };
}
