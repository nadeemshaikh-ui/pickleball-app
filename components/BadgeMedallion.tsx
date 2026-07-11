import type { Badge } from '@/lib/badges';

// Placeholder art: a tier-colored ring around the badge emoji, consistent
// sizing/shape across the catalog. Swap the emoji for real icon art later
// without touching call sites — this component is the only thing that
// needs to change.
const TIER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: '#cd7f32', // bronze
  2: '#c0c0c0', // silver
  3: '#d4af37', // gold
  4: '#b9f2ff', // platinum
};

export default function BadgeMedallion({ badge, size = 28 }: { badge: Badge; size?: number }) {
  const ringColor = badge.tier ? TIER_COLORS[badge.tier] : 'var(--border)';
  return (
    <span
      title={`${badge.label} — ${badge.description}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${ringColor}`,
        fontSize: size * 0.55,
        lineHeight: 1,
        background: 'var(--card-bg, transparent)',
      }}
    >
      {badge.emoji}
    </span>
  );
}
