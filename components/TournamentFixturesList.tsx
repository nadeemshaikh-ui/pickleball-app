import TeamVersusRow from './TeamVersusRow';
import type { TournamentMatchRow } from '@/lib/tournamentMatches';
import type { TournamentTeamRow } from '@/lib/tournamentTeams';

interface TournamentFixturesListProps {
  matches: TournamentMatchRow[];
  teams: TournamentTeamRow[];
  onScoreClick?: (match: TournamentMatchRow) => void;
}

function teamLabel(teamId: string | null, teams: TournamentTeamRow[]): string {
  if (!teamId) return 'TBD';
  return teams.find(t => t.id === teamId)?.name ?? 'Unknown';
}

function teamLogo(teamId: string | null, teams: TournamentTeamRow[]): string | null {
  if (!teamId) return null;
  return teams.find(t => t.id === teamId)?.logo_url ?? null;
}

// Fixtures list — upcoming/played matches with team logos left/right, time,
// grouped by group_label when the stage has groups. Reuses TeamVersusRow
// (the same component SquadVersusHero composes) rather than a copy-pasted
// two-sides layout.
export default function TournamentFixturesList({ matches, teams, onScoreClick }: TournamentFixturesListProps) {
  const groups = new Map<string | null, TournamentMatchRow[]>();
  for (const m of matches) {
    if (m.is_bye) continue; // byes resolve automatically, nothing for a spectator/scorer to see
    const key = m.group_label;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[...groups.entries()].map(([groupLabel, groupMatches]) => (
        <div key={groupLabel ?? 'all'}>
          {groupLabel && <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{groupLabel}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...groupMatches]
              .sort((a, b) => a.match_order - b.match_order)
              .map(m => (
                <div
                  key={m.id}
                  className="card"
                  style={{ padding: 12, cursor: onScoreClick ? 'pointer' : undefined }}
                  onClick={() => onScoreClick?.(m)}
                >
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textAlign: 'center' }}>
                    {m.round_label}
                    {m.scheduled_at ? ` · ${new Date(m.scheduled_at).toLocaleString()}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <TeamVersusRow label={teamLabel(m.team_a_id, teams)} logoUrl={teamLogo(m.team_a_id, teams)} score={m.score_a ?? undefined} />
                    <div style={{ fontWeight: 900, fontSize: 20, color: 'var(--muted)', flexShrink: 0, width: 40, textAlign: 'center' }}>VS</div>
                    <TeamVersusRow label={teamLabel(m.team_b_id, teams)} logoUrl={teamLogo(m.team_b_id, teams)} score={m.score_b ?? undefined} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
