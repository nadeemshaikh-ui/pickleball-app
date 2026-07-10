'use client';

import { useCallback, useEffect, useState } from 'react';
import { listMyClubs, type ClubMembership } from './clubs';

const STORAGE_KEY = 'currentClubId';

// The signed-in user's active club, persisted across visits. Falls back to
// the first club in their membership list if nothing's stored yet or the
// stored id no longer matches a club they belong to (e.g. they were
// removed). Returns null clubs/loading=false for a signed-out or
// zero-club user — callers should route to /clubs in that case.
export function useCurrentClub() {
  const [clubs, setClubs] = useState<ClubMembership[]>([]);
  const [currentClubId, setCurrentClubIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
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
    loading,
    setCurrentClubId,
    refresh,
  };
}
