'use client';

import { useRouter } from 'next/navigation';
import { Zap, Trophy, X } from 'lucide-react';

// Center nav button opens this instead of jumping straight to /setup —
// merges "New Session" and "New Tournament" into one entry point per
// explicit design decision (own nav slot each was 6 cramped tabs; this
// keeps 5 tabs and still gives both flows a full, distinctly-designed
// choice rather than burying one inside the other).
export default function NewActionSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start something new"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          width: '100%',
          padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Start Something New</span>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button
          onClick={() => go('/setup')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface-2, rgba(127,127,127,0.06))',
            textAlign: 'left',
          }}
        >
          <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={22} color="white" />
          </span>
          <span>
            <div style={{ fontWeight: 800, fontSize: 15 }}>New Session</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>A single club-night — Scramble, Squad Rivalry, King of the Court & more</div>
          </span>
        </button>

        <button
          onClick={() => go('/tournaments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface-2, rgba(127,127,127,0.06))',
            textAlign: 'left',
          }}
        >
          <span style={{ width: 44, height: 44, borderRadius: 12, background: '#b8860b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={22} color="white" />
          </span>
          <span>
            <div style={{ fontWeight: 800, fontSize: 15 }}>New Tournament</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Multi-stage event — Groups, Knockout, Double Elim & more</div>
          </span>
        </button>
      </div>
    </div>
  );
}
