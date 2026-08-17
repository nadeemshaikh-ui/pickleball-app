import React from 'react';
import type { RoundRow, SessionRow } from '@/lib/db';
import { Users, Clock, Shield } from 'lucide-react';

interface CourtBlockAllocationCardProps {
  session: SessionRow;
  rounds: RoundRow[];
}

export default function CourtBlockAllocationCard({ session, rounds }: CourtBlockAllocationCardProps) {
  if (!session || !rounds || rounds.length === 0) return null;

  const roundsPerBlock = session.rounds_per_block || 6;
  const courtLabels = session.court_labels || ['1', '2'];

  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }

  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const totalRounds = sortedRoundNumbers.length;
  const totalBlocks = Math.ceil(totalRounds / roundsPerBlock);

  const blocks = [];
  for (let b = 1; b <= totalBlocks; b++) {
    const startRound = (b - 1) * roundsPerBlock + 1;
    const endRound = Math.min(b * roundsPerBlock, totalRounds);

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
    <div style={{ marginTop: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#121a2f', color: '#e5fa00', padding: '12px 18px', borderRadius: 12, border: '2px solid #121a2f' }}>
        <Users size={22} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Court Allocation & Hourly Player Rosters
          </div>
          <div style={{ fontSize: 13, color: '#ffffff', opacity: 0.9 }}>
            Fixed 6 Players per Court per Hour/Session
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {blocks.map(b => (
          <div
            key={b.blockIndex}
            style={{
              background: '#ffffff',
              border: '2px solid #121a2f',
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 4px 12px rgba(18,26,47,0.06)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '2px solid #f1f5f9', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 900, color: '#121a2f' }}>
                <Clock size={16} />
                <span>HOUR {b.blockIndex} (Rounds {b.startRound}–{b.endRound})</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, background: '#121a2f', color: '#e5fa00', padding: '3px 10px', borderRadius: 10 }}>
                Session {b.blockIndex}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {b.courtAllocations.map(c => (
                <div
                  key={c.courtLabel}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#121a2f', textTransform: 'uppercase' }}>
                      COURT {c.courtLabel} ROSTER
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>
                      {c.players.length} Players
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {c.players.map(player => (
                      <span
                        key={player}
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          background: '#ffffff',
                          color: '#0f172a',
                          border: '1px solid #cbd5e1',
                          padding: '4px 10px',
                          borderRadius: 8
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
    </div>
  );
}
