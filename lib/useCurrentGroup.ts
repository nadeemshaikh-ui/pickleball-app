'use client';

import { useCallback, useEffect, useState } from 'react';
import { listMyCircles, type CircleMembership } from './circles';
import { getCurrentUser } from './auth';
import type { User } from '@supabase/supabase-js';

const STORAGE_KEY = 'currentGroup'; // JSON: { type: 'club' | 'circle', id: string }

type CurrentGroup =
  | { type: 'club'; clubId: string }
  | { type: 'circle'; circleId: string }
  | { type: 'none' };

// A club-or-circle-agnostic sibling of useCurrentClub — deliberately NOT a
// replacement. useCurrentClub is consumed by 15+ existing club-only pages
// (dues, auctions, tournaments, badges, ladder — none of which have a
// circle equivalent yet); rewriting it in place would be a T3-blast-radius
// change to code that already works. This hook is for the few places that
// genuinely need to work with either: setup, and the session pages that
// read/write sessions.club_id vs sessions.circle_id.
//
// Circles carry no admin role (see 20260723000000_circles_schema.sql) —
// there is no isCurrentGroupAdmin here to mirror isCurrentClubAdmin; a
// circle member is always just a member.
export function useCurrentGroup() {
  const [circles, setCircles] = useState<CircleMembership[]>([]);
  const [current, setCurrent] = useState<CurrentGroup>({ type: 'none' });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (!currentUser) {
        setCircles([]);
        setCurrent({ type: 'none' });
        return;
      }
      const myCircles = await listMyCircles();
      setCircles(myCircles);

      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const parsed = stored ? (JSON.parse(stored) as CurrentGroup) : null;

      if (parsed?.type === 'circle' && myCircles.some(c => c.circle_id === parsed.circleId)) {
        setCurrent(parsed);
      } else if (parsed?.type === 'club') {
        // Trust a stored club choice at face value — useCurrentClub already
        // validates club membership independently; duplicating that check
        // here would mean listMyClubs() gets called from two hooks on the
        // same page.
        setCurrent(parsed);
      } else if (myCircles.length > 0) {
        setCurrent({ type: 'circle', circleId: myCircles[0].circle_id });
      } else {
        setCurrent({ type: 'none' });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function setCurrentGroup(group: CurrentGroup) {
    setCurrent(group);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(group));
  }

  return {
    circles,
    current,
    setCurrentGroup,
    user,
    loading,
    refresh,
  };
}
