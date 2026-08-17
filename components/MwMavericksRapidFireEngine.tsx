import React, { useState, useEffect } from 'react';
import {
  RapidFireState,
  createInitialState,
  addPoint,
  undoPoint,
  getActivePair,
  getNextPairOnDeck,
  isDeuceState,
  PAIR_MATCHUPS,
  Team,
} from '../lib/mwRapidFire';
import { saveScoreWithFailsafe } from '@/lib/tournamentOfflineSync';
import { Flame, Trophy, RotateCcw, Activity, UserCheck } from 'lucide-react';

interface MwMavericksRapidFireEngineProps {
  rfScoreA?: number | null;
  rfScoreB?: number | null;
  onScoreUpdate?: () => void;
}

export const MwMavericksRapidFireEngine: React.FC<MwMavericksRapidFireEngineProps> = ({ rfScoreA, rfScoreB, onScoreUpdate }) => {
  const [state, setState] = useState<RapidFireState>(createInitialState());

  // Synchronize state with central database prop when database is reset or updated externally
  useEffect(() => {
    const sa = rfScoreA !== null && rfScoreA !== undefined ? Number(rfScoreA) : 0;
    const sb = rfScoreB !== null && rfScoreB !== undefined ? Number(rfScoreB) : 0;

    if (sa === 0 && sb === 0) {
      setState(createInitialState());
    } else if (sa !== state.mwScore || sb !== state.svkmScore) {
      setState((prev) => ({
        ...prev,
        mwScore: sa,
        svkmScore: sb,
        isFinished: (sa >= 31 && sa >= sb + 2) || (sb >= 31 && sb >= sa + 2),
        winner: sa >= 31 && sa >= sb + 2 ? 'MW' : (sb >= 31 && sb >= sa + 2 ? 'SVKM' : null)
      }));
    }
  }, [rfScoreA, rfScoreB]);

  const activePair = getActivePair(state.mwScore, state.svkmScore);
  const nextPair = getNextPairOnDeck(state.mwScore, state.svkmScore);
  const totalPoints = state.mwScore + state.svkmScore;
  const isDeuce = isDeuceState(state.mwScore, state.svkmScore);

  const handleAddPoint = (team: Team) => {
    setState((prev) => {
      const next = addPoint(prev, team);
      saveScoreWithFailsafe('mw_mavericks_season_2_2026', {
        id: 'mw_rf_finale',
        session_id: 'mw_mavericks_season_2_2026',
        round_number: 23,
        court: 1,
        team_a: ['MW MAVERICKS SQUAD'],
        team_b: ['SVKM CHALLENGERS SQUAD'],
        sitting_out: [],
        score_a: next.mwScore,
        score_b: next.svkmScore
      }).catch(console.error);

      if (onScoreUpdate) onScoreUpdate();
      return next;
    });
  };

  const handleUndo = () => {
    setState((prev) => {
      const next = undoPoint(prev);
      saveScoreWithFailsafe('mw_mavericks_season_2_2026', {
        id: 'mw_rf_finale',
        session_id: 'mw_mavericks_season_2_2026',
        round_number: 23,
        court: 1,
        team_a: ['MW MAVERICKS SQUAD'],
        team_b: ['SVKM CHALLENGERS SQUAD'],
        sitting_out: [],
        score_a: next.mwScore,
        score_b: next.svkmScore
      }).catch(console.error);

      if (onScoreUpdate) onScoreUpdate();
      return next;
    });
  };

  let matchStatusText = 'LIVE FINALE';
  let matchStatusBg = '#f8fafc';
  let matchStatusColor = '#0f172a';

  if (state.isFinished) {
    matchStatusText = `WINNER: ${state.winner === 'MW' ? 'MW MAVERICKS' : 'SVKM CHALLENGERS'}`;
    matchStatusBg = '#0f172a';
    matchStatusColor = '#ffffff';
  } else if (isDeuce) {
    matchStatusText = 'DEUCE — MUST WIN BY 2 POINTS';
    matchStatusBg = '#fef3c7';
    matchStatusColor = '#92400e';
  } else if (state.mwScore >= 30 || state.svkmScore >= 30) {
    const leader = state.mwScore > state.svkmScore ? 'MW MAVERICKS' : 'SVKM CHALLENGERS';
    matchStatusText = `MATCH POINT — ${leader}`;
    matchStatusBg = '#fee2e2';
    matchStatusColor = '#991b1b';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', color: '#0f172a' }}>
      {/* GRAND FINALE HEADER CARD */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 20, fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
          <Flame size={16} />
          <span>RAPID FIRE GRAND FINALE (SESSION 4)</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          MW MAVERICKS vs SVKM CHALLENGERS
        </h1>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#64748b', margin: '0 0 16px 0' }}>
          Race to 31 Points · 3-Point Rotation · Win-by-2 Deuce Logic
        </p>

        {/* STATUS BADGE */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: matchStatusBg, color: matchStatusColor, borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15, fontWeight: 900 }}>
          <Activity size={18} />
          <span>{matchStatusText}</span>
        </div>
      </div>

      {/* WINNER ANNOUNCEMENT CARD */}
      {state.isFinished && (
        <div style={{ background: '#0f172a', color: '#ffffff', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 6px 20px rgba(15,23,42,0.15)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: '#ffffff', borderRadius: '50%', color: '#0f172a', marginBottom: 12 }}>
            <Trophy size={32} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px 0' }}>
            {state.winner === 'MW' ? 'MW MAVERICKS' : 'SVKM CHALLENGERS'} VICTORY!
          </h2>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', margin: 0 }}>
            Final Score: MW {state.mwScore} - {state.svkmScore} SVKM ({totalPoints} total points)
          </p>
        </div>
      )}

      {/* MAIN SCOREBOARD CARD GRID (SIDE BY SIDE ON MOBILE) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* MW MAVERICKS SCORE CARD */}
        <div style={{ background: '#ffffff', border: state.winner === 'MW' ? '3px solid #0f172a' : '1px solid #cbd5e1', borderRadius: 16, padding: '16px 12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TEAM A</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2, lineHeight: 1.2 }}>MW MAVERICKS</div>
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, color: '#0f172a', margin: '10px 0', fontFamily: 'monospace', lineHeight: 1 }}>
            {state.mwScore}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
            Target: {isDeuce ? state.svkmScore + 2 : 31} pts
          </div>
        </div>

        {/* SVKM CHALLENGERS SCORE CARD */}
        <div style={{ background: '#ffffff', border: state.winner === 'SVKM' ? '3px solid #0f172a' : '1px solid #cbd5e1', borderRadius: 16, padding: '16px 12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TEAM B</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2, lineHeight: 1.2 }}>SVKM CHALLENGERS</div>
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, color: '#0f172a', margin: '10px 0', fontFamily: 'monospace', lineHeight: 1 }}>
            {state.svkmScore}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
            Target: {isDeuce ? state.mwScore + 2 : 31} pts
          </div>
        </div>
      </div>

      {/* BIG TOUCH TAP BUTTONS (SIDE BY SIDE ON MOBILE) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button
          type="button"
          disabled={state.isFinished}
          onClick={() => handleAddPoint('MW')}
          style={{
            width: '100%',
            minHeight: 58,
            padding: '12px 8px',
            fontSize: 15,
            fontWeight: 900,
            background: state.isFinished ? '#e2e8f0' : '#0f172a',
            color: state.isFinished ? '#94a3b8' : '#ffffff',
            borderRadius: 14,
            border: 'none',
            cursor: state.isFinished ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: state.isFinished ? 'none' : '0 4px 12px rgba(15,23,42,0.15)'
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 900 }}>+1</span>
          <span style={{ fontSize: 14 }}>MW MAVERICKS</span>
        </button>

        <button
          type="button"
          disabled={state.isFinished}
          onClick={() => handleAddPoint('SVKM')}
          style={{
            width: '100%',
            minHeight: 58,
            padding: '12px 8px',
            fontSize: 15,
            fontWeight: 900,
            background: state.isFinished ? '#e2e8f0' : '#0f172a',
            color: state.isFinished ? '#94a3b8' : '#ffffff',
            borderRadius: 14,
            border: 'none',
            cursor: state.isFinished ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: state.isFinished ? 'none' : '0 4px 12px rgba(15,23,42,0.15)'
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 900 }}>+1</span>
          <span style={{ fontSize: 14 }}>SVKM CHALLENGERS</span>
        </button>
      </div>

      {/* 1-TAP UNDO CONTROL BAR */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          disabled={state.history.length === 0}
          onClick={handleUndo}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 800,
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: state.history.length === 0 ? '#f8fafc' : '#ffffff',
            color: state.history.length === 0 ? '#94a3b8' : '#0f172a',
            cursor: state.history.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: state.history.length === 0 ? 'none' : '0 2px 6px rgba(0,0,0,0.04)'
          }}
        >
          <RotateCcw size={18} />
          <span>1-Tap Undo Last Point ({state.history.length})</span>
        </button>
      </div>

      {/* ACTIVE PAIR & ROTATION SHOWCASE CARD */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 16, color: '#0f172a' }}>
            <UserCheck size={20} />
            <span>ACTIVE COURT PAIR & 3-POINT ROTATION</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', background: '#f1f5f9', padding: '6px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
            Total Points: {totalPoints}
          </div>
        </div>

        {/* ON COURT NOW CARD */}
        <div style={{ background: '#f8fafc', border: '2px solid #0f172a', borderRadius: 14, padding: 20, position: 'relative' }}>
          <div style={{ position: 'absolute', top: -12, left: 16, background: '#0f172a', color: '#ffffff', fontSize: 12, fontWeight: 900, padding: '4px 12px', borderRadius: 8, letterSpacing: '0.05em' }}>
            ON COURT NOW · PAIR {activePair.pairNumber} OF 6
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'block' }}>MW Mavericks Pair</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', marginTop: 4, display: 'block', lineHeight: 1.2 }}>{activePair.mwPair}</span>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'block' }}>SVKM Challengers Pair</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', marginTop: 4, display: 'block', lineHeight: 1.2 }}>{activePair.svkmPair}</span>
            </div>
          </div>
        </div>

        {/* NEXT ON DECK CARD */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>NEXT ON DECK · PAIR {nextPair.pairNumber} OF 6</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
              {nextPair.mwPair} <span style={{ color: '#94a3b8' }}>vs</span> {nextPair.svkmPair}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '6px 12px', borderRadius: 8 }}>
            Rotates at {Math.floor(totalPoints / 3) * 3 + 3} total pts
          </div>
        </div>

        {/* ROTATION SCHEDULE GRID */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>
            Complete Rotation Schedule (6 Pairs)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {PAIR_MATCHUPS.map((pair) => {
              const isActive = pair.id === activePair.id;
              const isDeck = pair.id === nextPair.id;
              return (
                <div
                  key={pair.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: isActive ? '2px solid #0f172a' : '1px solid #e2e8f0',
                    background: isActive ? '#f8fafc' : (isDeck ? '#ffffff' : '#fafafa'),
                    fontSize: 13
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900, marginBottom: 4 }}>
                    <span style={{ color: '#0f172a' }}>Pair {pair.pairNumber}</span>
                    {isActive && <span style={{ fontSize: 10, fontWeight: 900, background: '#0f172a', color: '#ffffff', padding: '2px 8px', borderRadius: 6 }}>ACTIVE</span>}
                    {isDeck && <span style={{ fontSize: 10, fontWeight: 900, background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 6 }}>DECK</span>}
                  </div>
                  <div style={{ fontWeight: 800, color: '#475569', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pair.mwPair} <span style={{ color: '#cbd5e1' }}>v</span> {pair.svkmPair}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MATCH LOG HISTORY TABLE */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>
            Match Log History ({state.log.length} Points Scored)
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Latest point on top</div>
        </div>

        {state.log.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 15, fontWeight: 600 }}>
            No points scored yet. Tap +1 on either team above to start!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {state.log.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 14
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 900, color: '#64748b', width: 30 }}>#{entry.pointNumber}</span>
                  <span style={{ fontWeight: 900, color: '#0f172a', background: '#ffffff', padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                    +1 {entry.scoringTeamName}
                  </span>
                  <span style={{ fontWeight: 600, color: '#64748b', fontSize: 13 }}>
                    (Pair {entry.pairMatchup.pairNumber}: {entry.pairMatchup.mwPair} vs {entry.pairMatchup.svkmPair})
                  </span>
                </div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a', fontFamily: 'monospace' }}>
                  {entry.mwScoreAfter} - {entry.svkmScoreAfter}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MwMavericksRapidFireEngine;
