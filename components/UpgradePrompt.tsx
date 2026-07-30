'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, isAnonymousUser, signInWithGoogle } from '@/lib/auth';

const DISMISS_KEY = 'upgrade-prompt-dismissed-at';
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // re-show after 3 days, not every visit

// Soft nudge, not a gate — an anonymous user's circle sessions/stats work
// fine without this. Purpose is purely to prevent silent data loss: an
// anon auth.uid() is device-scoped, so clearing cookies or switching
// devices loses everything unless it's linked to a Google identity first.
// linkGoogleIdentity upgrades the SAME auth.uid() in place, so nothing
// needs to migrate — every existing circle/session/round stays owned by
// the same id after linking.
export default function UpgradePrompt() {
  const [visible, setVisible] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then(user => {
      if (cancelled || !isAnonymousUser(user)) return;
      const dismissedAt = typeof window !== 'undefined' ? localStorage.getItem(DISMISS_KEY) : null;
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_COOLDOWN_MS) return;
      setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function handleUpgrade() {
    setLinking(true);
    setError(null);
    try {
      await signInWithGoogle(typeof window !== 'undefined' ? window.location.href : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign in with Google.');
      setLinking(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        position: 'fixed',
        bottom: 88,
        left: 12,
        right: 12,
        zIndex: 40,
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Save your stats</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          You're playing as a guest — sign in with Google so your sessions survive a new device or a cleared browser.
        </p>
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, margin: '4px 0 0' }}>{error}</p>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={handleUpgrade} disabled={linking}>
          {linking ? 'Linking…' : 'Sign in with Google'}
        </button>
        <button className="text-link-btn" style={{ fontSize: 12 }} onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
