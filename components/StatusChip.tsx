'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getOwnPlayer } from '@/lib/players';
import { fetchLifetimeLeaderboard, fetchStreaks } from '@/lib/leagueStats';
import { useCurrentClub } from '@/lib/useCurrentClub';

// Renders nothing if signed out, unregistered, or not yet ranked (below
// MIN_GAMES_FOR_RANKING) — a chip with no real data would just be noise.
export default function StatusChip() {
  const { currentClubId } = useCurrentClub();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!currentClubId) return;
    let cancelled = false;
    async function load() {
      const user = await getCurrentUser();
      if (!user) return;
      const player = await getOwnPlayer(currentClubId!, user.id);
      if (!player) return;
      const [leaderboard, streaks] = await Promise.all([fetchLifetimeLeaderboard(currentClubId!), fetchStreaks(currentClubId!)]);
      const rank = leaderboard.findIndex(p => p.name === player.name);
      const entry = rank >= 0 ? leaderboard[rank] : null;
      if (cancelled || !entry || entry.provisional) return;
      const streak = streaks.get(player.name) ?? 0;
      const parts = [`#${rank + 1} lifetime`];
      if (streak >= 2) parts.push(`🔥 ${streak}-streak`);
      setText(parts.join(' · '));
    }
    load().catch(() => setText(null));
    return () => {
      cancelled = true;
    };
  }, [currentClubId]);

  if (!text) return null;

  return (
    <div
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'white',
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 8,
      }}
    >
      {text}
    </div>
  );
}
