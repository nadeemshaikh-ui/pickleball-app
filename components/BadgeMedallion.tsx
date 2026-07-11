import { useId } from 'react';
import type { Badge } from '@/lib/badges';

// Enamel-medallion art rendered as SVG — no external art asset needed.
// Vector, so it's crisp at any size, and the radial gradient + bevel rim +
// gloss highlight give it real depth instead of a flat colored ring.
// Swap this for licensed/commissioned icon art later without touching any
// call site — everything below is self-contained to this one component.
const TIER_GRADIENTS: Record<1 | 2 | 3 | 4, [string, string, string]> = {
  1: ['#f0b878', '#cd7f32', '#6b3d13'], // bronze
  2: ['#f5f5f5', '#b9bfc7', '#5a616b'], // silver
  3: ['#ffe9a8', '#d4af37', '#7a5a08'], // gold
  4: ['#e3fbff', '#5fd0e8', '#12586b'], // platinum — cyan jewel tone, not pale
};
const DEFAULT_GRADIENT: [string, string, string] = ['#dbe1f0', '#9aa5bd', '#454e61'];

export default function BadgeMedallion({ badge, size = 40 }: { badge: Badge; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const [light, mid, dark] = badge.tier ? TIER_GRADIENTS[badge.tier] : DEFAULT_GRADIENT;
  const r = 48;
  const c = 50;

  return (
    <span
      title={`${badge.label} — ${badge.description}`}
      style={{ display: 'inline-block', width: size, height: size, lineHeight: 0 }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={badge.label}>
        <defs>
          <radialGradient id={`face-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={light} />
            <stop offset="55%" stopColor={mid} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
          <linearGradient id={`rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={light} />
            <stop offset="50%" stopColor={dark} />
            <stop offset="100%" stopColor={mid} />
          </linearGradient>
          <filter id={`shadow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>

        <g filter={`url(#shadow-${uid})`}>
          <circle cx={c} cy={c} r={r} fill={`url(#rim-${uid})`} />
          <circle cx={c} cy={c} r={r - 5} fill={`url(#face-${uid})`} />
          <circle cx={c} cy={c} r={r - 5} fill="none" stroke={dark} strokeWidth="1.5" opacity="0.5" />
          {/* gloss highlight arc, top-left, for the 3D pop */}
          <path
            d={`M ${c - 30} ${c - 22} A 34 34 0 0 1 ${c + 10} ${c - 40}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.45"
          />
        </g>

        <text x={c} y={c + 8} textAnchor="middle" fontSize="42" style={{ filter: `url(#shadow-${uid})` }}>
          {badge.emoji}
        </text>
      </svg>
    </span>
  );
}
