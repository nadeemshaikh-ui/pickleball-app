import type { SessionRow } from '@/lib/db';
import type { SquadSet } from '@/lib/squads';
import type { StageConfig } from '@/lib/teamChampionship';

// Same brand visual language as StageImageTemplate — the shareable version
// of the Standings page: leader banner + stage-by-stage points table.
export default function ResultsImageTemplate({
  session,
  teams,
  stageBreakdown,
  totalsByTeam,
  grandTotals,
  matchRecords,
  maxLeaguePoints,
  rapidFireBonus,
  leaderTeamId,
}: {
  session: SessionRow;
  teams: SquadSet;
  stageBreakdown: { stageLabel: string; totalsByTeam: Map<string, number> }[];
  totalsByTeam: Map<string, number>;
  grandTotals: Map<string, number>;
  matchRecords: Map<string, { wins: number; losses: number }>;
  maxLeaguePoints: number;
  rapidFireBonus: Map<string, number> | null;
  leaderTeamId: string | null;
}) {
  const cellStyle: React.CSSProperties = {
    border: '2px solid #121a2f',
    padding: '12px 14px',
    fontFamily: 'var(--font-body), Arial, sans-serif',
    fontSize: 20,
  };

  return (
    <div style={{ width: 1080, background: '#e5fa00', padding: 32, fontFamily: 'var(--font-body), Arial, sans-serif' }}>
      <div style={{ background: '#121a2f', color: '#e5fa00', padding: '24px 32px', border: '3px solid #121a2f' }}>
        {session.group_name && (
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 32, lineHeight: 1 }}>
            {session.group_name.toUpperCase()}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 56, lineHeight: 1.1, marginTop: 8 }}>
          FINAL STANDINGS
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '3px solid #121a2f', borderTop: 'none', padding: 24, display: 'flex', justifyContent: 'space-around' }}>
        {teams.map(t => {
          const record = matchRecords.get(t.id) ?? { wins: 0, losses: 0 };
          const isLeader = t.id === leaderTeamId;
          return (
            <div key={t.id} style={{ textAlign: 'center', opacity: isLeader ? 1 : 0.6 }}>
              <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 26 }}>{t.label ?? t.id}</div>
              <div style={{ fontSize: 18, color: '#555' }}>{record.wins}W – {record.losses}L</div>
              <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 44 }}>{grandTotals.get(t.id) ?? 0}</div>
              {isLeader && <div style={{ fontSize: 16, fontWeight: 700, color: '#d97706' }}>LEADING</div>}
            </div>
          );
        })}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0, background: '#ffffff' }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', textAlign: 'left', fontSize: 20 }}>
              STAGE
            </th>
            {teams.map(t => (
              <th key={t.id} style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', textAlign: 'right', fontSize: 20 }}>
                {(t.label ?? t.id).toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stageBreakdown.map((stage, i) => (
            <tr key={stage.stageLabel} style={{ background: i % 2 === 0 ? '#ffffff' : '#f5f5dc' }}>
              <td style={{ ...cellStyle, fontWeight: 700 }}>{stage.stageLabel}</td>
              {teams.map(t => (
                <td key={t.id} style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>{stage.totalsByTeam.get(t.id) ?? 0}</td>
              ))}
            </tr>
          ))}
          <tr style={{ background: '#f0f0f0', fontWeight: 800 }}>
            <td style={cellStyle}>League total (of {maxLeaguePoints})</td>
            {teams.map(t => (
              <td key={t.id} style={{ ...cellStyle, textAlign: 'right' }}>{totalsByTeam.get(t.id) ?? 0}</td>
            ))}
          </tr>
          {rapidFireBonus && (
            <tr style={{ background: '#f0f0f0', fontWeight: 800 }}>
              <td style={cellStyle}>Rapid Fire bonus</td>
              {teams.map(t => (
                <td key={t.id} style={{ ...cellStyle, textAlign: 'right' }}>{rapidFireBonus.get(t.id) ?? 0}</td>
              ))}
            </tr>
          )}
          <tr style={{ background: '#121a2f' }}>
            <td style={{ ...cellStyle, color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 24, border: '2px solid #121a2f' }}>TOTAL</td>
            {teams.map(t => (
              <td key={t.id} style={{ ...cellStyle, color: '#e5fa00', textAlign: 'right', fontFamily: 'var(--font-display), sans-serif', fontSize: 24, border: '2px solid #121a2f' }}>
                {grandTotals.get(t.id) ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div
        style={{
          background: '#121a2f',
          color: '#e5fa00',
          textAlign: 'center',
          padding: '16px 20px',
          fontFamily: 'var(--font-display), sans-serif',
          fontSize: 26,
          border: '3px solid #121a2f',
          borderTop: 'none',
        }}
      >
        GAME ON. HAVE FUN.
      </div>
    </div>
  );
}
