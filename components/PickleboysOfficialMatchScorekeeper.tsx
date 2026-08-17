'use client';

import React, { useState, useEffect } from 'react';
import { Undo2, Trophy, ArrowLeft, Save, ShieldCheck, Clock, Users, ArrowLeftRight, CheckCircle2, RotateCcw, Lock, Pause } from 'lucide-react';

interface ActivePair {
  teamA: [string, string];
  teamB: [string, string];
}

interface PickleboysOfficialMatchScorekeeperProps {
  matchId: string;
  roundNumber: number;
  courtNumber: number;
  teamAName: string;
  teamBName: string;
  teamARoster: string[];
  teamBRoster: string[];
  lineup?: {
    line1: ActivePair;
    line2: ActivePair;
    line3: ActivePair;
    line4: ActivePair;
  };
  onBack: () => void;
  onLockLineupRequest?: () => void;
  onMatchComplete: (scoreA: number, scoreB: number, history: { point: number; team: 'A' | 'B' }[]) => void;
}

export default function PickleboysOfficialMatchScorekeeper({
  matchId,
  roundNumber,
  courtNumber,
  teamAName,
  teamBName,
  teamARoster,
  teamBRoster,
  lineup,
  onBack,
  onLockLineupRequest,
  onMatchComplete
}: PickleboysOfficialMatchScorekeeperProps) {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [strScoreA, setStrScoreA] = useState('0');
  const [strScoreB, setStrScoreB] = useState('0');

  const [history, setHistory] = useState<{ point: number; team: 'A' | 'B' }[]>([]);
  const [isCompletedState, setIsCompletedState] = useState<boolean>(false);

  // Track acknowledged 15-point player rotations to pause scoring until confirmed
  const [acknowledgedRotations, setAcknowledgedRotations] = useState<number[]>([]);

  // 🛡️ ZERO DATA LOSS PROTECTION: Load cached live score on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && matchId) {
      const cacheKey = `pickleboys_live_score_${matchId}`;
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.scoreA === 'number') setScoreA(parsed.scoreA);
          if (typeof parsed.scoreB === 'number') setScoreB(parsed.scoreB);
          if (Array.isArray(parsed.history)) setHistory(parsed.history);
          if (Array.isArray(parsed.acknowledgedRotations)) setAcknowledgedRotations(parsed.acknowledgedRotations);
        } catch (e) {
          console.error('Failed to parse cached live match score:', e);
        }
      }
    }
  }, [matchId]);

  // 🛡️ ZERO DATA LOSS PROTECTION: Save live score to localStorage on every point change
  useEffect(() => {
    if (typeof window !== 'undefined' && matchId && (scoreA > 0 || scoreB > 0 || history.length > 0)) {
      const cacheKey = `pickleboys_live_score_${matchId}`;
      localStorage.setItem(cacheKey, JSON.stringify({ scoreA, scoreB, history, acknowledgedRotations }));
    }
  }, [matchId, scoreA, scoreB, history, acknowledgedRotations]);

  // 🛡️ ACCIDENTAL BACK BUTTON GUARD: Prompt beforeunload if active match is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((scoreA > 0 || scoreB > 0) && !isCompletedState) {
        e.preventDefault();
        e.returnValue = 'Scoring in progress on Court. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [scoreA, scoreB, isCompletedState]);

  // Helper to format player names with exact pool tags ([A1]..[A6] and [B1]..[B6])
  const formatTag = (isTeamA: boolean, idx: number, name: string) => {
    const rawName = name.replace(/\s*\([^)]*\)/g, '').trim();
    const tagPrefix = isTeamA ? 'A' : 'B';
    const tagNum = idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : idx === 3 ? 'G' : idx === 4 ? '5' : '6';
    const fullTag = `[${tagPrefix}${tagNum}]`;
    return `${fullTag} ${rawName}`;
  };

  // Default fallback 1-player rotation pairs if lineup not custom-locked
  // LINE 1 (0–14 pts): [1] & [2]
  // LINE 2 (15–29 pts): [1] & [3]  (Player 2 steps off for Player 3)
  // LINE 3 (30–44 pts): [3] & [G]  (Player 1 steps off for Pool G)
  // LINE 4 (45–51 pts): [G] & [5]  (Player 3 steps off for Pool 2)
  const defaultLine1: ActivePair = {
    teamA: [formatTag(true, 0, teamARoster[0] || 'Player 1'), formatTag(true, 1, teamARoster[1] || 'Player 2')],
    teamB: [formatTag(false, 0, teamBRoster[0] || 'Player 1'), formatTag(false, 1, teamBRoster[1] || 'Player 2')]
  };

  const defaultLine2: ActivePair = {
    teamA: [formatTag(true, 0, teamARoster[0] || 'Player 1'), formatTag(true, 2, teamARoster[2] || 'Player 3')],
    teamB: [formatTag(false, 0, teamBRoster[0] || 'Player 1'), formatTag(false, 2, teamBRoster[2] || 'Player 3')]
  };

  const defaultLine3: ActivePair = {
    teamA: [formatTag(true, 2, teamARoster[2] || 'Player 3'), formatTag(true, 3, teamARoster[3] || 'Pool G')],
    teamB: [formatTag(false, 2, teamBRoster[2] || 'Player 3'), formatTag(false, 3, teamBRoster[3] || 'Pool G')]
  };

  const defaultLine4: ActivePair = {
    teamA: [formatTag(true, 3, teamARoster[3] || 'Pool G'), formatTag(true, 4, teamARoster[4] || 'Pool 2')],
    teamB: [formatTag(false, 3, teamBRoster[3] || 'Pool G'), formatTag(false, 4, teamBRoster[4] || 'Pool 2')]
  };

  const l1 = lineup?.line1 || defaultLine1;
  const l2 = lineup?.line2 || defaultLine2;
  const l3 = lineup?.line3 || defaultLine3;
  const l4 = lineup?.line4 || defaultLine4;

  useEffect(() => {
    setStrScoreA(String(scoreA));
  }, [scoreA]);

  useEffect(() => {
    setStrScoreB(String(scoreB));
  }, [scoreB]);

  // COMBINED TOTAL POINTS SCORED BETWEEN THE 2 TEAMS
  const totalCombinedPoints = scoreA + scoreB;

  // STRICT TOURNAMENT RULE: Hard lock rotation pause at EVERY MULTIPLE OF 15 COMBINED POINTS (15, 30, 45, 60, 75, 90)
  const currentRotationThreshold = totalCombinedPoints >= 15 ? Math.floor(totalCombinedPoints / 15) * 15 : 0;
  const isRotationPaused = currentRotationThreshold > 0 && !acknowledgedRotations.includes(currentRotationThreshold);

  // AUTOMATIC SEAMLESS ROTATION (Line 1: 0-14, Line 2: 15-29, Line 3: 30-44, Line 4: 45+)
  const segmentIdx = Math.min(3, Math.floor(totalCombinedPoints / 15));
  const currentSegment: 1 | 2 | 3 | 4 = (segmentIdx + 1) as 1 | 2 | 3 | 4;
  const activePair = currentSegment === 1 ? l1 : currentSegment === 2 ? l2 : currentSegment === 3 ? l3 : l4;
  const upcomingPair = currentSegment === 1 ? l2 : currentSegment === 2 ? l3 : currentSegment === 3 ? l4 : null;
  const previousPair = currentSegment === 2 ? l1 : currentSegment === 3 ? l2 : currentSegment === 4 ? l3 : null;

  // Find exact stepping off and entering players for 1-player substitution
  const getSubDetails = (prev: [string, string], curr: [string, string]) => {
    const staying = prev.find(p => curr.includes(p)) || prev[0];
    const steppingOff = prev.find(p => !curr.includes(p)) || prev[1];
    const entering = curr.find(p => !prev.includes(p)) || curr[1];
    return { staying, steppingOff, entering };
  };

  const subA = previousPair ? getSubDetails(previousPair.teamA, activePair.teamA) : null;
  const subB = previousPair ? getSubDetails(previousPair.teamB, activePair.teamB) : null;

  const isMatchFinished = scoreA >= 51 || scoreB >= 51 || isCompletedState;
  const winnerName = scoreA >= 51 ? teamAName : scoreB >= 51 ? teamBName : scoreA > scoreB ? teamAName : teamBName;
  const isGoldenPoint = scoreA === 50 && scoreB === 50;
  const isSideChange = totalCombinedPoints >= 25 && totalCombinedPoints < 30;

  function handleConfirmRotation() {
    if (currentRotationThreshold > 0 && !acknowledgedRotations.includes(currentRotationThreshold)) {
      setAcknowledgedRotations(prev => [...prev, currentRotationThreshold]);
    }
  }

  function handleAddPoint(team: 'A' | 'B') {
    if (isMatchFinished || isRotationPaused) return;

    const nextA = team === 'A' ? scoreA + 1 : scoreA;
    const nextB = team === 'B' ? scoreB + 1 : scoreB;
    const pointNum = history.length + 1;

    setScoreA(nextA);
    setScoreB(nextB);
    setHistory(prev => [...prev, { point: pointNum, team }]);

    if (nextA >= 51 || nextB >= 51) {
      setIsCompletedState(true);
      onMatchComplete(nextA, nextB, [...history, { point: pointNum, team }]);
    }
  }

  function handleUndoSpecificTeam(team: 'A' | 'B') {
    setIsCompletedState(false);
    const teamHistory = history.filter(x => x.team === team);
    if (teamHistory.length === 0) {
      if (team === 'A') setScoreA(prev => Math.max(0, prev - 1));
      else setScoreB(prev => Math.max(0, prev - 1));
      return;
    }

    const maxPoint = Math.max(...teamHistory.map(x => x.point));
    setHistory(prev => prev.filter(h => !(h.team === team && h.point === maxPoint)));

    const newA = team === 'A' ? Math.max(0, scoreA - 1) : scoreA;
    const newB = team === 'B' ? Math.max(0, scoreB - 1) : scoreB;
    const nextCombined = newA + newB;
    setAcknowledgedRotations(prev => prev.filter(r => r <= nextCombined));

    if (team === 'A') {
      setScoreA(newA);
    } else {
      setScoreB(newB);
    }
  }

  function handleDirectInputA(val: string) {
    setStrScoreA(val);
    if (val.trim() === '') {
      setScoreA(0);
      return;
    }
    let num = Math.max(0, Math.min(51, parseInt(val) || 0));
    // STRICT RULE: Both teams cannot be 51! If Team A is set to 51 and Team B is 51, Team B must be adjusted < 51.
    let finalB = scoreB;
    if (num === 51 && scoreB === 51) {
      finalB = 50;
      setScoreB(50);
      setStrScoreB('50');
    }
    setScoreA(num);
    if (num >= 51 || finalB >= 51) {
      setIsCompletedState(true);
      onMatchComplete(num, finalB, history);
    }
  }

  function handleDirectInputB(val: string) {
    setStrScoreB(val);
    if (val.trim() === '') {
      setScoreB(0);
      return;
    }
    let num = Math.max(0, Math.min(51, parseInt(val) || 0));
    // STRICT RULE: Both teams cannot be 51! If Team B is set to 51 and Team A is 51, Team A must be adjusted < 51.
    let finalA = scoreA;
    if (num === 51 && scoreA === 51) {
      finalA = 50;
      setScoreA(50);
      setStrScoreA('50');
    }
    setScoreB(num);
    if (finalA >= 51 || num >= 51) {
      setIsCompletedState(true);
      onMatchComplete(finalA, num, history);
    }
  }

  // MATCH WINNER CELEBRATION & FULL SUMMARY BREAKDOWN SCREEN
  if (isCompletedState) {
    return (
      <div className="card" style={{ maxWidth: 700, margin: '0 auto', padding: 24, background: '#ffffff', border: '4px solid var(--dark)', boxShadow: '8px 8px 0 var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Trophy size={54} style={{ color: 'var(--gold)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.08em' }}>
            OFFICIAL MATCH SUMMARY · ROUND {roundNumber} COURT {courtNumber}
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--foreground)', margin: '6px 0' }}>
            🎉 {winnerName} VICTORIOUS!
          </h1>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>
            Match Completed at 51 Points Rapid-Fire Format
          </div>
        </div>

        {/* Final Score Banner */}
        <div style={{ background: '#f8fafc', border: '3px solid var(--border)', padding: 20, borderRadius: 4, display: 'flex', justifyContent: 'space-around', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: scoreA > scoreB ? '#166534' : 'var(--foreground)' }}>
              {teamAName} {scoreA > scoreB ? '🏆' : ''}
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, color: scoreA > scoreB ? '#166534' : 'var(--foreground)', marginTop: 4 }}>
              {scoreA}
            </div>
          </div>

          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--muted)' }}>VS</div>

          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: scoreB > scoreA ? '#166534' : 'var(--foreground)' }}>
              {teamBName} {scoreB > scoreA ? '🏆' : ''}
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, color: scoreB > scoreA ? '#166534' : 'var(--foreground)', marginTop: 4 }}>
              {scoreB}
            </div>
          </div>
        </div>

        {/* Line Rotation Summary Table */}
        <div style={{ border: '2px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ background: 'var(--dark)', color: '#ffffff', padding: '10px 14px', fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📋 Line-by-Line Squad Rotation Summary
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Line 1 */}
            <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 1 (0–14 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l1.teamA.join(' & ')}</strong>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, background: '#f1f5f9', padding: '4px 8px', borderRadius: 2 }}>VS</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 1 (0–14 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l1.teamB.join(' & ')}</strong>
              </div>
            </div>

            {/* Line 2 */}
            <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 2 (15–29 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l2.teamA.join(' & ')}</strong>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, background: '#f1f5f9', padding: '4px 8px', borderRadius: 2 }}>VS</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 2 (15–29 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l2.teamB.join(' & ')}</strong>
              </div>
            </div>

            {/* Line 3 */}
            <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 3 (30–44 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l3.teamA.join(' & ')}</strong>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, background: '#f1f5f9', padding: '4px 8px', borderRadius: 2 }}>VS</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 3 (30–44 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l3.teamB.join(' & ')}</strong>
              </div>
            </div>

            {/* Line 4 */}
            <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 4 (45–51 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l4.teamA.join(' & ')}</strong>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, background: '#f1f5f9', padding: '4px 8px', borderRadius: 2 }}>VS</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: 'var(--muted)', display: 'block', fontSize: 11 }}>LINE 4 (45–51 PTS)</span>
                <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>{l4.teamB.join(' & ')}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            onClick={() => setIsCompletedState(false)}
            className="btn-secondary"
            style={{ fontSize: 14, minHeight: 46, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <RotateCcw size={16} /> ↩ Reopen & Edit Score
          </button>

          <button
            onClick={onBack}
            className="btn-primary"
            style={{ fontSize: 14, minHeight: 46, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            ← Back to Fixtures List
          </button>
        </div>
      </div>
    );
  }

  // STRICT RULE: LIVE MATCH SCORING CANNOT BEGIN UNTIL PROPER LINEUP IS CONFIRMED!
  if (!lineup) {
    return (
      <div className="card" style={{ maxWidth: 700, margin: '0 auto', padding: 24, background: '#ffffff', border: '4px solid #b45309', boxShadow: '8px 8px 0 var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Lock size={52} style={{ color: '#b45309', marginBottom: 10 }} />
          <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.08em' }}>
            LINEUP LOCKED · ROUND {roundNumber} COURT {courtNumber}
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', margin: '8px 0' }}>
            🔒 Lineup Required Before Scoring
          </h2>
          <p style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 600, maxWidth: 500, margin: '0 auto' }}>
            Live court scorekeeper is locked for <strong>{teamAName} vs {teamBName}</strong>. Captains must select and confirm their 6-player lineup order first.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => {
              if (onLockLineupRequest) onLockLineupRequest();
              else onBack();
            }}
            className="btn-primary"
            style={{ width: '100%', minHeight: 52, fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            📋 Set Playing Lineup Now →
          </button>

          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ width: '100%', minHeight: 46, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            ← Back to Schedule & Fixtures
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 750, margin: '0 auto' }}>
      {/* Mid-Size Clearly Visible Back Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onBack}
          className="btn-secondary"
          style={{
            fontSize: 15,
            fontWeight: 900,
            padding: '10px 18px',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '2px solid var(--border)',
            background: '#ffffff',
            color: 'var(--foreground)',
            boxShadow: '2px 2px 0 var(--border)'
          }}
        >
          <ArrowLeft size={18} /> Exit Court {courtNumber}
        </button>

        <div style={{ fontSize: 14, fontWeight: 900, background: 'var(--dark)', color: '#ffffff', padding: '6px 14px', borderRadius: 2 }}>
          ROUND {roundNumber} · COURT {courtNumber}
        </div>
      </div>

      {/* PAUSE TAKEOVER SCREEN WHEN COMBINED SCORE HITS 15, 30, OR 45 PTS */}
      {isRotationPaused && (
        <div className="card" style={{ background: '#fffbeb', border: '4px solid #b45309', padding: 22, boxShadow: '6px 6px 0 rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Pause size={22} /> MATCH PAUSED AT {totalCombinedPoints} COMBINED POINTS
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--foreground)', margin: '6px 0 0 0' }}>
              🔄 1 Player Per Team Change Required
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '4px 0 0 0', fontWeight: 700 }}>
              Verify 1 player steps off and 1 new player enters on court per team.
            </p>
          </div>

          {/* SIMPLIFIED 1-LINE PER TEAM PLAYER HANDOFF OVERLAY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {/* Team A Substitution Card */}
            <div style={{ background: '#ffffff', padding: 16, border: '3px solid #b45309', borderRadius: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {teamAName} Substitution:
              </div>
              {subA ? (
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 2, border: '1px solid #f87171' }}>
                    🔴 {subA.steppingOff} Steps OFF
                  </span>
                  <span style={{ fontSize: 20 }}>➡️</span>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 2, border: '1px solid #4ade80' }}>
                    🟢 {subA.entering} Enters Court
                  </span>
                </div>
              ) : null}
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 8 }}>
                Staying on court: <strong>{subA?.staying || activePair.teamA[0]}</strong>
              </div>
            </div>

            {/* Team B Substitution Card */}
            <div style={{ background: '#ffffff', padding: 16, border: '3px solid #b45309', borderRadius: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {teamBName} Substitution:
              </div>
              {subB ? (
                <div style={{ fontSize: 16, fontWeight: 900, marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 2, border: '1px solid #f87171' }}>
                    🔴 {subB.steppingOff} Steps OFF
                  </span>
                  <span style={{ fontSize: 20 }}>➡️</span>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 2, border: '1px solid #4ade80' }}>
                    🟢 {subB.entering} Enters Court
                  </span>
                </div>
              ) : null}
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 8 }}>
                Staying on court: <strong>{subB?.staying || activePair.teamB[0]}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirmRotation}
            className="btn-primary"
            style={{ width: '100%', marginTop: 20, fontSize: 16, minHeight: 50, fontWeight: 900, background: '#166534', borderColor: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <CheckCircle2 size={20} /> 🟢 Confirm Player Substitutions & Resume Scoring
          </button>
        </div>
      )}

      {/* GIANT TOP MATCH SCORE CARD WITH HUGE TEAM NAME HEADERS */}
      <div className="card" style={{ padding: 22, background: 'var(--dark)', color: '#ffffff', border: '3px solid var(--dark)', boxShadow: '6px 6px 0 var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', color: 'var(--gold)', letterSpacing: '0.08em' }}>
            51-POINT RAPID FIRE · LINE {currentSegment} OF 4
          </span>
          <span style={{ fontSize: 13, fontWeight: 900, background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 2 }}>
            Combined Total: {totalCombinedPoints} / 51 Pts
          </span>
        </div>

        {/* HUGE TEAM HEADERS AND LIVE MATCH SCORE TALLY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'center', textAlign: 'center', marginBottom: 16 }}>
          {/* Team A Header & Huge Score */}
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 2, borderLeft: '6px solid var(--primary)' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>{teamAName}</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--primary)', marginTop: 4 }}>{scoreA}</div>
            <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 800, marginTop: 4 }}>
              Active: {activePair.teamA.join(' & ')}
            </div>
          </div>

          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)' }}>VS</div>

          {/* Team B Header & Huge Score */}
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 2, borderRight: '6px solid var(--gold)' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>{teamBName}</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--gold)', marginTop: 4 }}>{scoreB}</div>
            <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 800, marginTop: 4 }}>
              Active: {activePair.teamB.join(' & ')}
            </div>
          </div>
        </div>

        {upcomingPair && (
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
            ⏳ Next Player Shift (Line {currentSegment + 1}): {upcomingPair.teamA.join(' & ')} vs {upcomingPair.teamB.join(' & ')}
          </div>
        )}
      </div>

      {/* NON-INTRUSIVE SIDE CHANGE BANNER AT 25 COMBINED PTS */}
      {isSideChange && (
        <div className="card" style={{ background: '#e0f2fe', border: '3px solid #0284c7', padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowLeftRight size={20} /> 🔄 RULE 1: CHANGE SIDES NOW (25 Combined Pts Scored)
          </div>
        </div>
      )}

      {/* Golden Point Alert Banner */}
      {isGoldenPoint && (
        <div className="card" style={{ background: '#fef3c7', border: '3px solid #b45309', padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Trophy size={20} /> 50–50 SUDDEN DEATH GOLDEN POINT
          </div>
        </div>
      )}

      {/* MAIN SCORE COUNTER BUTTONS */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
        {/* Team A Direct Input & Active Label */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>{teamAName}</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--primary)', marginTop: 2 }}>{activePair.teamA.join(' & ')}</div>
          <input
            type="number"
            value={strScoreA}
            disabled={isRotationPaused}
            onFocus={e => e.target.select()}
            onChange={e => handleDirectInputA(e.target.value)}
            style={{ width: 110, padding: '6px', fontSize: 48, fontWeight: 900, textAlign: 'center', border: '2px solid var(--border)', borderRadius: 2, marginTop: 6, background: '#f8fafc' }}
          />
        </div>

        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--muted)', padding: '0 12px' }}>–</div>

        {/* Team B Direct Input & Active Label */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>{teamBName}</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--gold)', marginTop: 2 }}>{activePair.teamB.join(' & ')}</div>
          <input
            type="number"
            value={strScoreB}
            disabled={isRotationPaused}
            onFocus={e => e.target.select()}
            onChange={e => handleDirectInputB(e.target.value)}
            style={{ width: 110, padding: '6px', fontSize: 48, fontWeight: 900, textAlign: 'center', border: '2px solid var(--border)', borderRadius: 2, marginTop: 6, background: '#f8fafc' }}
          />
        </div>
      </div>

      {/* GIANT 1-TAP SCORE BUTTONS FOR LIVE COURT SCOREKEEPER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <button
            onClick={() => handleAddPoint('A')}
            disabled={isMatchFinished || isRotationPaused}
            className="btn-primary"
            style={{ width: '100%', minHeight: 90, fontSize: 22, fontWeight: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <span>+1 {teamAName}</span>
            <span style={{ fontSize: 13, opacity: 0.9, fontWeight: 700 }}>({activePair.teamA.join(' & ')})</span>
          </button>
          <button
            onClick={() => handleUndoSpecificTeam('A')}
            className="btn-secondary"
            style={{ width: '100%', marginTop: 8, fontSize: 13, padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Undo2 size={14} /> Undo {teamAName} Point
          </button>
        </div>

        <div>
          <button
            onClick={() => handleAddPoint('B')}
            disabled={isMatchFinished || isRotationPaused}
            className="btn-secondary"
            style={{ width: '100%', minHeight: 90, fontSize: 22, fontWeight: 900, background: 'var(--dark)', color: '#ffffff', borderColor: 'var(--dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <span>+1 {teamBName}</span>
            <span style={{ fontSize: 13, opacity: 0.9, fontWeight: 700 }}>({activePair.teamB.join(' & ')})</span>
          </button>
          <button
            onClick={() => handleUndoSpecificTeam('B')}
            className="btn-secondary"
            style={{ width: '100%', marginTop: 8, fontSize: 13, padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Undo2 size={14} /> Undo {teamBName} Point
          </button>
        </div>
      </div>
    </div>
  );
}
