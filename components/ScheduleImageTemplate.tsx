import React from 'react';
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
    border: '4px solid #121a2f',
    padding: '24px 32px',
    fontFamily: 'var(--font-body), Arial, sans-serif',
    fontSize: 32,
    fontWeight: 900,
    verticalAlign: 'middle',
    color: '#0f172a'
  };

  return (
    <div style={{ width: 1600, background: '#e5fa00', padding: 48, fontFamily: 'var(--font-body), Arial, sans-serif' }}>
      {/* BRAND HEADER */}
      <div style={{ background: '#121a2f', color: '#e5fa00', padding: '40px 48px', border: '5px solid #121a2f' }}>
        {club && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
            {club.logo_url && (
              <img src={club.logo_url} alt="" width={96} height={96} crossOrigin="anonymous" style={{ borderRadius: '50%', objectFit: 'cover', border: '4px solid #e5fa00' }} />
            )}
            <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 44, fontWeight: 900, letterSpacing: 1 }}>
              {club.name.toUpperCase()}
            </div>
          </div>
        )}
        {session.group_name && (
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 64, lineHeight: 1 }}>
            {session.group_name.toUpperCase()}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 96, lineHeight: 1.1, marginTop: 12, letterSpacing: '-0.02em' }}>
          OFFICIAL MATCH SCHEDULE
        </div>
        <div style={{ fontSize: 36, marginTop: 18, color: '#ffffff', fontWeight: 800 }}>
          {new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: 36, marginTop: 24, fontSize: 32, flexWrap: 'wrap', fontWeight: 900, color: '#e5fa00' }}>
          <span>{session.players.length} PLAYERS</span>
          <span>•</span>
          <span>{courtLabels.length} COURT{courtLabels.length === 1 ? '' : 'S'}</span>
          <span>•</span>
          <span>{sortedRoundNumbers.length} ROUNDS</span>
          {session.round_duration_minutes && (
            <>
              <span>•</span>
              <span>~{session.round_duration_minutes} MIN/ROUND</span>
            </>
          )}
          <span>•</span>
          <span>{formatLabel(session.format).toUpperCase()}</span>
        </div>
      </div>

      {/* SCHEDULE MATCH TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0, background: '#ffffff', border: '5px solid #121a2f', borderTop: 'none' }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 40, textAlign: 'center' }}>
              {session.start_time && session.round_duration_minutes ? 'TIME' : 'ROUND'}
            </th>
            {courtLabels.map((label, i) => (
              <th
                key={i}
                style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 40 }}
              >
                COURT {label}
              </th>
            ))}
            <th style={{ ...cellStyle, background: '#121a2f', color: '#e5fa00', fontFamily: 'var(--font-display), sans-serif', fontSize: 40 }}>
              SITTING OUT
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRoundNumbers.map((roundNumber, rowIndex) => {
            const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
            const sittingNames = [...new Set(courts.flatMap(c => c.sitting_out))];
            const timeRange = computeRoundTimeRange(session.start_time, session.round_duration_minutes, roundNumber);

            const roundsPerBlock = session.rounds_per_block || (sortedRoundNumbers.length % 5 === 0 && sortedRoundNumbers.length > 5 ? 5 : null);
            const isBlockHeader = roundsPerBlock ? (roundNumber - 1) % roundsPerBlock === 0 : false;
            const blockIndex = roundsPerBlock ? Math.floor((roundNumber - 1) / roundsPerBlock) + 1 : 1;
            const blockStartRound = roundsPerBlock ? (blockIndex - 1) * roundsPerBlock + 1 : 1;
            const blockEndRound = roundsPerBlock ? Math.min(blockIndex * roundsPerBlock, sortedRoundNumbers.length) : sortedRoundNumbers.length;

            return (
              <React.Fragment key={roundNumber}>
                {isBlockHeader && (
                  <tr>
                    <td
                      colSpan={courtLabels.length + 2}
                      style={{
                        background: '#121a2f',
                        color: '#e5fa00',
                        fontFamily: 'var(--font-display), sans-serif',
                        fontSize: 38,
                        fontWeight: 900,
                        textAlign: 'center',
                        padding: '24px 32px',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        border: '4px solid #121a2f',
                      }}
                    >
                      ★ SESSION {blockIndex} — ROUNDS {blockStartRound} TO {blockEndRound} ★
                    </td>
                  </tr>
                )}
                <tr style={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-display), sans-serif', fontSize: timeRange ? 30 : 36, textAlign: 'center', fontWeight: 900 }}>
                    {timeRange ?? `R${roundNumber}`}
                  </td>
                  {courtLabels.map((label, courtIndex) => {
                    const parsedNum = parseInt(label, 10);
                    const court = courts.find(c => c.court === courtIndex + 1 || (!isNaN(parsedNum) && c.court === parsedNum));
                    return (
                      <td key={courtIndex} style={{ ...cellStyle, fontSize: 32, fontWeight: 900 }}>
                        {court ? (
                          <span>
                            <strong style={{ color: '#0f172a' }}>{court.team_a.join(' & ')}</strong>
                            <span style={{ color: '#0284c7', margin: '0 12px', fontWeight: 900 }}>VS</span>
                            <strong style={{ color: '#0f172a' }}>{court.team_b.join(' & ')}</strong>
                          </span>
                        ) : '—'}
                      </td>
                    );
                  })}
                  <td style={{ ...cellStyle, color: '#8a5a1f', fontSize: 30, fontWeight: 800 }}>{sittingNames.join(', ') || '—'}</td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* FOOTER WATERMARK */}
      <div
        style={{
          background: '#121a2f',
          color: '#e5fa00',
          textAlign: 'center',
          padding: '28px 36px',
          fontFamily: 'var(--font-display), sans-serif',
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 1,
          border: '5px solid #121a2f',
          borderTop: 'none'
        }}
      >
        HOTSHOTS PICKLEBALL ATELIER · OFFICIAL TOURNAMENT SCHEDULE
      </div>
    </div>
  );
}
