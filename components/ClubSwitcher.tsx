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
          setCurrentClubId(e.target.value);
          window.location.href = '/setup';
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
