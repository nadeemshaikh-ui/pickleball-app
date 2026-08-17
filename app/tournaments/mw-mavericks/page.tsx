'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, CheckCircle2, Trophy, ShieldCheck, Flame, Layers, BarChart2, Share2, FileText, Activity, Save, Smartphone, Zap, RotateCcw, Lock, KeyRound, Download, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { saveScoreWithFailsafe, getLocalRoundMirror, getScoreAuditLog, flushOfflineQueue, restoreRoundsFromAuditLog } from '@/lib/tournamentOfflineSync';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import SquadVersusHero from '@/components/SquadVersusHero';
import MwMavericksAnalyticsView from '@/components/MwMavericksAnalyticsView';
import { MwMavericksScorecardImageTemplate } from '@/components/MwMavericksScorecardImageTemplate';
import MwMavericksRapidFireEngine from '@/components/MwMavericksRapidFireEngine';
import { checkWinner } from '@/lib/mwRapidFire';

const SESSION_ID = 'mw_mavericks_season_2_2026';
const ADMIN_PASSCODE = '0007';

const MW_MAVERICKS_PLAYERS = ['KARAN', 'AMBRESH', 'CHIRAG', 'HEMAL', 'SAGAR', 'AMIT', 'TUSHAR', 'GOPAL', 'KETAN', 'HITEN', 'MBS', 'SAURABH'];
const SVKM_CHALLENGERS_PLAYERS = ['12', 'RAHIL', 'NEEL', 'ANISH', 'GAURAV', 'MRUGESH', 'HARSH', 'SMIT', 'TEJASH', 'VICKY', 'DD', 'AKSHAY'];

interface MatchScoreRow {
  id?: string;
  session_id?: string;
  round_number: number;
  court: number;
  team_a: string[];
  team_b: string[];
  score_a: number | null;
  score_b: number | null;
}

