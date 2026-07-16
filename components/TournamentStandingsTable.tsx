import type { StandingsRow } from '@/lib/tournamentStandings';

interface TournamentStandingsTableProps {
  standings: StandingsRow[];
  teamNames: Map<string, string>;
}

// P/W/L/PTS only — deliberately no Draw column. Pickleball is win-by-2
// scoring, there is always a winner, so a Draw column would be dead weight
// (and was an explicit correction during planning — don't reintroduce it).
export default function TournamentStandingsTable({ standings, teamNames }: TournamentStandingsTableProps) {
  const groups = new Map<string | null, StandingsRow[]>();
  for (const row of standings) {
    const key = row.groupLabel;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[...groups.entries()].map(([groupLabel, rows]) => (
        <div key={groupLabel ?? 'overall'}>
          {groupLabel && <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{groupLabel}</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Team</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>P</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>W</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>L</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>PTS</th>
              </tr>
            </thead>
            <tbody>
              {[...rows]
                .sort((a, b) => a.rank - b.rank)
                .map(row => (
                  <tr key={row.teamId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>
                      {row.rank}. {teamNames.get(row.teamId) ?? row.teamId}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{row.played}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{row.won}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{row.lost}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>{row.points}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
