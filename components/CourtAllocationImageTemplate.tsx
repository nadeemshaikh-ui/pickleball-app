import React from 'react';
import type { RoundRow, SessionRow } from '@/lib/db';
import { formatLabel } from '@/lib/formatLabel';

export default function CourtAllocationImageTemplate({
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
  const courtLabels = session.court_labels || ['1', '2'];
  const roundsPerBlock = session.rounds_per_block || 6;
  const totalBlocks = Math.ceil(sortedRoundNumbers.length / roundsPerBlock);

  const blocks = [];
  for (let b = 1; b <= totalBlocks; b++) {
    const startRound = (b - 1) * roundsPerBlock + 1;
    const endRound = Math.min(b * roundsPerBlock, sortedRoundNumbers.length);
    const blockRounds = rounds.filter(r => r.round_number >= startRound && r.round_number <= endRound);

    const courtAllocations: { courtLabel: string; courtNumber: number; players: string[] }[] = [];

    courtLabels.forEach((label, idx) => {
      const courtNum = idx + 1;
      const parsedNum = parseInt(label, 10);
      const courtRounds = blockRounds.filter(r => r.court === courtNum || (!isNaN(parsedNum) && r.court === parsedNum));
      const courtPlayers = [...new Set(courtRounds.flatMap(r => [...(r.team_a || []), ...(r.team_b || []), ...(r.sitting_out || [])]))];

      courtAllocations.push({
        courtLabel: label,
        courtNumber: courtNum,
        players: courtPlayers
      });
    });

    blocks.push({
      blockIndex: b,
      startRound,
      endRound,
      courtAllocations
    });
  }

  return (
    <div style={{ width: 1600, background: '#e5fa00', padding: 48, fontFamily: 'var(--font-body), Arial, sans-serif' }}>
      {/* HEADER BANNER */}
      <div style={{ background: '#121a2f', color: '#e5fa00', padding: '36px 48px', border: '4px solid #121a2f' }}>
        {club && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
            {club.logo_url && (
              <img src={club.logo_url} alt="" width={80} height={80} crossOrigin="anonymous" style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #e5fa00' }} />
            )}
            <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 36, fontWeight: 900, letterSpacing: 1 }}>
              {club.name.toUpperCase()}
            </div>
          </div>
        )}
        {session.group_name && (
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 56, lineHeight: 1 }}>
            {session.group_name.toUpperCase()}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 72, lineHeight: 1.1, marginTop: 12 }}>
          HOURLY COURT & PLAYER GROUPINGS
        </div>
        <div style={{ fontSize: 30, marginTop: 16, color: '#ffffff', fontWeight: 700 }}>
          {new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: 36, marginTop: 24, fontSize: 28, flexWrap: 'wrap', fontWeight: 800 }}>
          <span>{session.players.length} PLAYERS</span>
          <span>•</span>
          <span>{courtLabels.length} COURTS</span>
          <span>•</span>
          <span>6 PLAYERS / COURT / HOUR</span>
          <span>•</span>
          <span>{formatLabel(session.format).toUpperCase()}</span>
        </div>
      </div>

      {/* COURT ALLOCATIONS BODY CARD */}
      <div style={{ background: '#ffffff', border: '4px solid #121a2f', borderTop: 'none', padding: 48 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(blocks.length, 2)}, 1fr)`, gap: 36 }}>
          {blocks.map(b => (
            <div
              key={b.blockIndex}
              style={{
                background: '#121a2f',
                color: '#ffffff',
                border: '4px solid #121a2f',
                borderRadius: 20,
                padding: 36
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '3px solid #e5fa00', paddingBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 36, fontWeight: 900, color: '#e5fa00' }}>
                  HOUR {b.blockIndex} (ROUNDS {b.startRound}–{b.endRound})
                </div>
                <span style={{ fontSize: 22, fontWeight: 900, background: '#e5fa00', color: '#121a2f', padding: '6px 18px', borderRadius: 10 }}>
                  SESSION {b.blockIndex}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {b.courtAllocations.map(c => (
                  <div
                    key={c.courtLabel}
                    style={{
                      background: '#1e293b',
                      border: '3px solid #334155',
                      borderRadius: 16,
                      padding: 24
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontSize: 26, fontWeight: 900, color: '#e5fa00', textTransform: 'uppercase' }}>
                        COURT {c.courtLabel} ROSTER
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#94a3b8' }}>
                        {c.players.length} Players Assigned
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                      {c.players.map(player => (
                        <span
                          key={player}
                          style={{
                            fontSize: 26,
                            fontWeight: 900,
                            background: '#ffffff',
                            color: '#0f172a',
                            padding: '10px 20px',
                            borderRadius: 10
                          }}
                        >
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER WATERMARK */}
        <div style={{ marginTop: 36, paddingTop: 24, borderTop: '3px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: 22, fontWeight: 800 }}>
          Generated by Hotshots Pickleball Atelier · Official Court Allocation Roster
        </div>
      </div>
    </div>
  );
}
