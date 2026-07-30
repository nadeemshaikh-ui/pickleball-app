'use client';

import { useCurrentClub } from '@/lib/useCurrentClub';

// Only renders once there's something to switch between — a single-club
// user (the common case for this app's current live group) sees nothing.
export default function ClubSwitcher() {
  const { clubs, currentClubId, setCurrentClubId, loading } = useCurrentClub();

  if (loading || clubs.length < 2) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px 0' }}>
      <select
        value={currentClubId ?? ''}
        onChange={e => {
          const newClubId = e.target.value;
          setCurrentClubId(newClubId);
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            if (currentPath.includes('/clubs/')) {
              const newPath = currentPath.replace(/\/clubs\/[^\/]+/, `/clubs/${newClubId}`);
              window.location.href = newPath;
            } else {
              window.location.reload();
            }
          }
        }}
        aria-label="Switch club"
        style={{ minHeight: 36, padding: '4px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
      >
        {clubs.map(m => (
          <option key={m.club_id} value={m.club_id}>
            {m.club.name}
          </option>
        ))}
      </select>
    </div>
  );
}
