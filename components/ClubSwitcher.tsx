'use client';

import { useState } from 'react';
import { useCurrentClub } from '@/lib/useCurrentClub';
import ClubSwitchModal from './ClubSwitchModal';
import { Building2, ChevronDown } from 'lucide-react';

export default function ClubSwitcher() {
  const { currentClub, loading } = useCurrentClub();
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) return null;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px 4px' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: -0.5,
            color: 'var(--foreground, #0f172a)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {currentClub ? currentClub.name : 'Guest Play Mode'}
        </div>
      </div>

      <ClubSwitchModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
