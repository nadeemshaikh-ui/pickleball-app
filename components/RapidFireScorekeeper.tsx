'use client';

import React, { useState, useEffect } from 'react';
import { Undo2, AlertCircle, CheckCircle2, ArrowLeftRight, Trophy, Save, Edit3 } from 'lucide-react';

interface ActivePair {
  teamA: [string, string];
  teamB: [string, string];
}

interface RapidFireScorekeeperProps {
  matchId: string;
  teamAName: string;
  teamBName: string;
  teamARoster: string[];
  teamBRoster: string[];
  line1: ActivePair;
  line2: ActivePair;
  line3: ActivePair;
  line4?: ActivePair;
  onMatchComplete: (scoreA: number, scoreB: number, log: { point: number; team: 'A' | 'B' }[]) => void;
}

export default function RapidFireScorekeeper({
  matchId,
  teamAName,
  teamBName,
  teamARoster,
  teamBRoster,
  line1,
  line2,
  line3,
  line4 = { teamA: [teamARoster[5] || 'A6', teamARoster[0] || 'A1'], teamB: [teamBRoster[5] || 'B6', teamBRoster[0] || 'B1'] },
  onMatchComplete
}: RapidFireScorekeeperProps) {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  // String states for inputs to avoid sticky leading 0 bug!
  const [strScoreA, setStrScoreA] = useState('0');
  const [strScoreB, setStrScoreB] = useState('0');

  // Direct final match score entry state
  const [showDirectFinalEntry, setShowDirectFinalEntry] = useState(false);
  const [finalScoreAInput, setFinalScoreAInput] = useState('51');
  const [finalScoreBInput, setFinalScoreBInput] = useState('0');

  const [pointHistory, setPointHistory] = useState<{ point: number; team: 'A' | 'B' }[]>([]);

  // Line & Rule Acknowledgment States
  const [confirmedLine2, setConfirmedLine2] = useState(false); // 15 pts handoff
  const [confirmedSideChange25, setConfirmedSideChange25] = useState(false); // 25 pts side change
  const [confirmedLine3, setConfirmedLine3] = useState(false); // 30 pts handoff
  const [confirmedLine4, setConfirmedLine4] = useState(false); // 45 pts handoff (A6 + A1)

  // Sync string state when score changes via +1 or Undo buttons
  useEffect(() => {
    setStrScoreA(String(scoreA));
  }, [scoreA]);

  useEffect(() => {
    setStrScoreB(String(scoreB));
  }, [scoreB]);

  // Determine current active segment based on 15 / 30 / 45 / 51 milestones
  const firstTo15 = Math.max(scoreA, scoreB) >= 15;
  const firstTo25 = Math.max(scoreA, scoreB) >= 25;
  const firstTo30 = Math.max(scoreA, scoreB) >= 30;
  const firstTo45 = Math.max(scoreA, scoreB) >= 45;
  const firstTo51 = Math.max(scoreA, scoreB) >= 51;

  const currentSegment: 1 | 2 | 3 | 4 = !firstTo15 ? 1 : !firstTo30 ? 2 : !firstTo45 ? 3 : 4;
  const activePair = currentSegment === 1 ? line1 : currentSegment === 2 ? line2 : currentSegment === 3 ? line3 : line4;

  // Hard stop checks
  const isLine2Locked = firstTo15 && !confirmedLine2;
  const isSideChangeLocked = firstTo25 && !confirmedSideChange25;
  const isLine3Locked = firstTo30 && !confirmedLine3;
  const isLine4Locked = firstTo45 && !confirmedLine4;
  const isMatchLocked = firstTo51;
  const isGoldenPoint = scoreA === 50 && scoreB === 50;

  function addPoint(team: 'A' | 'B') {
    if (isLine2Locked || isSideChangeLocked || isLine3Locked || isLine4Locked || isMatchLocked) return;

    const nextA = team === 'A' ? scoreA + 1 : scoreA;
    const nextB = team === 'B' ? scoreB + 1 : scoreB;
    const totalPoints = pointHistory.length + 1;

    setScoreA(nextA);
    setScoreB(nextB);
    setPointHistory(prev => [...prev, { point: totalPoints, team }]);

    if (Math.max(nextA, nextB) >= 51) {
      onMatchComplete(nextA, nextB, [...pointHistory, { point: totalPoints, team }]);
    }
  }

  // Handle direct string input without forcing sticky leading 0!
  function handleDirectInputA(val: string) {
    setStrScoreA(val);
    if (val.trim() === '') {
      setScoreA(0);
      return;
    }
    const num = Math.max(0, Math.min(51, parseInt(val) || 0));
    setScoreA(num);
    if (Math.max(num, scoreB) >= 51) {
      onMatchComplete(num, scoreB, pointHistory);
    }
  }

  function handleDirectInputB(val: string) {
    setStrScoreB(val);
    if (val.trim() === '') {
      setScoreB(0);
      return;
    }
    const num = Math.max(0, Math.min(51, parseInt(val) || 0));
    setScoreB(num);
    if (Math.max(scoreA, num) >= 51) {
      onMatchComplete(scoreA, num, pointHistory);
    }
  }

  function handleUndo() {
    if (pointHistory.length === 0) return;
    const last = pointHistory[pointHistory.length - 1];
    setPointHistory(prev => prev.slice(0, -1));

    if (last.team === 'A') setScoreA(prev => Math.max(0, prev - 1));
    if (last.team === 'B') setScoreB(prev => Math.max(0, prev - 1));
  }

  function handleSaveFinalDirectScore() {
    const sA = Math.max(0, Math.min(51, parseInt(finalScoreAInput) || 0));
    const sB = Math.max(0, Math.min(51, parseInt(finalScoreBInput) || 0));
    onMatchComplete(sA, sB, pointHistory);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto' }}>
      {/* PROMINENT ACTIVE PLAYERS DISPLAY BANNER */}
      <div className="card" style={{ background: 'var(--dark)', color: '#ffffff', textAlign: 'center', padding: 18, border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)' }}>
          PLAYERS CURRENTLY ON COURT · LINE {currentSegment} OF 4 {currentSegment === 4 ? '(A6 + A1 FINISH)' : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 2 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 900, textTransform: 'uppercase' }}>{teamAName}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
              {activePair.teamA.join(' & ')}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 2 }}>
            <div style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 900, textTransform: 'uppercase' }}>{teamBName}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
              {activePair.teamB.join(' & ')}
            </div>
          </div>
        </div>
      </div>

      {/* 50-50 Golden Point Alert Banner */}
      {isGoldenPoint && (
        <div className="card" style={{ background: '#fef3c7', border: '3px solid #b45309', padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Trophy size={18} /> 50–50 TIE BREAKER
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#b45309', marginTop: 4 }}>
            SUDDEN DEATH GOLDEN POINT FOR THE WIN!
          </div>
        </div>
      )}

      {/* Main Score Display Box with DIRECT MANUAL SCORE INPUT BOXES */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
        {/* Team A Direct Input & Display */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>{teamAName}</div>
          <input
            type="number"
            value={strScoreA}
            onFocus={e => e.target.select()}
            onChange={e => handleDirectInputA(e.target.value)}
            style={{
              width: 100,
              padding: '6px',
              fontSize: 44,
              fontWeight: 900,
              textAlign: 'center',
              border: '2px solid var(--border)',
              borderRadius: 2,
              marginTop: 6,
              background: '#f8fafc'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--muted)' }}>VS</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Type or Tap +1</span>
        </div>

        {/* Team B Direct Input & Display */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>{teamBName}</div>
          <input
            type="number"
            value={strScoreB}
            onFocus={e => e.target.select()}
            onChange={e => handleDirectInputB(e.target.value)}
            style={{
              width: 100,
              padding: '6px',
              fontSize: 44,
              fontWeight: 900,
              textAlign: 'center',
              border: '2px solid var(--border)',
              borderRadius: 2,
              marginTop: 6,
              background: '#f8fafc'
            }}
          />
        </div>
      </div>

      {/* HARD STOP 1: Line 1 Complete at 15 Points */}
      {isLine2Locked && (
        <div className="card" style={{ background: '#fef3c7', border: '3px solid var(--border)', padding: 18, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#b45309', marginBottom: 6 }} />
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>LINE 1 COMPLETE (First to 15 Pts)!</h3>
          <p style={{ fontSize: 14, color: 'var(--foreground)', margin: '6px 0 14px 0', fontWeight: 700 }}>
            Call Line 2 Pairs onto court: <strong>{line2.teamA.join(' & ')}</strong> vs <strong>{line2.teamB.join(' & ')}</strong>
          </p>
          <button onClick={() => setConfirmedLine2(true)} className="btn-primary" style={{ width: '100%', fontSize: 16, minHeight: 44 }}>
            <CheckCircle2 size={18} style={{ marginRight: 8 }} /> Confirm Active Pair & Resume Scoring
          </button>
        </div>
      )}

      {/* HARD STOP 2: Rule 1 Side Change at 25 Points */}
      {isSideChangeLocked && !isLine2Locked && (
        <div className="card" style={{ background: '#e0f2fe', border: '3px solid #0284c7', padding: 18, textAlign: 'center' }}>
          <ArrowLeftRight size={32} style={{ color: '#0284c7', marginBottom: 6 }} />
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0369a1' }}>RULE 1: CHANGE SIDES (25 Points Reached)!</h3>
          <p style={{ fontSize: 14, color: 'var(--foreground)', margin: '6px 0 14px 0', fontWeight: 700 }}>
            Teams must change sides of the court now.
          </p>
          <button onClick={() => setConfirmedSideChange25(true)} className="btn-primary" style={{ width: '100%', fontSize: 16, minHeight: 44, background: '#0284c7', borderColor: '#0284c7' }}>
            <CheckCircle2 size={18} style={{ marginRight: 8 }} /> Confirm Side Change & Resume Play
          </button>
        </div>
      )}

      {/* HARD STOP 3: Line 2 Complete at 30 Points */}
      {isLine3Locked && !isSideChangeLocked && (
        <div className="card" style={{ background: '#fef3c7', border: '3px solid var(--border)', padding: 18, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#b45309', marginBottom: 6 }} />
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>LINE 2 COMPLETE (First to 30 Pts)!</h3>
          <p style={{ fontSize: 14, color: 'var(--foreground)', margin: '6px 0 14px 0', fontWeight: 700 }}>
            Call Line 3 Pairs onto court: <strong>{line3.teamA.join(' & ')}</strong> vs <strong>{line3.teamB.join(' & ')}</strong>
          </p>
          <button onClick={() => setConfirmedLine3(true)} className="btn-primary" style={{ width: '100%', fontSize: 16, minHeight: 44 }}>
            <CheckCircle2 size={18} style={{ marginRight: 8 }} /> Confirm Active Pair & Resume Segment
          </button>
        </div>
      )}

      {/* HARD STOP 4: Line 3 Complete at 45 Points (A6 + A1 Rotation Finish) */}
      {isLine4Locked && !isLine3Locked && (
        <div className="card" style={{ background: '#fef3c7', border: '3px solid var(--border)', padding: 18, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#b45309', marginBottom: 6 }} />
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>LINE 3 COMPLETE (45 Pts Reached)!</h3>
          <p style={{ fontSize: 14, color: 'var(--foreground)', margin: '6px 0 14px 0', fontWeight: 700 }}>
            Call Line 4 Finish Pairs onto court (A6 joined by A1):<br />
            <strong>{line4.teamA.join(' & ')}</strong> vs <strong>{line4.teamB.join(' & ')}</strong>
          </p>
          <button onClick={() => setConfirmedLine4(true)} className="btn-primary" style={{ width: '100%', fontSize: 16, minHeight: 44 }}>
            <CheckCircle2 size={18} style={{ marginRight: 8 }} /> Confirm A6 + A1 Rotation & Resume 51-Pt Finish
          </button>
        </div>
      )}

      {/* GIANT 1-TAP COUNTER BUTTONS */}
      {!isLine2Locked && !isSideChangeLocked && !isLine3Locked && !isLine4Locked && !isMatchLocked && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            onClick={() => addPoint('A')}
            className="btn-primary"
            style={{
              minHeight: 100,
              fontSize: 22,
              fontWeight: 900,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: 'var(--primary)'
            }}
          >
            <span>+1 POINT</span>
            <span style={{ fontSize: 14, opacity: 0.9 }}>{teamAName}</span>
          </button>

          <button
            onClick={() => addPoint('B')}
            className="btn-primary"
            style={{
              minHeight: 100,
              fontSize: 22,
              fontWeight: 900,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: 'var(--primary)'
            }}
          >
            <span>+1 POINT</span>
            <span style={{ fontSize: 14, opacity: 0.9 }}>{teamBName}</span>
          </button>
        </div>
      )}

      {/* Action Toolbar: 1-Tap Undo & Direct Final Score Entry Button */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleUndo}
          disabled={pointHistory.length === 0}
          className="btn-secondary"
          style={{ flex: 1, fontSize: 14, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Undo2 size={16} /> Undo Last Point
        </button>

        <button
          onClick={() => setShowDirectFinalEntry(!showDirectFinalEntry)}
          className="btn-secondary"
          style={{ flex: 1, fontSize: 14, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Edit3 size={16} /> Enter Final Match Score
        </button>
      </div>

      {/* DIRECT FINAL MATCH SCORE ENTRY BOX */}
      {showDirectFinalEntry && (
        <div className="card" style={{ padding: 16, background: '#ffffff', border: '2px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10, textAlign: 'center' }}>
            Direct Offline / Paper Score Entry
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>{teamAName} Final Score</label>
              <input
                type="number"
                value={finalScoreAInput}
                onChange={e => setFinalScoreAInput(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: 20, fontWeight: 900, textAlign: 'center', border: '2px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>{teamBName} Final Score</label>
              <input
                type="number"
                value={finalScoreBInput}
                onChange={e => setFinalScoreBInput(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: 20, fontWeight: 900, textAlign: 'center', border: '2px solid var(--border)' }}
              />
            </div>
          </div>

          <button onClick={handleSaveFinalDirectScore} className="btn-primary" style={{ width: '100%', fontSize: 15, minHeight: 40 }}>
            <Save size={16} style={{ marginRight: 6 }} /> Save & Complete Match
          </button>
        </div>
      )}
    </div>
  );
}
