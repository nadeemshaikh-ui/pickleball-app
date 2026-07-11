import type { Badge } from '@/lib/badges';
import BadgeMedallion from './BadgeMedallion';

// Branded share card for a single badge — rendered off-screen or in a modal,
// then captured with renderElementToImage/shareCachedImage. Sized 4:5
// (Instagram-portrait-friendly) but reads fine as a WhatsApp image too.
export default function ShareableBadgeCard({ badge, playerName, photoUrl }: { badge: Badge; playerName: string; photoUrl: string | null }) {
  return (
    <div
      style={{
        width: 400,
        aspectRatio: '4 / 5',
        background: '#e5fa00',
        color: '#0b1220',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>
        Pickleball Session
      </div>

      {photoUrl ? (
        <img src={photoUrl} alt="" width={96} height={96} style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #0b1220' }} />
      ) : (
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: '#0b1220',
            color: '#e5fa00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 800,
          }}
        >
          {playerName.charAt(0).toUpperCase()}
        </div>
      )}

      <BadgeMedallion badge={badge} size={120} />

      <div style={{ fontSize: 26, fontWeight: 900, textAlign: 'center', lineHeight: 1.15 }}>{badge.label}</div>
      <div style={{ fontSize: 14, textAlign: 'center', opacity: 0.75, maxWidth: 280 }}>{badge.description}</div>

      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>{playerName}</div>
    </div>
  );
}
