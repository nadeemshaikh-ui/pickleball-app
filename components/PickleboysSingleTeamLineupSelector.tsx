'use client';

import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, Lock, AlertTriangle, ArrowRight } from 'lucide-react';

interface SingleTeamLineupSelectorProps {
  teamId: string;
  teamName: string;
  captain: string;
  roster: string[];
  opponentName: string;
  opponentCaptain: string;
  matchId: string;
  existingLineup?: {
    line1: [string, string];
    line2: [string, string];
    line3: [string, string];
    line4: [string, string];
  };
  onSaveLineup: (lineup: {
    line1: [string, string];
    line2: [string, string];
    line3: [string, string];
    line4: [string, string];
  }) => void;
}

export default function PickleboysSingleTeamLineupSelector({
  teamId,
  teamName,
  captain,
  roster,
  opponentName,
  opponentCaptain,
  matchId,
  existingLineup,
  onSaveLineup
}: SingleTeamLineupSelectorProps) {
  // Format player names with pool tags ([A1]..[A6] or [B1]..[B6])
  const getTaggedPlayer = (idx: number) => {
    const rawName = (roster[idx] || `Player ${idx + 1}`).replace(/\s*\([^)]*\)/g, '').trim();
    const tagNum = idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : idx === 3 ? 'G' : idx === 4 ? '5' : '6';
    return `[${teamId}${tagNum}] ${rawName}`;
  };

  const taggedRoster = roster.map((_, i) => getTaggedPlayer(i));

  // Default pairs if no existing lineup
  // Line 1: [1] & [2]
  // Line 2: [1] & [3]
  // Line 3: [3] & [G]
  // Line 4: [G] & [5]
  const [line1, setLine1] = useState<[string, string]>(existingLineup?.line1 || [taggedRoster[0], taggedRoster[1]]);
  const [line2, setLine2] = useState<[string, string]>(existingLineup?.line2 || [taggedRoster[0], taggedRoster[2]]);
  const [line3, setLine3] = useState<[string, string]>(existingLineup?.line3 || [taggedRoster[2], taggedRoster[3] || taggedRoster[0]]);
  const [line4, setLine4] = useState<[string, string]>(existingLineup?.line4 || [taggedRoster[3] || taggedRoster[0], taggedRoster[4] || taggedRoster[1]]);

  const [savedSuccess, setSavedSuccess] = useState(false);

  function handlePillTap(lineNum: 1 | 2 | 3 | 4, player: string) {
    const setter = lineNum === 1 ? setLine1 : lineNum === 2 ? setLine2 : lineNum === 3 ? setLine3 : setLine4;
    const current = lineNum === 1 ? line1 : lineNum === 2 ? line2 : lineNum === 3 ? line3 : line4;

    if (current.includes(player)) {
      // Unselect if already 2 selected
      if (current.length > 1) {
        setter([current.find(p => p !== player)!, ''] as [string, string]);
      }
    } else {
      if (!current[0] || current[0] === '') {
        setter([player, current[1]]);
      } else if (!current[1] || current[1] === '') {
        setter([current[0], player]);
      } else {
        // Swap out second player
        setter([current[0], player]);
      }
    }
  }

  function handleSave() {
    onSaveLineup({ line1, line2, line3, line4 });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  }

  const isComplete = line1[0] && line1[1] && line2[0] && line2[1] && line3[0] && line3[1] && line4[0] && line4[1];

  return (
    <div className="card" style={{ padding: 22, background: '#ffffff', border: '3px solid var(--dark)', boxShadow: '6px 6px 0 var(--border)' }}>
      <div style={{ borderBottom: '3px solid var(--border)', paddingBottom: 14, marginBottom: 18 }}>
        <span style={{ background: 'var(--dark)', color: '#ffffff', padding: '4px 10px', borderRadius: 2, fontSize: 12, fontWeight: 900 }}>
          SECRET LINEUP BUILDER · {teamName} ({teamId})
        </span>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: '8px 0 4px 0' }}>
          Set Your 4-Line Match Lineup
        </h2>
        <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
          Playing vs <strong>{opponentName}</strong> (Capt. {opponentCaptain}). Your choices remain secret until both lock!
        </div>
      </div>

      {savedSuccess && (
        <div style={{ background: '#dcfce7', border: '2px solid #166534', color: '#166534', padding: 12, borderRadius: 2, fontSize: 14, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} /> 🔒 Secret Lineup Locked & Saved for {teamName}!
        </div>
      )}

      {/* LINE SELECTOR BLOCKS 1 TO 4 */}
      {[1, 2, 3, 4].map(lineNum => {
        const activePair = lineNum === 1 ? line1 : lineNum === 2 ? line2 : lineNum === 3 ? line3 : line4;
        const lineTitle = lineNum === 1 ? 'LINE 1 (0–14 PTS)' : lineNum === 2 ? 'LINE 2 (15–29 PTS)' : lineNum === 3 ? 'LINE 3 (30–44 PTS)' : 'LINE 4 (45–51 PTS)';

        return (
          <div key={lineNum} style={{ background: '#f8fafc', padding: 16, border: '2px solid var(--border)', borderRadius: 4, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {lineTitle}
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary)' }}>
                Active Pair: {activePair.filter(Boolean).join(' & ') || 'Select 2 Players'}
              </span>
            </div>

            {/* 1-TAP PILL PLAYERS FOR THIS TEAM ONLY */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {taggedRoster.map(p => {
                const isSelected = activePair.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePillTap(lineNum as 1 | 2 | 3 | 4, p)}
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      padding: '8px 14px',
                      borderRadius: 2,
                      border: isSelected ? '2px solid var(--dark)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--dark)' : '#ffffff',
                      color: isSelected ? '#ffffff' : 'var(--foreground)',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '2px 2px 0 var(--gold)' : 'none'
                    }}
                  >
                    {isSelected ? '✓ ' : ''}{p}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        disabled={!isComplete}
        onClick={handleSave}
        className="btn-primary"
        style={{ width: '100%', minHeight: 50, fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Lock size={20} /> 🔒 Submit & Lock Secret Lineup for {teamName}
      </button>
    </div>
  );
}
