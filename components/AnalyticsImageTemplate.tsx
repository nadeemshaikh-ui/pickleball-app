import type { SessionRow } from '@/lib/db';
import type { SquadSet } from '@/lib/squads';
import type { PlayerMatchStats } from '@/lib/teamChampionship';

// Shareable version of the Analytics page — Tournament MVP, per-team MVPs,
// and the top of the player leaderboard. Same brand visual language as
// StageImageTemplate/ResultsImageTemplate.
export default function AnalyticsImageTemplate({
  session,
  teams,
  overallMVP,
  teamMVPs,
  topPlayers,
}: {
  session: SessionRow;
  teams: SquadSet;
  overallMVP: PlayerMatchStats | null;
  teamMVPs: Map<string, PlayerMatchStats | null>;
  topPlayers: PlayerMatchStats[];
}) {
  const cellStyle: React.CSSProperties = {
    border: '2px solid #121a2f',
    padding: '10px 14px',
    fontFamily: 'var(--font-body), Arial, sans-serif',
    fontSize: 18,
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
          PLAYER STATS &amp; MVP
        </div>
      </div>

      {overallMVP && (
        <div style={{ background: '#ffffff', border: '3px solid #121a2f', borderTop: 'none', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: '#555', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 }}>Tournament MVP</div>
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 44, marginTop: 4 }}>⭐ {overallMVP.name}</div>
          <div style={{ fontSize: 18, color: '#555', marginTop: 4 }}>
            {overallMVP.wins}-{overallMVP.losses} · {(overallMVP.winPct * 100).toFixed(0)}% win rate
          </div>
        </div>
      )}

      <div style={{ background: '#ffffff', border: '3px solid #121a2f', borderTop: 'none', padding: 20, display: 'flex', justifyContent: 'space-around' }}>
        {teams.map(t => {
          const mvp = teamMVPs.get(t.id);
          return (
            <div key={t.id} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#555', textTransform: 'uppercase', fontWeight: 700 }}>{t.label ?? t.id} MVP</div>
              <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 26, marginTop: 2 }}>{mvp ? mvp.name : '—'}</div>
              {mvp && <div style={{ fontSize: 14, color: '#555' }}>{mvp.wins}-{mvp.losses}</div>}
            </div>
          );
        })}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff' }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', textAlign: 'left', fontSize: 18 }}>#</th>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', textAlign: 'left', fontSize: 18 }}>PLAYER</th>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', textAlign: 'right', fontSize: 18 }}>W-L</th>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', textAlign: 'right', fontSize: 18 }}>WIN%</th>
          </tr>
        </thead>
        <tbody>
          {topPlayers.map((p, i) => (
            <tr key={p.name} style={{ background: i % 2 === 0 ? '#ffffff' : '#f5f5dc' }}>
              <td style={{ ...cellStyle, fontWeight: 700 }}>{i + 1}</td>
              <td style={{ ...cellStyle, fontWeight: 700 }}>{p.name}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{p.wins}-{p.losses}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{(p.winPct * 100).toFixed(0)}%</td>
            </tr>
          ))}
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
