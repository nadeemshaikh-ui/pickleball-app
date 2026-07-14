'use client';

import { useEffect, useState } from 'react';
import { getClubBranding } from '@/lib/clubs';

// Stamped onto every shared session/league image (schedule, results,
// leaderboard, ladder, stats, wrapped, storyline, analytics) so a screenshot
// dropped into a WhatsApp group always reads as "this club" at a glance,
// not a generic unbranded table. Self-fetches off clubId so it drops into
// any page's html2canvas capture ref with a single prop, regardless of
// whether that page already has club branding loaded elsewhere.
export default function ShareBrandedHeader({ clubId }: { clubId: string | null | undefined }) {
  const [branding, setBranding] = useState<{ name: string; logo_url: string | null } | null>(null);

  useEffect(() => {
    if (!clubId) return;
    getClubBranding(clubId).then(setBranding).catch(() => setBranding(null));
  }, [clubId]);

  if (!branding) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 2px 14px', marginBottom: 14, borderBottom: '3px solid var(--primary)' }}>
      {branding.logo_url && (
        <img
          src={branding.logo_url}
          alt=""
          width={48}
          height={48}
          style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', flexShrink: 0 }}
        />
      )}
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.3, lineHeight: 1.05 }}>{branding.name}</div>
    </div>
  );
}
