'use client';

import React, { useState } from 'react';
import { CheckCircle2, Users, Save, RotateCcw } from 'lucide-react';

interface TeamRosterInput {
  teamName: string;
  captain: string;
  players: string[];
}

export interface LineupHandoffs {
  line1: { teamA: [string, string]; teamB: [string, string] };
  line2: { teamA: [string, string]; teamB: [string, string] };
  line3: { teamA: [string, string]; teamB: [string, string] };
  line4: { teamA: [string, string]; teamB: [string, string] };
}

interface Props {
  teamA: TeamRosterInput;
  teamB: TeamRosterInput;
  onConfirmLineup?: (lineups: LineupHandoffs) => void;
}

export default function PickleboysDynamicLineupSelector({ teamA, teamB, onConfirmLineup }: Props) {
  // 1-TAP PILL SELECTION ORDER (NO DROPDOWNS!)
  const [selectedA, setSelectedA] = useState<string[]>([]);
  const [selectedB, setSelectedB] = useState<string[]>([]);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  function handleTapPlayerA(name: string) {
    if (selectedA.includes(name)) {
      setSelectedA(prev => prev.filter(p => p !== name));
    } else if (selectedA.length < 6) {
      setSelectedA(prev => [...prev, name]);
    }
    setSavedBanner(false);
  }

  function handleTapPlayerB(name: string) {
    if (selectedB.includes(name)) {
      setSelectedB(prev => prev.filter(p => p !== name));
    } else if (selectedB.length < 6) {
      setSelectedB(prev => [...prev, name]);
    }
    setSavedBanner(false);
  }

  function handleResetSelection() {
    setSelectedA([]);
    setSelectedB([]);
    setSavedBanner(false);
  }

  const isCompleteA = selectedA.length === 6;
  const isCompleteB = selectedB.length === 6;
  const isReady = isCompleteA && isCompleteB;

  function handleSaveLineup() {
    if (!isReady) return;
    setSavedBanner(true);
    if (onConfirmLineup) {
      onConfirmLineup({
        line1: { teamA: [selectedA[0], selectedA[1]], teamB: [selectedB[0], selectedB[1]] },
        line2: { teamA: [selectedA[2], selectedA[3]], teamB: [selectedB[2], selectedB[3]] },
        line3: { teamA: [selectedA[4], selectedA[5]], teamB: [selectedB[4], selectedB[5]] },
        line4: { teamA: [selectedA[5], selectedA[0]], teamB: [selectedB[5], selectedB[0]] },
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 750, margin: '0 auto' }}>
      {/* Spacious Header Card */}
      <div className="card" style={{ padding: 24, background: '#ffffff', border: '4px solid var(--border)', boxShadow: '6px 6px 0 var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              1-TAP PLAYER POSITION BUILDER
            </div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: 26, fontWeight: 900 }}>
              Set Lineup Order: {teamA.teamName} vs {teamB.teamName}
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: 15, color: 'var(--muted)', fontWeight: 600 }}>
              Tap players in exact playing order (A1 to A6 & B1 to B6). NO dropdowns needed.
            </p>
          </div>

          <button onClick={handleResetSelection} className="btn-secondary" style={{ fontSize: 14, padding: '8px 16px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={16} /> Reset Selections
          </button>
        </div>

        {savedBanner && (
          <div style={{ background: '#dcfce7', border: '2px solid #166534', color: '#166534', padding: 14, borderRadius: 2, marginTop: 16, fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={20} /> Lineup Successfully Saved for {teamA.teamName} vs {teamB.teamName}!
          </div>
        )}
      </div>

      {/* 1-TAP PILL SELECTION CARDS FOR TEAM A & TEAM B */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Team A Pill Selector */}
        <div className="card" style={{ padding: 22, background: '#ffffff', borderTop: '6px solid var(--primary)', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
            {teamA.teamName} (Capt. {teamA.captain})
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800, marginBottom: 14 }}>
            Selected: {selectedA.length} / 6 Players
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {teamA.players.map((p, idx) => {
              const selIdx = selectedA.indexOf(p);
              const isSelected = selIdx !== -1;
              return (
                <button
                  key={idx}
                  onClick={() => handleTapPlayerA(p)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 15,
                    fontWeight: 900,
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: isSelected ? '3px solid var(--primary)' : '2px solid var(--border)',
                    background: isSelected ? 'var(--primary)' : '#f8fafc',
                    color: isSelected ? '#ffffff' : 'var(--foreground)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: isSelected ? '2px 2px 0 var(--dark)' : 'none'
                  }}
                >
                  {isSelected && <span style={{ background: '#ffffff', color: 'var(--primary)', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>A{selIdx + 1}</span>}
                  <span>{p}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Team B Pill Selector */}
        <div className="card" style={{ padding: 22, background: '#ffffff', borderTop: '6px solid var(--dark)', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
            {teamB.teamName} (Capt. {teamB.captain})
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800, marginBottom: 14 }}>
            Selected: {selectedB.length} / 6 Players
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {teamB.players.map((p, idx) => {
              const selIdx = selectedB.indexOf(p);
              const isSelected = selIdx !== -1;
              return (
                <button
                  key={idx}
                  onClick={() => handleTapPlayerB(p)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 15,
                    fontWeight: 900,
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: isSelected ? '3px solid var(--dark)' : '2px solid var(--border)',
                    background: isSelected ? 'var(--dark)' : '#f8fafc',
                    color: isSelected ? '#ffffff' : 'var(--foreground)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: isSelected ? '2px 2px 0 var(--gold)' : 'none'
                  }}
                >
                  {isSelected && <span style={{ background: 'var(--gold)', color: '#ffffff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>B{selIdx + 1}</span>}
                  <span>{p}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONFIRM BUTTON */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleSaveLineup}
          disabled={!isReady}
          className="btn-primary"
          style={{ width: '100%', minHeight: 56, fontSize: 17, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Save size={20} /> Confirm & Save Lineup Setup
        </button>
      </div>

      {/* STRUCTURED TABLE DISPLAYING SELECTED LINEUP (A1: Name | B1: Name) */}
      <div className="card" style={{ padding: 20, background: '#ffffff' }}>
        <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 14px 0', borderBottom: '2px solid var(--border)', paddingBottom: 8 }}>
          Matched Player Roster Table
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px', fontWeight: 900, width: '15%' }}>Slot</th>
                <th style={{ padding: '10px', fontWeight: 900, width: '42.5%' }}>{teamA.teamName}</th>
                <th style={{ padding: '10px', fontWeight: 900, width: '42.5%' }}>{teamB.teamName}</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px', fontWeight: 900, color: 'var(--muted)' }}>
                    A{idx + 1} / B{idx + 1}
                  </td>
                  <td style={{ padding: '10px', fontWeight: 900, color: selectedA[idx] ? 'var(--foreground)' : 'var(--muted)' }}>
                    {selectedA[idx] ? `A${idx + 1}: ${selectedA[idx]}` : `[ Tap A${idx + 1} Player Above ]`}
                  </td>
                  <td style={{ padding: '10px', fontWeight: 900, color: selectedB[idx] ? 'var(--foreground)' : 'var(--muted)' }}>
                    {selectedB[idx] ? `B${idx + 1}: ${selectedB[idx]}` : `[ Tap B${idx + 1} Player Above ]`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={handleSaveLineup}
          disabled={!isReady}
          className="btn-primary"
          style={{ width: '100%', marginTop: 20, fontSize: 16, minHeight: 46, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Save size={18} /> Lock & Save Team Lineup
        </button>
      </div>
    </div>
  );
}
