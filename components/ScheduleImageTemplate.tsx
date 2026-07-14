import type { RoundRow, SessionRow } from '@/lib/db';
import { formatLabel } from '@/lib/formatLabel';
import { computeRoundTimeRange } from '@/lib/roundTiming';

export default function ScheduleImageTemplate({
  session,
  rounds,
  club,
}: {
  session: SessionRow;
  rounds: RoundRow[];
  club?: { name: string; logo_url: string | null } | null;
}) {
  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const courtLabels = session.court_labels;

  const cellStyle: React.CSSProperties = {
    border: '2px solid #121a2f',
    padding: '10px 12px',
    fontFamily: 'var(--font-body), Arial, sans-serif',
    fontSize: 20,
    verticalAlign: 'middle',
  };

  return (
    <div style={{ width: 1080, background: '#e5fa00', padding: 32, fontFamily: 'var(--font-body), Arial, sans-serif' }}>
      <div style={{ background: '#121a2f', color: '#e5fa00', padding: '24px 32px', border: '3px solid #121a2f' }}>
        {club && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            {club.logo_url && (
              <img src={club.logo_url} alt="" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5fa00' }} />
            )}
            <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: 0.5 }}>
              {club.name.toUpperCase()}
            </div>
          </div>
        )}
        {session.group_name && (
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 44, lineHeight: 1 }}>
            {session.group_name.toUpperCase()}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 64, lineHeight: 1.1, marginTop: 8 }}>
          TONIGHT&apos;S SCHEDULE
        </div>
        <div style={{ fontSize: 22, marginTop: 12, color: 'white' }}>
          {new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 16, fontSize: 22, flexWrap: 'wrap' }}>
          <span>{session.players.length} PLAYERS</span>
          <span>{courtLabels.length} COURT{courtLabels.length === 1 ? '' : 'S'}</span>
          <span>{sortedRoundNumbers.length} ROUNDS</span>
          {session.round_duration_minutes && <span>~{session.round_duration_minutes} MIN/ROUND</span>}
          <span>{formatLabel(session.format).toUpperCase()}</span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0, background: '#ffffff' }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 22 }}>
              {session.start_time && session.round_duration_minutes ? 'TIME' : 'ROUND'}
            </th>
            {courtLabels.map((label, i) => (
              <th
                key={i}
                style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 22 }}
              >
                COURT {label}
              </th>
            ))}
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 22 }}>
              SITTING
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRoundNumbers.map((roundNumber, rowIndex) => {
            const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
            const sittingNames = [...new Set(courts.flatMap(c => c.sitting_out))];
            const timeRange = computeRoundTimeRange(session.start_time, session.round_duration_minutes, roundNumber);
            return (
              <tr key={roundNumber} style={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f5f5dc' }}>
                <td style={{ ...cellStyle, fontFamily: 'var(--font-display), sans-serif', fontSize: timeRange ? 18 : 26, textAlign: 'center' }}>
                  {timeRange ?? `R${roundNumber}`}
                </td>
                {courtLabels.map((_, courtIndex) => {
                  const court = courts.find(c => c.court === courtIndex + 1);
                  return (
                    <td key={courtIndex} style={cellStyle}>
                      {court ? `${court.team_a.join(' & ')} vs ${court.team_b.join(' & ')}` : '—'}
                    </td>
                  );
                })}
                <td style={{ ...cellStyle, color: '#8a5a1f' }}>{sittingNames.join(', ') || '—'}</td>
              </tr>
            );
          })}
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
