import TeamVersusRow from './TeamVersusRow';
import type { TournamentMatchRow } from '@/lib/tournamentMatches';
import type { TournamentTeamRow } from '@/lib/tournamentTeams';

interface DoubleEliminationBracketProps {
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

// Separate from TournamentBracketTree deliberately: that component's
// vertical-gap-doubles-every-round trick assumes a strict single-elim
// binary tree, which the losers bracket isn't (some rounds keep the same
// match count as the round before — "merge" rounds — rather than always
// halving). Three tracks instead: Winners Bracket, Losers Bracket, Grand
// Final, each a flat set of round-columns with a fixed gap.
function BracketTrack({ title, matches, teams, onScoreClick }: { title: string; matches: TournamentMatchRow[]; teams: TournamentTeamRow[]; onScoreClick?: (m: TournamentMatchRow) => void }) {
  if (matches.length === 0) return null;
  const rounds = new Map<number, TournamentMatchRow[]>();
  for (const m of matches) {
    const round = m.bracket_round ?? 0;
    (rounds.get(round) ?? rounds.set(round, []).get(round)!).push(m);
  }
  const roundNumbers = [...rounds.keys()].sort((a, b) => a - b);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 24, overflowX: 'auto', padding: '4px 0' }}>
        {roundNumbers.map(round => {
          const roundMatches = [...rounds.get(round)!].sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0));
          return (
            <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 180 }}>
              <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                {roundMatches[0]?.round_label ?? `Round ${round}`}
              </div>
              {roundMatches.map(m => (
                <div
                  key={m.id}
                  className="card"
                  style={{ padding: 10, cursor: onScoreClick && !m.is_bye ? 'pointer' : undefined }}
                  onClick={() => !m.is_bye && onScoreClick?.(m)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <TeamVersusRow label={teamLabel(m.team_a_id, teams)} logoUrl={teamLogo(m.team_a_id, teams)} score={m.score_a ?? undefined} />
                    <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--muted)', flexShrink: 0 }}>VS</div>
                    <TeamVersusRow label={teamLabel(m.team_b_id, teams)} logoUrl={teamLogo(m.team_b_id, teams)} score={m.score_b ?? undefined} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DoubleEliminationBracket({ matches, teams, onScoreClick }: DoubleEliminationBracketProps) {
  const winners = matches.filter(m => m.group_label === 'Winners Bracket');
  const losers = matches.filter(m => m.group_label === 'Losers Bracket');
  const grandFinal = matches.filter(m => m.group_label === 'Grand Final');

  return (
    <div>
      <BracketTrack title="Winners Bracket" matches={winners} teams={teams} onScoreClick={onScoreClick} />
      <BracketTrack title="Losers Bracket" matches={losers} teams={teams} onScoreClick={onScoreClick} />
      <BracketTrack title="Grand Final" matches={grandFinal} teams={teams} onScoreClick={onScoreClick} />
    </div>
  );
}
