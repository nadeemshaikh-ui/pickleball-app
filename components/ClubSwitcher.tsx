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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px 0' }}>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 700,
            border: '1.5px solid var(--border, #cbd5e1)',
            borderRadius: 20,
            background: 'var(--card-bg, #ffffff)',
            color: 'var(--foreground, #0f172a)',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          <Building2 size={15} style={{ color: '#2563eb' }} />
          <span>{currentClub ? currentClub.name : 'Guest Play Mode'}</span>
          <ChevronDown size={14} style={{ opacity: 0.6 }} />
        </button>
      </div>

      <ClubSwitchModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
