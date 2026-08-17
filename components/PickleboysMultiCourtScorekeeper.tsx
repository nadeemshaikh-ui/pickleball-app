'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Trophy, AlertCircle, CheckCircle2, Save } from 'lucide-react';

interface TeamRoster {
  id: string;
  name: string;
  captain: string;
  roster: string[];
}

interface CourtMatch {
  id: string;
  round: number;
  court: number;
  teamA: TeamRoster;
  teamB: TeamRoster;
}

interface SavedLineup {
  line1: { teamA: [string, string]; teamB: [string, string] };
  line2: { teamA: [string, string]; teamB: [string, string] };
  line3: { teamA: [string, string]; teamB: [string, string] };
}

interface PickleboysMultiCourtScorekeeperProps {
  roundNumber: number;
  matches: CourtMatch[];
  savedLineups: Record<string, SavedLineup>;
  onSaveRoundScores: (scores: Record<string, { scoreA: number; scoreB: number }>) => void;
}

export default function PickleboysMultiCourtScorekeeper({
  roundNumber,
  matches,
  savedLineups,
  onSaveRoundScores
}: PickleboysMultiCourtScorekeeperProps) {
  // Store live numeric scores and string inputs for all 4 courts
  const [courtScores, setCourtScores] = useState<Record<string, { a: number; b: number; strA: string; strB: string }>>({});

  useEffect(() => {
    const initial: Record<string, { a: number; b: number; strA: string; strB: string }> = {};
    matches.forEach(m => {
      initial[m.id] = { a: 0, b: 0, strA: '0', strB: '0' };
    });
    setCourtScores(initial);
  }, [roundNumber, matches]);

  function handleAddPoint(matchId: string, team: 'A' | 'B') {
    setCourtScores(prev => {
      const current = prev[matchId] || { a: 0, b: 0, strA: '0', strB: '0' };
      const nextA = team === 'A' ? Math.min(51, current.a + 1) : current.a;
      const nextB = team === 'B' ? Math.min(51, current.b + 1) : current.b;
      return {
        ...prev,
        [matchId]: {
          a: nextA,
          b: nextB,
          strA: String(nextA),
          strB: String(nextB)
        }
      };
    });
  }

  function handleInputChange(matchId: string, team: 'A' | 'B', val: string) {
    setCourtScores(prev => {
      const current = prev[matchId] || { a: 0, b: 0, strA: '0', strB: '0' };
      if (team === 'A') {
        const num = val.trim() === '' ? 0 : Math.max(0, Math.min(51, parseInt(val) || 0));
        return { ...prev, [matchId]: { ...current, a: num, strA: val } };
      } else {
        const num = val.trim() === '' ? 0 : Math.max(0, Math.min(51, parseInt(val) || 0));
        return { ...prev, [matchId]: { ...current, b: num, strB: val } };
      }
    });
  }

  function handleSaveAll() {
    const payload: Record<string, { scoreA: number; scoreB: number }> = {};
    Object.entries(courtScores).forEach(([mId, s]) => {
      payload[mId] = { scoreA: s.a, scoreB: s.b };
    });
    onSaveRoundScores(payload);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Bar */}
      <div className="card" style={{ padding: 18, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Organizer Master Control Desk
          </div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: 22, fontWeight: 900 }}>
            Round {roundNumber} — Simultaneous 4-Court Live Scoring Console
          </h2>
        </div>

        <button onClick={handleSaveAll} className="btn-primary" style={{ fontSize: 15, padding: '10px 20px' }}>
          <Save size={16} style={{ marginRight: 6 }} /> Save All 4 Court Scores
        </button>
      </div>

      {/* 4-COURT SIMULTANEOUS SCORING MATRIX GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        {matches.map(m => {
          const s = courtScores[m.id] || { a: 0, b: 0, strA: '0', strB: '0' };
          const lineup = savedLineups[m.id];

          const firstTo15 = Math.max(s.a, s.b) >= 15;
          const firstTo25 = Math.max(s.a, s.b) >= 25;
          const firstTo30 = Math.max(s.a, s.b) >= 30;
          const isGolden = s.a === 50 && s.b === 50;

          const currentSeg = !firstTo15 ? 1 : !firstTo30 ? 2 : 3;
          const activePairs = lineup
            ? currentSeg === 1 ? lineup.line1 : currentSeg === 2 ? lineup.line2 : lineup.line3
            : { teamA: [m.teamA.roster[0], m.teamA.roster[1]], teamB: [m.teamB.roster[0], m.teamB.roster[1]] };

          return (
            <div key={m.id} className="card" style={{ padding: 18, background: '#ffffff', borderTop: '6px solid var(--dark)', boxShadow: '4px 4px 0 var(--border)' }}>
              {/* Court Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase' }}>
                  COURT {m.court}
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, background: 'var(--dark)', color: '#ffffff', padding: '2px 8px', borderRadius: 2 }}>
                  MATCH #{m.id.replace('m', '')}
                </span>
              </div>

              {/* Active Pair Banner */}
              <div style={{ background: '#f8fafc', padding: 8, borderRadius: 2, marginBottom: 12, fontSize: 12, fontWeight: 800, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10 }}>LINE {currentSeg} ACTIVE PAIRS</div>
                <div style={{ marginTop: 2 }}>{activePairs.teamA.join(' & ')} vs {activePairs.teamB.join(' & ')}</div>
              </div>

              {/* Live Alerts (25pt Side Change / Golden Point) */}
              {isGolden && (
                <div style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: 2, fontSize: 11, fontWeight: 900, textAlign: 'center', marginBottom: 10 }}>
                  <Trophy size={12} style={{ display: 'inline', marginRight: 4 }} /> 50–50 GOLDEN POINT!
                </div>
              )}
              {firstTo25 && !firstTo30 && (
                <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 2, fontSize: 11, fontWeight: 900, textAlign: 'center', marginBottom: 10 }}>
                  <ArrowLeftRight size={12} style={{ display: 'inline', marginRight: 4 }} /> CHANGE SIDES (25 Pts Reached)
                </div>
              )}

              {/* Side-by-side Score Inputs & +1 Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {/* Team A Score Column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#f8fafc', padding: 10, border: '2px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textAlign: 'center' }}>{m.teamA.name}</div>
                  <input
                    type="number"
                    value={s.strA}
                    onFocus={e => e.target.select()}
                    onChange={e => handleInputChange(m.id, 'A', e.target.value)}
                    style={{ width: 70, padding: '4px', fontSize: 32, fontWeight: 900, textAlign: 'center', border: '2px solid var(--border)' }}
                  />
                  <button onClick={() => handleAddPoint(m.id, 'A')} className="btn-primary" style={{ width: '100%', fontSize: 14, minHeight: 36 }}>
                    +1 Point
                  </button>
                </div>

                {/* Team B Score Column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#f8fafc', padding: 10, border: '2px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, textAlign: 'center' }}>{m.teamB.name}</div>
                  <input
                    type="number"
                    value={s.strB}
                    onFocus={e => e.target.select()}
                    onChange={e => handleInputChange(m.id, 'B', e.target.value)}
                    style={{ width: 70, padding: '4px', fontSize: 32, fontWeight: 900, textAlign: 'center', border: '2px solid var(--border)' }}
                  />
                  <button onClick={() => handleAddPoint(m.id, 'B')} className="btn-primary" style={{ width: '100%', fontSize: 14, minHeight: 36 }}>
                    +1 Point
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={handleSaveAll} className="btn-primary" style={{ width: '100%', fontSize: 17, minHeight: 48 }}>
        <CheckCircle2 size={18} style={{ marginRight: 8 }} /> Save All Round {roundNumber} Scores
      </button>
    </div>
  );
}