export default function MwMavericksMasterTournamentPage() {
  const [mainTab, setMainTab] = useState<'scoring' | 'standings' | 'analytics' | 'share' | 'logs' | 'admin'>('scoring');
  const [activeSessionStage, setActiveSessionStage] = useState<'session1' | 'session2' | 'session3' | 'rapidfire'>('session1');
  const [rounds, setRounds] = useState<MatchScoreRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('System Online & Synced');
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, [string, string]>>({});

  // Standings state
  const [mwScore, setMwScore] = useState<number>(0);
  const [svkmScore, setSvkmScore] = useState<number>(0);
  const [rapidFireWinner, setRapidFireWinner] = useState<string | null>(null);

  // Image Share State
  const [generatingImage, setGeneratingImage] = useState<boolean>(false);
  const scorecardRef = useRef<HTMLDivElement>(null);

  // Admin Security Reset Modal State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [resetMatchRound, setResetMatchRound] = useState<number>(1);
  const [resetMatchCourt, setResetMatchCourt] = useState<number>(1);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Load tournament rounds from Supabase & Local Mirror
  async function fetchRoundsData() {
    setSyncing(true);
    try {
      flushOfflineQueue(SESSION_ID).catch(console.error);

      const { data: dbRounds, error } = await supabase
        .from('rounds')
        .select('*')
        .in('session_id', ['mw_mavericks_season_2_2026', '1u03ob'])
        .order('round_number', { ascending: true })
        .order('court', { ascending: true });

      const localMirror = getLocalRoundMirror(SESSION_ID);
      const roundMap = new Map<string, MatchScoreRow>();

      (dbRounds || []).forEach(r => roundMap.set(`${Number(r.round_number)}_${Number(r.court)}`, r));

      // If offline or network fallback, merge local mirror only for items missing in DB
      if (error || !dbRounds) {
        (localMirror || []).forEach(r => {
          const key = `${Number(r.round_number)}_${Number(r.court)}`;
          if (!roundMap.has(key)) {
            roundMap.set(key, r);
          }
        });
      }

      const merged = Array.from(roundMap.values()).sort((a, b) => {
        if (a.round_number !== b.round_number) return a.round_number - b.round_number;
        return a.court - b.court;
      });

      setRounds(merged);
      computeStandings(merged);
      setAuditLogs(getScoreAuditLog(SESSION_ID));
      setSyncStatus('System Online & Synced');
    } catch (err) {
      console.error('Error loading tournament data:', err);
      setSyncStatus('Working Offline (Local Mirror Active)');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    // Client Cache Enforcer: Wipes old local mirror if version mismatch to force clean DB sync
    if (typeof window !== 'undefined') {
      const CURRENT_APP_VERSION = 'mw_mavericks_v3_clean_00';
      const storedVersion = localStorage.getItem('pb_app_version');
      if (storedVersion !== CURRENT_APP_VERSION) {
        console.log('[CacheEnforcer] Wiping stale local storage mirrors for clean DB reset...');
        localStorage.removeItem(`pb_tournament_rounds_mirror_${SESSION_ID}`);
        localStorage.removeItem(`pb_tournament_offline_queue_${SESSION_ID}`);
        localStorage.removeItem(`pb_tournament_rapidfire_${SESSION_ID}`);
        localStorage.setItem('pb_app_version', CURRENT_APP_VERSION);
      }
    }

    fetchRoundsData();

    // 1. 3-Second Auto-Sync Heartbeat (Guarantees multi-device sync even on slow mobile connections)
    const interval = setInterval(() => {
      fetchRoundsData();
    }, 3000);

    // 2. Realtime WebSocket Subscription
    const channel = supabase
      .channel('mw_mavericks_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `session_id=eq.${SESSION_ID}` },
        () => {
          fetchRoundsData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  function computeStandings(allRounds: MatchScoreRow[]) {
    let mwTotal = 0;
    let svkmTotal = 0;

    let mwRfWins = 0;
    let svkmRfWins = 0;

    allRounds.forEach(r => {
      const rNum = Number(r.round_number);
      const sa = r.score_a !== null && r.score_a !== undefined ? Number(r.score_a) : null;
      const sb = r.score_b !== null && r.score_b !== undefined ? Number(r.score_b) : null;

      if (sa !== null && sb !== null && (sa > 0 || sb > 0)) {
        let weight = 1;
        if (rNum >= 1 && rNum <= 8) weight = 1;
        else if (rNum >= 9 && rNum <= 14) weight = 2;
        else if (rNum >= 15 && rNum <= 22) weight = 3;

        if (rNum <= 22) {
          if (sa > sb) mwTotal += weight;
          else if (sb > sa) svkmTotal += weight;
        } else if (rNum >= 23 && rNum <= 28) {
          // Rapid Fire Grand Finale (Race to 31 points, win by 2)
          const rfWinner = checkWinner(sa, sb);
          if (rfWinner === 'MW') mwRfWins++;
          else if (rfWinner === 'SVKM') svkmRfWins++;
        }
      }
    });

    if (mwRfWins > 0 && mwRfWins > svkmRfWins) {
      mwTotal += 10;
      setRapidFireWinner('MW MAVERICKS (+10 Bonus Pts)');
    } else if (svkmRfWins > 0 && svkmRfWins > mwRfWins) {
      svkmTotal += 10;
      setRapidFireWinner('SVKM CHALLENGERS (+10 Bonus Pts)');
    } else {
      setRapidFireWinner(null);
    }

    setMwScore(mwTotal);
    setSvkmScore(svkmTotal);
  }

  async function handleSaveScore(roundNumber: number, court: number, teamA: string[], teamB: string[], scoreAStr: string, scoreBStr: string) {
    const sa = parseInt(scoreAStr);
    const sb = parseInt(scoreBStr);

    if (isNaN(sa) || isNaN(sb)) {
      alert('Please enter numeric scores for both teams.');
      return;
    }

    const updatedRow: MatchScoreRow = {
      session_id: SESSION_ID,
      round_number: roundNumber,
      court,
      team_a: teamA,
      team_b: teamB,
      score_a: sa,
      score_b: sb
    };

    setRounds(prevRounds => {
      const next = prevRounds.map(r =>
        Number(r.round_number) === Number(roundNumber) && Number(r.court) === Number(court)
          ? { ...r, score_a: sa, score_b: sb }
          : r
      );
      computeStandings(next);
      return next;
    });

    saveScoreWithFailsafe(SESSION_ID, updatedRow as any).catch(console.error);
    setAuditLogs(getScoreAuditLog(SESSION_ID));
  }

  // Image Generation & Share Handlers with 6px Border Frame Guard
  async function handleShareScorecardImage() {
    if (!scorecardRef.current) return;
    setGeneratingImage(true);
    try {
      const file = await renderElementToImage(scorecardRef.current, 'MW_Mavericks_Season_II_Scorecard.png');
      const action = await shareCachedImage(file);
      if (action === 'downloaded') {
        alert('Scorecard image downloaded with full outer border frame! Attach this image directly in WhatsApp.');
      }
    } catch (err) {
      console.error('Error sharing image:', err);
      alert('Failed to generate scorecard image.');
    } finally {
      setGeneratingImage(false);
    }
  }

  // Admin Match Score Reset Security Protocol
  async function handleAdminResetSingleMatch() {
    if (!isAdminUnlocked) {
      alert('Admin Passcode required to reset match scores.');
      return;
    }

    const confirmReset = confirm(`Are you sure you want to reset score for Round ${resetMatchRound} Court ${resetMatchCourt}?`);
    if (!confirmReset) return;

    try {
      const targetMatch = rounds.find(r => Number(r.round_number) === Number(resetMatchRound) && Number(r.court) === Number(resetMatchCourt));
      if (!targetMatch) {
        alert('Match not found.');
        return;
      }

      const resetRow: MatchScoreRow = {
        ...targetMatch,
        score_a: null,
        score_b: null
      };

      setRounds(prev => prev.map(r => Number(r.round_number) === Number(resetMatchRound) && Number(r.court) === Number(resetMatchCourt) ? resetRow : r));

      await supabase
        .from('rounds')
        .update({ score_a: null, score_b: null })
        .eq('session_id', SESSION_ID)
        .eq('round_number', resetMatchRound)
        .eq('court', resetMatchCourt);

      saveScoreWithFailsafe(SESSION_ID, resetRow as any).catch(console.error);
      fetchRoundsData();
      alert(`Score for Round ${resetMatchRound} Court ${resetMatchCourt} has been reset.`);
    } catch (err) {
      console.error('Error resetting score:', err);
      alert('Failed to reset match score.');
    }
  }

  // Master Full Tournament Reset Protocol (Wipe all 72 match scores back to 0-0)
  async function handleAdminResetEntireTournament() {
    if (!isAdminUnlocked) {
      alert('Admin Passcode required to reset tournament scores.');
      return;
    }

    const confirmMasterReset = confirm('⚠️ ARE YOU SURE YOU WANT TO RESET ALL 72 MATCHES BACK TO 0-0?\n\nThis will wipe all scores in the database and reset the leaderboard to 0-0.');
    if (!confirmMasterReset) return;

    try {
      setSyncing(true);
      // Clear all local storage mirrors on device
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`pb_tournament_rounds_mirror_${SESSION_ID}`);
        localStorage.removeItem(`pb_tournament_offline_queue_${SESSION_ID}`);
        localStorage.removeItem(`pb_tournament_audit_log_${SESSION_ID}`);
        localStorage.removeItem(`pb_tournament_rapidfire_${SESSION_ID}`);
      }

      // Reset Supabase DB
      await supabase
        .from('rounds')
        .update({ score_a: null, score_b: null })
        .eq('session_id', SESSION_ID);

      await fetchRoundsData();
      alert('SUCCESS: Entire tournament has been reset back to 0-0! All 72 matches are pending.');
    } catch (err) {
      console.error('Error resetting entire tournament:', err);
      alert('Failed to reset tournament.');
    } finally {
      setSyncing(false);
    }
  }

  function handleUnlockAdmin() {
    if (passcodeInput.trim() === ADMIN_PASSCODE) {
      setIsAdminUnlocked(true);
      alert('Admin Security Console Unlocked.');
    } else {
      alert('Incorrect Admin Passcode.');
    }
  }

  function handleSelfHealingRestore() {
    const restored = restoreRoundsFromAuditLog(SESSION_ID);
    if (restored && restored.length > 0) {
      fetchRoundsData();
      alert(`Successfully restored ${restored.length} match records from local audit trail log!`);
    } else {
      alert('No local audit log history found to restore.');
    }
  }

  // Compute Session Breakdown Tally
  let s1Mw = 0, s1Svkm = 0;
  let s2Mw = 0, s2Svkm = 0;
  let s3Mw = 0, s3Svkm = 0;
  let rfMw = 0, rfSvkm = 0;

  rounds.forEach(r => {
    const rNum = Number(r.round_number);
    const sa = r.score_a !== null && r.score_a !== undefined ? Number(r.score_a) : null;
    const sb = r.score_b !== null && r.score_b !== undefined ? Number(r.score_b) : null;

    if (sa !== null && sb !== null && (sa > 0 || sb > 0)) {
      if (rNum >= 1 && rNum <= 8) {
        if (sa > sb) s1Mw += 1;
        else if (sb > sa) s1Svkm += 1;
      } else if (rNum >= 9 && rNum <= 14) {
        if (sa > sb) s2Mw += 2;
        else if (sb > sa) s2Svkm += 2;
      } else if (rNum >= 15 && rNum <= 22) {
        if (sa > sb) s3Mw += 3;
        else if (sb > sa) s3Svkm += 3;
      } else if (rNum >= 23 && rNum <= 28) {
        if (sa > sb) rfMw += 1;
        else if (sb > sa) rfSvkm += 1;
      }
    }
  });

  const activeRounds = rounds.filter(r => {
    const rNum = Number(r.round_number);
    if (activeSessionStage === 'session1') return rNum >= 1 && rNum <= 8;
    if (activeSessionStage === 'session2') return rNum >= 9 && rNum <= 14;
    if (activeSessionStage === 'session3') return rNum >= 15 && rNum <= 22;
    if (activeSessionStage === 'rapidfire') return rNum >= 23 && rNum <= 28;
    return false;
  });

  const cellStyle: React.CSSProperties = {
    padding: '16px 14px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    lineHeight: 1.2
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px 14px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    fontWeight: 800,
    fontSize: 14,
    color: '#64748b'
  };

  function handleFixScreenSync() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`pb_tournament_rounds_mirror_${SESSION_ID}`);
      localStorage.removeItem(`pb_tournament_offline_queue_${SESSION_ID}`);
    }
    fetchRoundsData();
  }

  return (
    <main className="page" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 56px 16px', color: '#0f172a' }}>
      {/* Hidden Scorecard Image Template Element for Canvas Image Generation */}
      <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <MwMavericksScorecardImageTemplate
          ref={scorecardRef}
          mwScore={mwScore}
          svkmScore={svkmScore}
          s1Mw={s1Mw}
          s1Svkm={s1Svkm}
          s2Mw={s2Mw}
          s2Svkm={s2Svkm}
          s3Mw={s3Mw}
          s3Svkm={s3Svkm}
          rfMw={rfMw}
          rfSvkm={rfSvkm}
          rapidFireWinner={rapidFireWinner}
        />
      </div>

      {/* Header Title */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Monday Wednesday Club · Season II
        </div>
        <h1 style={{ margin: '6px 0', fontSize: 30, fontWeight: 900, lineHeight: 1.2, color: '#0f172a' }}>
          MW Mavericks vs SVKM Challengers
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: '#64748b', fontWeight: 600 }}>
          12th August 2026 · 24 Players · 3 Courts · 142 Total Points
        </p>
      </div>

      {/* App Standard SquadVersusHero Component */}
      <div style={{ padding: 24, marginBottom: 24, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
        <SquadVersusHero
          goldLabel="MW MAVERICKS"
          blackLabel="SVKM CHALLENGERS"
          goldLogoUrl={null}
          blackLogoUrl={null}
          goldScore={mwScore}
          blackScore={svkmScore}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#64748b' }}>
            Status: <span style={{ color: '#0f172a', fontWeight: 800 }}>{syncStatus}</span>
          </span>
          <button
            onClick={handleFixScreenSync}
            disabled={syncing}
            style={{ fontSize: 15, minHeight: 48, padding: '10px 20px', fontWeight: 800, cursor: 'pointer', borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={18} className={syncing ? 'spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Fix Screen & Sync'}</span>
          </button>
        </div>
      </div>

      {/* 6 Main Top Navigation Tabs */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, marginBottom: 24 }}>
        <button
          onClick={() => setMainTab('scoring')}
          style={{
            flex: 1,
            minWidth: 140,
            minHeight: 56,
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: mainTab === 'scoring' ? '#0f172a' : '#ffffff',
            color: mainTab === 'scoring' ? '#ffffff' : '#0f172a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Activity size={20} />
          <span>Live Scoring</span>
        </button>
        <button
          onClick={() => setMainTab('standings')}
          style={{
            flex: 1,
            minWidth: 130,
            minHeight: 56,
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: mainTab === 'standings' ? '#0f172a' : '#ffffff',
            color: mainTab === 'standings' ? '#ffffff' : '#0f172a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Trophy size={20} />
          <span>Standings</span>
        </button>
        <button
          onClick={() => setMainTab('analytics')}
          style={{
            flex: 1,
            minWidth: 150,
            minHeight: 56,
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: mainTab === 'analytics' ? '#0f172a' : '#ffffff',
            color: mainTab === 'analytics' ? '#ffffff' : '#0f172a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <BarChart2 size={20} />
          <span>Deep Analytics</span>
        </button>
        <button
          onClick={() => setMainTab('share')}
          style={{
            flex: 1,
            minWidth: 160,
            minHeight: 56,
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: mainTab === 'share' ? '#0f172a' : '#ffffff',
            color: mainTab === 'share' ? '#ffffff' : '#0f172a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Smartphone size={20} />
          <span>WhatsApp Share</span>
        </button>
        <button
          onClick={() => setMainTab('admin')}
          style={{
            flex: 1,
            minWidth: 150,
            minHeight: 56,
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: mainTab === 'admin' ? '#0f172a' : '#ffffff',
            color: mainTab === 'admin' ? '#ffffff' : '#0f172a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Lock size={20} />
          <span>Admin Reset</span>
        </button>
        <button
          onClick={() => setMainTab('logs')}
          style={{
            flex: 1,
            minWidth: 140,
            minHeight: 56,
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            background: mainTab === 'logs' ? '#0f172a' : '#ffffff',
            color: mainTab === 'logs' ? '#ffffff' : '#0f172a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <ShieldCheck size={20} />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* MAIN TAB 1: LIVE SCORING VIEW */}
      {mainTab === 'scoring' && (
        <>
          {/* Stage Sub-Pills */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => setActiveSessionStage('session1')}
              style={{
                flex: 1,
                padding: '14px 8px',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: activeSessionStage === 'session1' ? '#0f172a' : '#ffffff',
                color: activeSessionStage === 'session1' ? '#ffffff' : '#0f172a',
                cursor: 'pointer'
              }}
            >
              Session 1 (1pt)
            </button>
            <button
              onClick={() => setActiveSessionStage('session2')}
              style={{
                flex: 1,
                padding: '14px 8px',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: activeSessionStage === 'session2' ? '#0f172a' : '#ffffff',
                color: activeSessionStage === 'session2' ? '#ffffff' : '#0f172a',
                cursor: 'pointer'
              }}
            >
              Session 2 (2pt)
            </button>
            <button
              onClick={() => setActiveSessionStage('session3')}
              style={{
                flex: 1,
                padding: '14px 8px',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: activeSessionStage === 'session3' ? '#0f172a' : '#ffffff',
                color: activeSessionStage === 'session3' ? '#ffffff' : '#0f172a',
                cursor: 'pointer'
              }}
            >
              Session 3 (3pt)
            </button>
            <button
              onClick={() => setActiveSessionStage('rapidfire')}
              style={{
                flex: 1,
                padding: '14px 8px',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: activeSessionStage === 'rapidfire' ? '#0f172a' : '#ffffff',
                color: activeSessionStage === 'rapidfire' ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Flame size={18} />
              <span>Rapid Fire</span>
            </button>
          </div>

          {/* Match Cards List (Session 1, 2, 3) OR Rapid Fire Engine */}
          {activeSessionStage === 'rapidfire' ? (
            <MwMavericksRapidFireEngine
              rfScoreA={rounds.find(r => Number(r.round_number) === 23)?.score_a}
              rfScoreB={rounds.find(r => Number(r.round_number) === 23)?.score_b}
              onScoreUpdate={fetchRoundsData}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {activeRounds.length === 0 ? (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, textAlign: 'center', color: '#64748b', fontSize: 16 }}>
                  Loading round matches...
                </div>
              ) : (
              activeRounds.map(r => {
                const draft = scoreDrafts[`${r.round_number}_${r.court}`] || [
                  r.score_a !== null && r.score_a !== undefined ? String(r.score_a) : '',
                  r.score_b !== null && r.score_b !== undefined ? String(r.score_b) : ''
                ];

                const isScored = r.score_a !== null && r.score_b !== null && (r.score_a > 0 || r.score_b > 0);

                return (
                  <div key={`${r.round_number}_${r.court}`} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
                    {/* Card Subheader */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 14 }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                        Round {r.round_number} · Court {r.court}
                      </span>
                      {isScored ? (
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', background: '#f1f5f9', padding: '6px 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={16} /> Scored ({r.score_a} – {r.score_b})
                        </span>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>
                          Pending Match
                        </span>
                      )}
                    </div>

                    {/* Team Pairs & Large Touch Score Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'center', textAlign: 'center' }}>
                      {/* Left Team: MW Mavericks */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                          {(r.team_a || []).join(' & ')}
                        </div>
                        <div style={{ fontSize: 14, color: '#64748b', fontWeight: 700 }}>
                          MW Mavericks
                        </div>
                        <input
                          type="number"
                          placeholder="0"
                          value={draft[0]}
                          onChange={e => setScoreDrafts(prev => ({ ...prev, [`${r.round_number}_${r.court}`]: [e.target.value, draft[1]] }))}
                          style={{
                            width: '100%',
                            maxWidth: 120,
                            minHeight: 64,
                            fontSize: 32,
                            fontWeight: 900,
                            textAlign: 'center',
                            borderRadius: 12,
                            border: '2px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0f172a'
                          }}
                        />
                      </div>

                      {/* VS Divider */}
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#64748b', padding: '0 6px' }}>
                        VS
                      </div>

                      {/* Right Team: SVKM Challengers */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                          {(r.team_b || []).join(' & ')}
                        </div>
                        <div style={{ fontSize: 14, color: '#64748b', fontWeight: 700 }}>
                          SVKM Challengers
                        </div>
                        <input
                          type="number"
                          placeholder="0"
                          value={draft[1]}
                          onChange={e => setScoreDrafts(prev => ({ ...prev, [`${r.round_number}_${r.court}`]: [draft[0], e.target.value] }))}
                          style={{
                            width: '100%',
                            maxWidth: 120,
                            minHeight: 64,
                            fontSize: 32,
                            fontWeight: 900,
                            textAlign: 'center',
                            borderRadius: 12,
                            border: '2px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0f172a'
                          }}
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={() => handleSaveScore(r.round_number, r.court, r.team_a, r.team_b, draft[0], draft[1])}
                        style={{ width: '100%', minHeight: 54, fontSize: 16, fontWeight: 800, borderRadius: 12, border: '1px solid #0f172a', background: '#0f172a', color: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <Save size={18} />
                        <span>Save Score</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          )}
        </>
      )}

      {/* MAIN TAB 2: STANDINGS VIEW */}
      {mainTab === 'standings' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: 24, fontWeight: 900, color: '#0f172a' }}>Championship Standings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>MW MAVERICKS</div>
                <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>12 Squad Players</div>
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a' }}>{mwScore} pts</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>SVKM CHALLENGERS</div>
                <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>12 Squad Players</div>
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a' }}>{svkmScore} pts</div>
            </div>
          </div>

          {rapidFireWinner && (
            <div style={{ marginTop: 20, padding: 18, background: '#f8fafc', border: '2px solid #0f172a', borderRadius: 12, color: '#0f172a', fontWeight: 800, fontSize: 16, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Trophy size={20} />
              <span>Rapid Fire Grand Finale Winner: {rapidFireWinner}</span>
            </div>
          )}
        </div>
      )}

      {/* MAIN TAB 3: DEEP MATCH & PLAYER ANALYTICS */}
      {mainTab === 'analytics' && (
        <MwMavericksAnalyticsView
          rounds={rounds}
          mwPlayers={MW_MAVERICKS_PLAYERS}
          svkmPlayers={SVKM_CHALLENGERS_PLAYERS}
          mwScore={mwScore}
          svkmScore={svkmScore}
        />
      )}

      {/* MAIN TAB 4: WHATSAPP SHAREABLE SCORECARD IMAGE */}
      {mainTab === 'share' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: 24, fontWeight: 900, color: '#0f172a' }}>Share Live Scorecard Image to WhatsApp</h2>
          <p style={{ fontSize: 15, color: '#64748b', marginBottom: 24 }}>
            Generates a high-res PNG image with a <b>full visible outer frame border</b> — guaranteed zero edge cropping on all 4 sides when sharing to WhatsApp.
          </p>

          <div style={{ padding: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Monday Wednesday Club · Season II</div>
            <div style={{ fontSize: 20, fontWeight: 900, margin: '6px 0', color: '#0f172a' }}>MW Mavericks vs SVKM Challengers</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '10px 0' }}>
              MW Mavericks: {mwScore} Pts | SVKM Challengers: {svkmScore} Pts
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 10 }}>
              Live Scoreboard: https://pickleball-app-two.vercel.app/tournaments/mw-mavericks
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button
              onClick={handleShareScorecardImage}
              disabled={generatingImage}
              style={{ width: '100%', minHeight: 56, fontSize: 16, fontWeight: 900, background: '#0f172a', color: '#ffffff', borderRadius: 12, border: '1px solid #0f172a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              <Smartphone size={20} />
              <span>{generatingImage ? 'Generating Image Frame...' : 'Share Scorecard PNG Image to WhatsApp'}</span>
            </button>

            <button
              onClick={() => {
                const text = `*MW MAVERICKS vs SVKM CHALLENGERS — SEASON II*\n\n*LIVE STANDINGS*:\nMW Mavericks: ${mwScore} Pts\nSVKM Challengers: ${svkmScore} Pts\n\nView Live Leaderboard & Matches:\nhttps://pickleball-app-two.vercel.app/tournaments/mw-mavericks`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              style={{ width: '100%', minHeight: 52, fontSize: 15, fontWeight: 800, background: '#f8fafc', color: '#0f172a', borderRadius: 12, border: '1px solid #cbd5e1', cursor: 'pointer' }}
            >
              Copy & Post Text Summary
            </button>
          </div>
        </div>
      )}

      {/* MAIN TAB 5: ADMIN MATCH RESET WITH SECURITY PROTOCOL */}
      {mainTab === 'admin' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: 24, fontWeight: 900, color: '#0f172a' }}>🔒 Admin Score Reset Security Console</h2>
          <p style={{ fontSize: 15, color: '#64748b', marginBottom: 24 }}>
            Restricted security console for club admins to reset match scores cleanly.
          </p>

          {!isAdminUnlocked ? (
            <div style={{ padding: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
              <KeyRound size={36} style={{ margin: '0 auto 12px auto', color: '#0f172a' }} />
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Enter Admin Security Passcode</div>
              <input
                type="password"
                placeholder="Passcode"
                value={passcodeInput}
                onChange={e => setPasscodeInput(e.target.value)}
                style={{ width: '100%', padding: 14, fontSize: 18, fontWeight: 800, textAlign: 'center', borderRadius: 10, border: '2px solid #cbd5e1', marginBottom: 16, boxSizing: 'border-box' }}
              />
              <button
                onClick={handleUnlockAdmin}
                style={{ width: '100%', minHeight: 48, fontSize: 16, fontWeight: 800, background: '#0f172a', color: '#ffffff', borderRadius: 10, border: 'none', cursor: 'pointer' }}
              >
                Unlock Console
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ padding: 16, background: '#f1f5f9', borderRadius: 10, fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                ✓ Admin Security Console Unlocked
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>Round Number (1 to 28):</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={resetMatchRound}
                    onChange={e => setResetMatchRound(Number(e.target.value))}
                    style={{ width: '100%', padding: 12, fontSize: 16, fontWeight: 800, borderRadius: 10, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>Court Number (1 to 3):</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={resetMatchCourt}
                    onChange={e => setResetMatchCourt(Number(e.target.value))}
                    style={{ width: '100%', padding: 12, fontSize: 16, fontWeight: 800, borderRadius: 10, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                onClick={handleAdminResetSingleMatch}
                style={{ width: '100%', minHeight: 52, fontSize: 16, fontWeight: 800, background: '#f8fafc', color: '#0f172a', borderRadius: 12, border: '1px solid #cbd5e1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <RotateCcw size={18} />
                <span>Reset Single Target Match</span>
              </button>

              <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 16, marginTop: 8 }}>
                <button
                  onClick={handleAdminResetEntireTournament}
                  style={{ width: '100%', minHeight: 56, fontSize: 16, fontWeight: 900, background: '#0f172a', color: '#ffffff', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                >
                  <RotateCcw size={20} />
                  <span>RESET ENTIRE TOURNAMENT TO 0-0</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MAIN TAB 6: AUDIT LOGS & SELF-HEALING RECOVERY */}
      {mainTab === 'logs' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0f172a' }}>Score Audit Logs & Self-Healing Console</h2>
              <p style={{ margin: '6px 0 0 0', fontSize: 15, color: '#64748b' }}>
                Immutable transaction audit trail saved on device.
              </p>
            </div>
            <button
              onClick={handleSelfHealingRestore}
              style={{ fontSize: 15, minHeight: 48, padding: '10px 18px', background: '#0f172a', color: '#ffffff', fontWeight: 800, borderRadius: 12, border: 'none', cursor: 'pointer' }}
            >
              Restore Audit Logs
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse', fontSize: 15, color: '#0f172a' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ ...headerStyle, width: 140 }}>Timestamp</th>
                  <th style={{ ...headerStyle, width: 100 }}>Round</th>
                  <th style={{ ...headerStyle, width: 90 }}>Court</th>
                  <th style={{ ...headerStyle, width: 300 }}>Matchup</th>
                  <th style={{ ...headerStyle, width: 110 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...cellStyle, textAlign: 'center', color: '#64748b' }}>
                      No score transaction logs recorded yet on this device.
                    </td>
                  </tr>
                ) : (
                  auditLogs.slice(0, 20).map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...cellStyle, color: '#64748b' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td style={{ ...cellStyle, fontWeight: 800 }}>Round {log.round_number}</td>
                      <td style={{ ...cellStyle }}>Court {log.court}</td>
                      <td style={{ ...cellStyle }}>{log.team_a} vs {log.team_b}</td>
                      <td style={{ ...cellStyle, fontWeight: 900, color: '#0f172a' }}>{log.score_a} – {log.score_b}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
