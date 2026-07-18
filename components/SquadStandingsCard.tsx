import type { SquadSet } from '@/lib/squads';

const SQUAD_STANDING_COLORS = ['#d4af37', '#1a1a1a', '#2563eb', '#dc2626', '#059669', '#7c3aed'];

interface SquadStandingsCardProps {
  squads: SquadSet;
  totalsByTeam: Map<string, number>;
}

// N-squad (N>2) replacement for SquadVersusHero's fixed left-vs-right
// layout, which is fundamentally 2-sided and stays unchanged/untouched for
// N=2 sessions (see memory project_pickleball_n_squad_plan's Phase 0
// decision: preserve the versus-hero's visual identity for the common
// case, only N>2 sessions ever render this ranked-list view instead).
export default function SquadStandingsCard({ squads, totalsByTeam }: SquadStandingsCardProps) {
  const ranked = [...squads].sort((a, b) => (totalsByTeam.get(b.id) ?? 0) - (totalsByTeam.get(a.id) ?? 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 8px' }}>
      {ranked.map((squad, i) => {
        const color = SQUAD_STANDING_COLORS[squads.indexOf(squad) % SQUAD_STANDING_COLORS.length];
        return (
          <div
            key={squad.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2, rgba(127,127,127,0.08))' }}
          >
            <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--muted)', width: 20 }}>#{i + 1}</span>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {squad.logoUrl && (
              <img src={squad.logoUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{squad.label ?? squad.id}</span>
            <span style={{ fontWeight: 900, fontSize: 18 }}>{totalsByTeam.get(squad.id) ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}
