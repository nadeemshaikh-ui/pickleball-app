import type { RoundRow, SessionRow } from '@/lib/db';
import type { StageConfig } from '@/lib/teamChampionship';

// Same brand visual language as ScheduleImageTemplate, scoped to one Team
// Championship stage — real feedback: stage pairings need to share as an
// actual WhatsApp image, not a plain text message.
export default function StageImageTemplate({
  session,
  rounds,
  stage,
}: {
  session: SessionRow;
  rounds: RoundRow[];
  stage: StageConfig;
}) {
  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }
  const roundNumbers = Array.from({ length: stage.roundEnd - stage.roundStart + 1 }, (_, i) => stage.roundStart + i);
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
        {session.group_name && (
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 36, lineHeight: 1 }}>
            {session.group_name.toUpperCase()}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 64, lineHeight: 1.1, marginTop: 8 }}>
          {stage.stageLabel.toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 16, fontSize: 22, flexWrap: 'wrap' }}>
          <span>ROUNDS {stage.roundStart}–{stage.roundEnd}</span>
          <span>{stage.pointsPerWin} PT/WIN</span>
          <span>{courtLabels.length} COURT{courtLabels.length === 1 ? '' : 'S'}</span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0, background: '#ffffff' }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 22 }}>
              ROUND
            </th>
            {courtLabels.map((label, i) => (
              <th
                key={i}
                style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 22 }}
              >
                COURT {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roundNumbers.map((roundNumber, rowIndex) => {
            const courts = (byRound.get(roundNumber) ?? []).sort((a, b) => a.court - b.court);
            return (
              <tr key={roundNumber} style={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f5f5dc' }}>
                <td style={{ ...cellStyle, fontFamily: 'var(--font-display), sans-serif', fontSize: 26, textAlign: 'center' }}>
                  R{roundNumber}
                </td>
                {courtLabels.map((_, courtIndex) => {
                  const court = courts.find(c => c.court === courtIndex + 1);
                  return (
                    <td key={courtIndex} style={cellStyle}>
                      {court && court.team_a[0] ? `${court.team_a.join(' & ')} vs ${court.team_b.join(' & ')}` : '—'}
                    </td>
                  );
                })}
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
