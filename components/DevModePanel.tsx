'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isDevModeEnabled } from '@/lib/devMode';
import { useCurrentClub } from '@/lib/useCurrentClub';

interface CapturedError {
  message: string;
  at: string;
}

const MAX_ERRORS = 5;

// Floating debug panel — admin toggles it on in Club Settings ("Developer
// Mode"). Shows raw ids/role/route (for reporting bugs precisely) and the
// last few client-side errors, without needing devtools open. Off by
// default, per-browser (localStorage), not a server-side flag.
export default function DevModePanel() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<CapturedError[]>([]);
  const pathname = usePathname();
  const { user, currentClubId, currentClub, isCurrentClubAdmin } = useCurrentClub();

  useEffect(() => {
    setEnabled(isDevModeEnabled());
    const onChange = () => setEnabled(isDevModeEnabled());
    window.addEventListener('devModeChange', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('devModeChange', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function record(message: string) {
      setErrors(prev => [{ message, at: new Date().toLocaleTimeString() }, ...prev].slice(0, MAX_ERRORS));
    }
    const onError = (e: ErrorEvent) => record(e.message);
    const onRejection = (e: PromiseRejectionEvent) => record(String(e.reason?.message ?? e.reason ?? 'Unhandled rejection'));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div style={{ position: 'fixed', bottom: 70, right: 12, zIndex: 200, fontFamily: 'monospace' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle developer panel"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#1a1a1a',
          color: '#0f0',
          border: 'none',
          fontSize: 14,
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {'</>'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 44,
            right: 0,
            width: 280,
            maxHeight: 340,
            overflowY: 'auto',
            background: '#1a1a1a',
            color: '#0f0',
            fontSize: 11,
            padding: 10,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ marginBottom: 6, color: '#fff', fontWeight: 700 }}>Dev Panel</div>
          <div>route: {pathname}</div>
          <div>user_id: {user?.id ?? 'signed out'}</div>
          <div>club_id: {currentClubId ?? '—'}</div>
          <div>club: {currentClub?.name ?? '—'}</div>
          <div>role: {isCurrentClubAdmin ? 'admin' : 'member'}</div>
          <div style={{ marginTop: 8, color: '#fff', fontWeight: 700 }}>Recent errors ({errors.length})</div>
          {errors.length === 0 && <div style={{ color: '#888' }}>none captured</div>}
          {errors.map((e, i) => (
            <div key={i} style={{ color: '#f88', marginTop: 4, wordBreak: 'break-word' }}>
              [{e.at}] {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
