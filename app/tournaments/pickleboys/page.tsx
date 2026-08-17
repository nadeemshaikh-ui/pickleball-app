'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Calendar, Users, Zap, Play, BarChart2, CheckCircle2, ShieldCheck, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PickleboysStandingsTable, { type PickleboysTeamStats } from '@/components/PickleboysStandingsTable';
import PickleboysDynamicLineupSelector, { type LineupHandoffs } from '@/components/PickleboysDynamicLineupSelector';
import PickleboysRosterGrid, { OFFICIAL_PICKLEBOYS_TEAMS } from '@/components/PickleboysRosterGrid';
import AmericanoBracketFlow from '@/components/AmericanoBracketFlow';
import PickleboysOfficialMatchScorekeeper from '@/components/PickleboysOfficialMatchScorekeeper';
import { saveScoreWithFailsafe, getLocalRoundMirror, getScoreAuditLog, restoreRoundsFromAuditLog, flushOfflineQueue, type ScoreAuditLogItem } from '@/lib/tournamentOfflineSync';

interface MatchFixture {
  id: string;
  round_number: number;
  court: number;
  team_a: string[];
  team_b: string[];
  score_a: number | null;
  score_b: number | null;
}

const INITIAL_TEAMS: PickleboysTeamStats[] = OFFICIAL_PICKLEBOYS_TEAMS.map(t => ({
  id: t.id,
  name: t.name,
  captain: t.captain,
  group: t.group,
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  pf: 0,
  pa: 0,
  pd: 0,
  winPct: 0
}));

// ALL 16 TOURNAMENT MATCHES ACROSS 4 ROUNDS
const ALL_16_MATCHES = [
  // Round 1
  { id: 'm1', round: 1, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[1] },
  { id: 'm2', round: 1, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[2], teamB: OFFICIAL_PICKLEBOYS_TEAMS[3] },
  { id: 'm3', round: 1, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[4], teamB: OFFICIAL_PICKLEBOYS_TEAMS[5] },
  { id: 'm4', round: 1, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[6], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },

  // Round 2
  { id: 'm5', round: 2, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[2] },
  { id: 'm6', round: 2, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[1], teamB: OFFICIAL_PICKLEBOYS_TEAMS[3] },
  { id: 'm7', round: 2, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[4], teamB: OFFICIAL_PICKLEBOYS_TEAMS[6] },
  { id: 'm8', round: 2, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[5], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },

  // Round 3
  { id: 'm9', round: 3, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[3] },
  { id: 'm10', round: 3, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[1], teamB: OFFICIAL_PICKLEBOYS_TEAMS[2] },
  { id: 'm11', round: 3, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[4], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },
  { id: 'm12', round: 3, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[5], teamB: OFFICIAL_PICKLEBOYS_TEAMS[6] },

  // Round 4 (Cross-Group Seeding)
  { id: 'm13', round: 4, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[4] },
  { id: 'm14', round: 4, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[1], teamB: OFFICIAL_PICKLEBOYS_TEAMS[5] },
  { id: 'm15', round: 4, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[2], teamB: OFFICIAL_PICKLEBOYS_TEAMS[6] },
  { id: 'm16', round: 4, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[3], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },
];

export default function PickleboysTournamentPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<MatchFixture[]>([]);
  const [teamsStats, setTeamsStats] = useState<PickleboysTeamStats[]>(INITIAL_TEAMS);
  
  // PERSISTED SAVED LINEUPS MAP BY MATCH ID
  const [savedLineups, setSavedLineups] = useState<Record<string, {
    line1: { teamA: [string, string]; teamB: [string, string] };
    line2: { teamA: [string, string]; teamB: [string, string] };
    line3: { teamA: [string, string]; teamB: [string, string] };
    line4: { teamA: [string, string]; teamB: [string, string] };
  }>>({});

  // RE-ORGANIZED TABS SEQUENCE
  const [activeTab, setActiveTab] = useState<'teams_pools' | 'schedule' | 'lineup' | 'scoring' | 'leaderboard' | 'results' | 'analytics' | 'backup_scoring'>('teams_pools');
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);

  // Filters for Schedule & Lineup Hub
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number>(1);
  const [selectedMatch, setSelectedMatch] = useState<typeof ALL_16_MATCHES[0] | null>(null);
  const [activeOfficialScorekeeperMatch, setActiveOfficialScorekeeperMatch] = useState<typeof ALL_16_MATCHES[0] | null>(null);

  // Direct match score save handler for both Scorekeeper console & Backup Scorecard page
  async function handleDirectScoreSave(match: typeof ALL_16_MATCHES[0], scoreA: number, scoreB: number) {
    if (isViewOnly) return;
    const teamANames = (match.teamA.roster || []).map((p: any) => typeof p === 'string' ? p : p.name);
    const teamBNames = (match.teamB.roster || []).map((p: any) => typeof p === 'string' ? p : p.name);

    const updatedMatchRow = {
      id: match.id,
      session_id: 'pb_sunday_2026',
      round_number: match.round,
      court: match.court,
      team_a: teamANames,
      team_b: teamBNames,
      sitting_out: [],
      score_a: scoreA,
      score_b: scoreB
    };

    // 1. Dual-Persistence Save (Synchronous Local Mirror + Server Background Sync with Offline Queue)
    const { rounds: updatedRounds } = await saveScoreWithFailsafe('pb_sunday_2026', updatedMatchRow);

    const finalRounds = updatedRounds && updatedRounds.length > 0 ? updatedRounds : (() => {
      const existingIdx = rounds.findIndex(r => Number(r.round_number) === Number(match.round) && Number(r.court) === Number(match.court));
      return existingIdx >= 0 ? rounds.map((r, i) => i === existingIdx ? updatedMatchRow : r) : [...rounds, updatedMatchRow];
    })();

    // 2. Instant Local Re-render & Standings Recalculation
    setRounds(finalRounds as any);
    computeStandingsFromRounds(finalRounds as any);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pickleboys_completed_rounds', JSON.stringify(finalRounds));
    }
  }

  // Load cached lineups, completed round scores, and URL query params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const viewParam = params.get('mode') || params.get('viewOnly');

      // AUTOMATIC READ-ONLY ENFORCEMENT: Public leaderboard & standings links are strictly Read-Only by default!
      if (tabParam === 'leaderboard' || tabParam === 'standings' || viewParam === 'view' || viewParam === 'true') {
        setIsViewOnly(true);
      }

      const validTabs = ['teams_pools', 'schedule', 'lineup', 'scoring', 'leaderboard', 'results', 'analytics', 'backup_scoring'];
      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTab(tabParam as any);
      } else if (tabParam === 'standings') {
        setActiveTab('leaderboard');
      }
    }
  }, []);

  function handleSaveLineup(matchId: string, lineup: LineupHandoffs) {
    setSavedLineups(prev => {
      const updated = { ...prev, [matchId]: lineup };
      if (typeof window !== 'undefined') {
        localStorage.setItem('pickleboys_saved_lineups', JSON.stringify(updated));
      }
      return updated;
    });
  }

  useEffect(() => {
    async function loadTournament() {
      try {
        setSessionId('pb_sunday_2026');

        // Flush any pending offline queued score entries to server
        flushOfflineQueue('pb_sunday_2026').catch(console.error);

        let localRounds: any[] = getLocalRoundMirror('pb_sunday_2026');
        if (localRounds.length === 0 && typeof window !== 'undefined') {
          const cached = localStorage.getItem('pickleboys_completed_rounds');
          if (cached) {
            try { localRounds = JSON.parse(cached); } catch (e) {}
          }
        }

        const { data: dbRounds } = await supabase
          .from('rounds')
          .select('*')
          .eq('session_id', 'pb_sunday_2026')
          .order('round_number', { ascending: true })
          .order('court', { ascending: true });

        // Merge DB rounds with local rounds (preserves any local entries while loading server state)
        const roundMap = new Map<string, any>();
        localRounds.forEach(r => roundMap.set(`${Number(r.round_number)}_${Number(r.court)}`, r));
        (dbRounds || []).forEach(r => roundMap.set(`${Number(r.round_number)}_${Number(r.court)}`, r));

        const mergedRounds = Array.from(roundMap.values());
        if (mergedRounds.length > 0) {
          setRounds(mergedRounds);
          computeStandingsFromRounds(mergedRounds);
        }
      } catch (e) {
        console.error('Failed to load Pickleboys tournament:', e);
      }
    }

    loadTournament();
  }, []);

  function computeStandingsFromRounds(dbRounds: MatchFixture[]) {
    const statsMap = new Map<string, { mp: number; w: number; l: number; pf: number; pa: number }>();
    INITIAL_TEAMS.forEach(t => statsMap.set(t.id, { mp: 0, w: 0, l: 0, pf: 0, pa: 0 }));

    // 1. Process regular round matches first (m1..m16)
    const regularRounds = dbRounds.filter(r => Number(r.round_number) < 5);
    for (const r of regularRounds) {
      const rNum = Number(r.round_number);
      const rCourt = Number(r.court);
      const sAVal = r.score_a !== null && r.score_a !== undefined ? Number(r.score_a) : null;
      const sBVal = r.score_b !== null && r.score_b !== undefined ? Number(r.score_b) : null;

      if (sAVal !== null && sBVal !== null && (sAVal > 0 || sBVal > 0)) {
        let match = ALL_16_MATCHES.find(m => Number(m.round) === rNum && Number(m.court) === rCourt);

        let teamAId = match?.teamA.id;
        let teamBId = match?.teamB.id;

        // Fallback team lookup by team_a / team_b array names if match fixture not found
        if (!teamAId && r.team_a && r.team_a.length > 0) {
          const nameStr = Array.isArray(r.team_a) ? r.team_a[0] : String(r.team_a);
          const found = INITIAL_TEAMS.find(t => t.name === nameStr || nameStr.includes(t.name) || t.name.includes(nameStr));
          if (found) teamAId = found.id;
        }
        if (!teamBId && r.team_b && r.team_b.length > 0) {
          const nameStr = Array.isArray(r.team_b) ? r.team_b[0] : String(r.team_b);
          const found = INITIAL_TEAMS.find(t => t.name === nameStr || nameStr.includes(t.name) || t.name.includes(nameStr));
          if (found) teamBId = found.id;
        }

        if (teamAId && teamBId) {
          const sA = statsMap.get(teamAId);
          const sB = statsMap.get(teamBId);
          if (sA && sB) {
            sA.mp++;
            sB.mp++;
            sA.pf += sAVal;
            sA.pa += sBVal;
            sB.pf += sBVal;
            sB.pa += sAVal;

            if (sAVal > sBVal) {
              sA.w++;
              sB.l++;
            } else if (sBVal > sAVal) {
              sB.w++;
              sA.l++;
            }
          }
        }
      }
    }

    // Compute intermediate rankings from regular rounds to dynamically seed Gold (m17) and Bronze (m18)
    const intermediateRankings = INITIAL_TEAMS.map(t => {
      const s = statsMap.get(t.id)!;
      const pd = s.pf - s.pa;
      const winPct = s.mp > 0 ? s.w / s.mp : 0;
      return { ...t, matchesPlayed: s.mp, wins: s.w, losses: s.l, pf: s.pf, pa: s.pa, pd, winPct };
    }).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pf !== a.pf) return b.pf - a.pf;
      if (b.pd !== a.pd) return b.pd - a.pd;
      return a.id.localeCompare(b.id);
    });

    const gTeamA = intermediateRankings[0]?.id;
    const gTeamB = intermediateRankings[1]?.id;
    const bTeamA = intermediateRankings[2]?.id;
    const bTeamB = intermediateRankings[3]?.id;

    // 2. Process Round 5 Playoff matches (m17 Gold & m18 Bronze) using true dynamic seeded teams
    const playoffRounds = dbRounds.filter(r => Number(r.round_number) === 5);
    for (const r of playoffRounds) {
      const rCourt = Number(r.court);
      const sAVal = r.score_a !== null && r.score_a !== undefined ? Number(r.score_a) : null;
      const sBVal = r.score_b !== null && r.score_b !== undefined ? Number(r.score_b) : null;

      if (sAVal !== null && sBVal !== null && (sAVal > 0 || sBVal > 0)) {
        const teamAId = rCourt === 1 ? gTeamA : bTeamA;
        const teamBId = rCourt === 1 ? gTeamB : bTeamB;
        if (teamAId && teamBId) {
          const sA = statsMap.get(teamAId);
          const sB = statsMap.get(teamBId);
          if (sA && sB) {
            sA.mp++;
            sB.mp++;
            sA.pf += sAVal;
            sA.pa += sBVal;
            sB.pf += sBVal;
            sB.pa += sAVal;

            if (sAVal > sBVal) {
              sA.w++;
              sB.l++;
            } else if (sBVal > sAVal) {
              sB.w++;
              sA.l++;
            }
          }
        }
      }
    }

    const finalStats = INITIAL_TEAMS.map(t => {
      const s = statsMap.get(t.id)!;
      const pd = s.pf - s.pa;
      const winPct = s.mp > 0 ? s.w / s.mp : 0;
      return { ...t, matchesPlayed: s.mp, wins: s.w, losses: s.l, pf: s.pf, pa: s.pa, pd, winPct };
    });

    setTeamsStats(finalStats);
  }

  async function handleResetAllScores() {
    if (typeof window !== 'undefined') {
      const adminPin = window.prompt('🔒 NADEEM ADMIN SECURITY GUARD:\nEnter Admin Passcode to perform Master Data Reset:');
      if (!adminPin || (adminPin.trim().toLowerCase() !== 'nadeem' && adminPin.trim() !== '7777')) {
        alert('⛔ Access Denied! Master Data Reset is strictly restricted to Nadeem.');
        return;
      }

      const confirmReset = window.confirm('⚠️ Are you sure you want to reset ALL match scores and lineups for tournament day? This action cannot be undone.');
      if (!confirmReset) return;

      // 1. Reset state
      setRounds([]);
      setTeamsStats(INITIAL_TEAMS);
      setSavedLineups({});
      setSelectedMatch(null);
      setActiveOfficialScorekeeperMatch(null);

      // 2. Clear localStorage
      localStorage.removeItem('pickleboys_completed_rounds');
      localStorage.removeItem('pickleboys_saved_lineups');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pickleboys_live_score_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // 3. Clear Supabase DB rounds if session active
      if (sessionId) {
        try {
          await supabase.from('rounds').delete().eq('session_id', sessionId);
        } catch (e) {
          console.error('Failed to clear rounds in DB:', e);
        }
      }

      alert('✅ All match scores, lineups, and simulation data have been completely reset!');
    }
  }

  function handleShareLeaderboard() {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/tournaments/pickleboys?tab=leaderboard`;
      const text = `🏆 Live Standings & Leaderboard - Pickleboys Sunday Championship:\n${url}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
      }
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  }

  function handleShareScorekeeper() {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/tournaments/pickleboys?tab=scoring`;
      const text = `⚡ Live Scorekeeper & Tournament Hub - Pickleboys Sunday Championship:\n${url}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
      }
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  }

  const groupAStats = teamsStats.filter(t => t.group === 'A');
  const groupBStats = teamsStats.filter(t => t.group === 'B');
  const filteredMatches = ALL_16_MATCHES.filter(m => m.round === selectedRoundFilter);

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      <div className="card" style={{ marginBottom: 24, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={30} style={{ color: 'var(--gold)' }} /> Pickleboys Championship
          </h1>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {isViewOnly ? (
              <span style={{ fontSize: 13, fontWeight: 900, background: '#eff6ff', color: '#1d4ed8', border: '2px solid #1d4ed8', padding: '6px 14px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                👁️ Spectator Read-Only Mode
              </span>
            ) : (
              <>
                <button
                  onClick={handleShareScorekeeper}
                  className="btn-primary"
                  style={{ fontSize: 13, padding: '8px 14px', background: 'var(--dark)', color: '#ffffff', border: '2px solid var(--dark)', fontWeight: 800, cursor: 'pointer' }}
                >
                  ⚡ Share Scorekeeper Hub Link
                </button>

                <button
                  onClick={handleShareLeaderboard}
                  className="btn-primary"
                  style={{ fontSize: 13, padding: '8px 14px', background: '#059669', color: '#ffffff', border: '2px solid #059669', fontWeight: 800, cursor: 'pointer' }}
                >
                  📲 Share Live Standings Link
                </button>

                <button
                  onClick={handleResetAllScores}
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: '8px 14px', background: '#fff1f2', color: '#be123c', border: '2px solid #be123c', fontWeight: 800 }}
                >
                  🔒 Reset All Match Data
                </button>
              </>
            )}

            {sessionId && (
              <Link href={`/session/${sessionId}/play`} className="btn-primary" style={{ fontSize: 14, textDecoration: 'none', padding: '8px 18px' }}>
                <Play size={16} style={{ marginRight: 6 }} /> Scorekeeper
              </Link>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 16, borderTop: '2px solid var(--border)', paddingTop: 14 }}>
          <button
            onClick={() => setActiveTab('teams_pools')}
            style={{
              padding: '14px 6px',
              fontSize: 15,
              fontWeight: 900,
              borderRadius: 4,
              border: activeTab === 'teams_pools' ? '3px solid var(--dark)' : '2px solid var(--border)',
              background: activeTab === 'teams_pools' ? 'var(--dark)' : '#ffffff',
              color: activeTab === 'teams_pools' ? '#ffffff' : 'var(--foreground)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: activeTab === 'teams_pools' ? '2px 2px 0 var(--border)' : 'none'
            }}
          >
            <Users size={20} />
            <span>Teams</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            style={{
              padding: '14px 6px',
              fontSize: 15,
              fontWeight: 900,
              borderRadius: 4,
              border: activeTab === 'schedule' ? '3px solid var(--dark)' : '2px solid var(--border)',
              background: activeTab === 'schedule' ? 'var(--dark)' : '#ffffff',
              color: activeTab === 'schedule' ? '#ffffff' : 'var(--foreground)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: activeTab === 'schedule' ? '2px 2px 0 var(--border)' : 'none'
            }}
          >
            <Calendar size={20} />
            <span>Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('scoring')}
            style={{
              padding: '14px 6px',
              fontSize: 15,
              fontWeight: 900,
              borderRadius: 4,
              border: activeTab === 'scoring' ? '3px solid var(--dark)' : '2px solid var(--border)',
              background: activeTab === 'scoring' ? 'var(--dark)' : '#ffffff',
              color: activeTab === 'scoring' ? '#ffffff' : 'var(--foreground)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: activeTab === 'scoring' ? '2px 2px 0 var(--border)' : 'none'
            }}
          >
            <Zap size={20} />
            <span>Scoring</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            style={{
              padding: '14px 6px',
              fontSize: 15,
              fontWeight: 900,
              borderRadius: 4,
              border: activeTab === 'leaderboard' ? '3px solid var(--gold)' : '2px solid var(--border)',
              background: activeTab === 'leaderboard' ? 'var(--gold)' : '#ffffff',
              color: activeTab === 'leaderboard' ? '#ffffff' : 'var(--foreground)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: activeTab === 'leaderboard' ? '2px 2px 0 var(--border)' : 'none'
            }}
          >
            <Trophy size={20} />
            <span>Standings</span>
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '14px 12px',
              fontSize: 13,
              fontWeight: 900,
              borderRadius: 4,
              border: activeTab === 'analytics' ? '3px solid #b45309' : '2px solid var(--border)',
              background: activeTab === 'analytics' ? '#fef3c7' : '#ffffff',
              color: activeTab === 'analytics' ? '#b45309' : 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <BarChart2 size={18} style={{ color: '#b45309' }} />
            <span>📊 Analytics & Badges</span>
          </button>

          <button
            onClick={() => setActiveTab('backup_scoring')}
            style={{
              padding: '14px 12px',
              fontSize: 13,
              fontWeight: 900,
              borderRadius: 4,
              border: activeTab === 'backup_scoring' ? '3px solid #059669' : '2px solid var(--border)',
              background: activeTab === 'backup_scoring' ? '#dcfce7' : '#ffffff',
              color: activeTab === 'backup_scoring' ? '#059669' : 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Zap size={18} style={{ color: '#059669' }} />
            <span>📝 Direct Backup Scoring</span>
          </button>

          <button
            onClick={() => setActiveTab('recovery' as any)}
            style={{
              padding: '14px 12px',
              fontSize: 13,
              fontWeight: 900,
              borderRadius: 4,
              border: activeTab === ('recovery' as any) ? '3px solid #be123c' : '2px solid var(--border)',
              background: activeTab === ('recovery' as any) ? '#ffe4e6' : '#ffffff',
              color: activeTab === ('recovery' as any) ? '#be123c' : 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={18} style={{ color: '#be123c' }} />
            <span>🛡️ Data Recovery Console</span>
          </button>
        </div>
      </div>

      {activeTab === 'backup_scoring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 22, background: '#ffffff', borderLeft: '6px solid #059669' }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: 24, fontWeight: 900 }}>Direct Final Score Entry (Rounds 1–4 + Medal Finals)</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
              Use this page to manually record final scores for all 18 fixtures (including Gold & Bronze Medal Finals).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const masterRankings = [...teamsStats].sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (b.pf !== a.pf) return b.pf - a.pf;
                if (b.pd !== a.pd) return b.pd - a.pd;
                return a.id.localeCompare(b.id);
              });

              const goldTeamA = OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[0]?.id) || OFFICIAL_PICKLEBOYS_TEAMS[0];
              const goldTeamB = OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[1]?.id) || OFFICIAL_PICKLEBOYS_TEAMS[1];

              const bronzeTeamA = OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[3]?.id) || OFFICIAL_PICKLEBOYS_TEAMS[3];
              const bronzeTeamB = OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[2]?.id) || OFFICIAL_PICKLEBOYS_TEAMS[2];

              const goldMatch = { id: 'm17', round: 5, court: 1, teamA: goldTeamA, teamB: goldTeamB };
              const bronzeMatch = { id: 'm18', round: 5, court: 2, teamA: bronzeTeamA, teamB: bronzeTeamB };

              const all18 = [...ALL_16_MATCHES, goldMatch, bronzeMatch];

              return all18.map(m => {
                const completed = rounds.find(r => Number(r.round_number) === Number(m.round) && Number(r.court) === Number(m.court) && r.score_a !== null && r.score_b !== null);
                return (
                  <PickleboysBackupMatchCard
                    key={m.id}
                    match={m}
                    completedFixture={completed}
                    onSaveScore={(sa: number, sb: number) => handleDirectScoreSave(m, sa, sb)}
                  />
                );
              });
            })()}
          </div>
        </div>
      )}

      {activeTab === ('recovery' as any) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 22, background: '#ffffff', borderLeft: '6px solid #be123c' }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={26} style={{ color: '#be123c' }} /> Emergency Data Recovery & Audit Trail
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
              Immutable transaction log of all score entries. If any network crash or client reset occurs, tap <b>Recover Scores from Audit Log</b> below.
            </p>
          </div>

          <div className="card" style={{ padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Audit Transaction History ({getScoreAuditLog('pb_sunday_2026').length} Entries)</h3>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Stored synchronously in browser local cache</span>
              </div>
              <button
                onClick={() => {
                  const restored = restoreRoundsFromAuditLog('pb_sunday_2026');
                  if (restored.length > 0) {
                    setRounds(restored as any);
                    computeStandingsFromRounds(restored as any);
                    alert(`✅ Successfully restored ${restored.length} round scores from audit trail!`);
                  } else {
                    alert('ℹ️ No score audit log entries found on this device.');
                  }
                }}
                className="btn-primary"
                style={{ fontSize: 14, padding: '10px 18px', background: '#be123c', color: '#ffffff', fontWeight: 900, border: '2px solid #be123c', cursor: 'pointer' }}
              >
                🛡️ Recover Scores from Audit Log
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                    <th style={{ padding: '10px 12px' }}>Round / Court</th>
                    <th style={{ padding: '10px 12px' }}>Team A</th>
                    <th style={{ padding: '10px 12px' }}>Team B</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {getScoreAuditLog('pb_sunday_2026').length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontWeight: 700 }}>
                        No audit log entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    getScoreAuditLog('pb_sunday_2026').map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{new Date(item.timestamp).toLocaleTimeString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 900 }}>Round {item.round_number} (Court {item.court})</td>
                        <td style={{ padding: '10px 12px' }}>{item.team_a}</td>
                        <td style={{ padding: '10px 12px' }}>{item.team_b}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, background: '#fef3c7' }}>
                          {item.score_a} – {item.score_b}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams_pools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Pool A Teams */}
            <div className="card" style={{ padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 14px 0', borderBottom: '2px solid var(--border)', paddingBottom: 8 }}>
                Pool A Teams
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {groupAStats.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '2px solid var(--border)', borderRadius: 2, background: '#f8fafc' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--foreground)' }}>{t.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>Capt. {t.captain}</div>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 13, background: 'var(--dark)', color: '#ffffff', padding: '4px 10px', borderRadius: 2 }}>
                      {t.wins}W–{t.losses}L
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pool B Teams */}
            <div className="card" style={{ padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 14px 0', borderBottom: '2px solid var(--border)', paddingBottom: 8 }}>
                Pool B Teams
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {groupBStats.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '2px solid var(--border)', borderRadius: 2, background: '#f8fafc' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--foreground)' }}>{t.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>Capt. {t.captain}</div>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 13, background: 'var(--dark)', color: '#ffffff', padding: '4px 10px', borderRadius: 2 }}>
                      {t.wins}W–{t.losses}L
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Player Rosters Grid */}
          <PickleboysRosterGrid />
        </div>
      )}

      {/* 2. SCHEDULE PAGE REDESIGN (SS2 FIX - ZERO HORIZONTAL SIDE-SCROLL ON MOBILE) */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Instructions Header */}
          <div className="card" style={{ padding: 18, background: '#ffffff', borderLeft: '6px solid var(--primary)' }}>
            <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              OFFICIAL TOURNAMENT MASTER SCHEDULE
            </div>
            <h2 style={{ margin: '4px 0 4px 0', fontSize: 22, fontWeight: 900 }}>
              All 18 Fixtures (Rounds 1–4 + Medal Finals)
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
              Mobile-optimized match cards. Tap any round button below to jump directly to those fixtures.
            </p>

            {/* 1-Tap Round Selector Bar */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto' }}>
              {[0, 1, 2, 3, 4, 5].map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRoundFilter(r)}
                  className={`btn-${selectedRoundFilter === r ? 'primary' : 'secondary'}`}
                  style={{
                    fontSize: 14,
                    padding: '8px 16px',
                    whiteSpace: 'nowrap',
                    background: r === 5 && selectedRoundFilter === 5 ? 'var(--gold)' : undefined,
                    color: r === 5 && selectedRoundFilter === 5 ? '#ffffff' : undefined
                  }}
                >
                  {r === 0 ? 'All 18 Fixtures' : r === 5 ? '🏆 Round 5 (Medal Finals)' : r === 4 ? 'Round 4 (Cross-Group)' : `Round ${r}`}
                </button>
              ))}
            </div>
          </div>

          {/* RENDER ROUND MATCHES ACCORDING TO SELECTED ROUND FILTER */}
          {[1, 2, 3, 4].filter(r => selectedRoundFilter === 0 || selectedRoundFilter === r).map(roundNum => {
            const roundMatches = ALL_16_MATCHES.filter(m => m.round === roundNum);
            const isRound4 = roundNum === 4;

            return (
              <div key={roundNum} style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--dark)', color: '#ffffff', padding: '14px 18px', borderRadius: 4 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={20} />
                    {isRound4 ? 'Round 4 · Cross-Group Seeding Matches' : `Round ${roundNum} Fixtures (Courts 1–4)`}
                  </h3>
                  <span style={{ fontSize: 13, fontWeight: 900, background: isRound4 ? 'var(--gold)' : 'rgba(255,255,255,0.2)', color: '#ffffff', padding: '4px 10px', borderRadius: 2 }}>
                    4 Matches
                  </span>
                </div>

                {/* SPACIOUS COURT CARDS GRID - 2 COURTS VISIBLE AT A TIME ON MOBILE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {roundMatches.map(m => {
                    const saved = savedLineups[m.id];
                    const completed = rounds.find(r => r.round_number === m.round && r.court === m.court && r.score_a !== null && r.score_b !== null);
                    const isFinished = !!completed;
                    const winnerName = completed ? (completed.score_a! > completed.score_b! ? m.teamA.name : m.teamB.name) : null;

                    return (
                      <div
                        key={m.id}
                        className="card"
                        style={{
                          padding: 24,
                          minHeight: 260,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          background: '#ffffff',
                          border: isFinished ? '4px solid var(--gold)' : '3px solid var(--border)',
                          boxShadow: '6px 6px 0 var(--border)'
                        }}
                      >
                        {/* Header Badge Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ background: 'var(--dark)', color: '#ffffff', padding: '4px 10px', borderRadius: 2, fontSize: 13, fontWeight: 900 }}>
                              MATCH #{m.id.replace('m', '')}
                            </span>
                            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)' }}>
                              COURT {m.court}
                            </span>
                          </div>

                          {/* LINEUP STATUS BADGE */}
                          {saved ? (
                            <span style={{ fontSize: 13, fontWeight: 900, background: '#dcfce7', color: '#166534', border: '1px solid #166534', padding: '4px 10px', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              📋 LINEUP READY
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 900, background: '#fffbeb', color: '#b45309', border: '1px solid #b45309', padding: '4px 10px', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              ✏️ SET LINEUP
                            </span>
                          )}
                        </div>

                        {/* Large Side-by-Side Matchup Display */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '12px 0' }}>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1.2 }}>{m.teamA.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>Capt. {m.teamA.captain}</div>
                          </div>

                          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--muted)', padding: '6px 12px', background: '#f8fafc', border: '2px solid var(--border)', borderRadius: 2 }}>
                            VS
                          </div>

                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1.2 }}>{m.teamB.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>Capt. {m.teamB.captain}</div>
                          </div>
                        </div>

                        {/* Score Status Row */}
                        {isFinished && (
                          <div style={{ marginTop: 12, background: '#fefce8', border: '2px solid #b45309', padding: 10, borderRadius: 2, textAlign: 'center' }}>
                            <span style={{ fontSize: 15, fontWeight: 900, color: '#b45309' }}>
                              🏆 {winnerName} VICTORIOUS ({completed.score_a} – {completed.score_b})
                            </span>
                          </div>
                        )}

                        {/* Large 1-Tap Action Buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                          <button
                            onClick={() => {
                              setSelectedMatch(m);
                              setActiveTab('lineup');
                            }}
                            className="btn-secondary"
                            style={{ fontSize: 15, minHeight: 50, padding: '10px', fontWeight: 900, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            📋 {saved ? 'Edit Lineup' : 'Set Lineup'}
                          </button>

                          <button
                            onClick={() => {
                              if (!saved) {
                                setSelectedMatch(m);
                                setActiveTab('lineup');
                              } else {
                                setActiveOfficialScorekeeperMatch(m);
                                setActiveTab('scoring');
                              }
                            }}
                            className={saved ? 'btn-primary' : 'btn-secondary'}
                            style={{
                              fontSize: 15,
                              minHeight: 50,
                              padding: '10px',
                              fontWeight: 900,
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              background: saved ? 'var(--dark)' : '#fffbeb',
                              color: saved ? '#ffffff' : '#b45309',
                              border: saved ? '2px solid var(--dark)' : '2px solid #b45309'
                            }}
                          >
                            {saved ? '⚡ Scorekeeper →' : '🔒 Set Lineup First →'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* STAGE 2: PLAYOFF MEDAL FINALS SCHEDULE (GOLD & BRONZE MATCHES) */}
          {(selectedRoundFilter === 0 || selectedRoundFilter === 5) && (() => {
            const completedRegularMatches = rounds.filter(r => r.round_number < 5 && r.score_a !== null && r.score_b !== null && (r.score_a > 0 || r.score_b > 0));
            const isPlayoffReady = completedRegularMatches.length >= 16;

            const masterRankings = [...teamsStats].sort((a, b) => {
              if (b.wins !== a.wins) return b.wins - a.wins;
              if (b.pf !== a.pf) return b.pf - a.pf;
              if (b.pd !== a.pd) return b.pd - a.pd;
              return a.id.localeCompare(b.id);
            });

            const tbdTeam1: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_1', group: 'A', name: 'TBD (#1 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
            const tbdTeam2: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_2', group: 'A', name: 'TBD (#2 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
            const tbdTeam3: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_3', group: 'B', name: 'TBD (#3 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
            const tbdTeam4: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_4', group: 'B', name: 'TBD (#4 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };

            const goldTeamA = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[0]?.id) || tbdTeam1) : tbdTeam1;
            const goldTeamB = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[1]?.id) || tbdTeam2) : tbdTeam2;

            const bronzeTeamA = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[2]?.id) || tbdTeam3) : tbdTeam3;
            const bronzeTeamB = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[3]?.id) || tbdTeam4) : tbdTeam4;

            const medalMatches = [
              {
                id: 'm17',
                round: 5,
                court: 1,
                badge: '🥇 GOLD MEDAL FINAL',
                title: 'Gold Medal Championship (1st & 2nd Place)',
                bgHeader: 'var(--gold)',
                teamA: goldTeamA,
                teamB: goldTeamB,
                rankAText: isPlayoffReady ? `#1 Ranked Team (${masterRankings[0]?.wins}W–${masterRankings[0]?.losses}L)` : '#1 Seed Pending',
                rankBText: isPlayoffReady ? `#2 Ranked Team (${masterRankings[1]?.wins}W–${masterRankings[1]?.losses}L)` : '#2 Seed Pending'
              },
              {
                id: 'm18',
                round: 5,
                court: 2,
                badge: '🥉 BRONZE MEDAL PLAYOFF',
                title: 'Bronze Medal Match (3rd & 4th Place)',
                bgHeader: '#c2410c',
                teamA: bronzeTeamA,
                teamB: bronzeTeamB,
                rankAText: isPlayoffReady ? `#3 Ranked Team (${masterRankings[2]?.wins}W–${masterRankings[2]?.losses}L)` : '#3 Seed Pending',
                rankBText: isPlayoffReady ? `#4 Ranked Team (${masterRankings[3]?.wins}W–${masterRankings[3]?.losses}L)` : '#4 Seed Pending'
              }
            ];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)', color: '#ffffff', padding: '16px 20px', borderRadius: 4, boxShadow: '4px 4px 0 var(--border)' }}>
                  <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Trophy size={24} style={{ color: '#fef08a' }} /> STAGE 2: PLAYOFF MEDAL FINALS SCHEDULE
                  </h3>
                  <span style={{ fontSize: 13, fontWeight: 900, background: '#fef08a', color: '#78350f', padding: '4px 12px', borderRadius: 2 }}>
                    2 Championship Matches
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {medalMatches.map(m => {
                    const saved = savedLineups[m.id];
                    const completed = rounds.find(r => r.round_number === m.round && r.court === m.court && r.score_a !== null && r.score_b !== null);
                    const isFinished = !!completed;
                    const winnerName = completed ? (completed.score_a! > completed.score_b! ? m.teamA.name : m.teamB.name) : null;

                    return (
                      <div
                        key={m.id}
                        className="card"
                        style={{
                          padding: 24,
                          minHeight: 280,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          background: '#ffffff',
                          border: `4px solid ${m.bgHeader}`,
                          boxShadow: '6px 6px 0 var(--border)'
                        }}
                      >
                        {/* Header Badge Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ background: m.bgHeader, color: '#ffffff', padding: '4px 12px', borderRadius: 2, fontSize: 13, fontWeight: 900 }}>
                              {m.badge}
                            </span>
                            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)' }}>
                              COURT {m.court}
                            </span>
                          </div>

                          {saved ? (
                            <span style={{ fontSize: 13, fontWeight: 900, background: '#dcfce7', color: '#166534', border: '1px solid #166534', padding: '4px 10px', borderRadius: 2 }}>
                              📋 LINEUP READY
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 900, background: '#fffbeb', color: '#b45309', border: '1px solid #b45309', padding: '4px 10px', borderRadius: 2 }}>
                              ✏️ SET LINEUP
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>
                          {m.title}
                        </div>

                        {/* Large Side-by-Side Matchup Display */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '12px 0' }}>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1.2 }}>{m.teamA.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>{m.rankAText}</div>
                          </div>

                          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--muted)', padding: '8px 14px', background: '#f8fafc', border: '2px solid var(--border)', borderRadius: 2 }}>
                            VS
                          </div>

                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1.2 }}>{m.teamB.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>{m.rankBText}</div>
                          </div>
                        </div>

                        {/* Score Status Row */}
                        {isFinished && (
                          <div style={{ marginTop: 12, background: '#fefce8', border: '2px solid #b45309', padding: 12, borderRadius: 2, textAlign: 'center' }}>
                            <span style={{ fontSize: 16, fontWeight: 900, color: '#b45309' }}>
                              🏆 {winnerName} VICTORIOUS ({completed.score_a} – {completed.score_b})
                            </span>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                          <button
                            onClick={() => {
                              if (isViewOnly) return;
                              setSelectedMatch(m);
                              setActiveTab('lineup');
                            }}
                            disabled={isViewOnly}
                            className="btn-secondary"
                            style={{ fontSize: 15, minHeight: 50, padding: '10px', fontWeight: 900, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: isViewOnly ? 0.6 : 1, cursor: isViewOnly ? 'not-allowed' : 'pointer' }}
                          >
                            📋 {isViewOnly ? 'View Lineup' : saved ? 'Edit Lineup' : 'Set Lineup'}
                          </button>

                          <button
                            onClick={() => {
                              if (isViewOnly) return;
                              if (!saved) {
                                setSelectedMatch(m);
                                setActiveTab('lineup');
                              } else {
                                setActiveOfficialScorekeeperMatch(m);
                                setActiveTab('scoring');
                              }
                            }}
                            disabled={isViewOnly}
                            className={saved ? 'btn-primary' : 'btn-secondary'}
                            style={{
                              fontSize: 15,
                              minHeight: 50,
                              padding: '10px',
                              fontWeight: 900,
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              background: isViewOnly ? '#9ca3af' : saved ? 'var(--dark)' : '#fffbeb',
                              color: isViewOnly ? '#ffffff' : saved ? '#ffffff' : '#b45309',
                              border: isViewOnly ? '2px solid #9ca3af' : saved ? '2px solid var(--dark)' : '2px solid #b45309',
                              opacity: isViewOnly ? 0.6 : 1,
                              cursor: isViewOnly ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isViewOnly ? '👁️ Read-Only' : saved ? '⚡ Scorekeeper →' : '🔒 Set Lineup First →'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 3. LINEUPS HUB (SS3 FIX - STRUCTURED SIDE-BY-SIDE TABLE FOR SAVED LINEUPS) */}
      {activeTab === 'lineup' && (
        <div>
          {!selectedMatch ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                {[1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => setSelectedRoundFilter(r)}
                    className={`btn-${selectedRoundFilter === r ? 'primary' : 'secondary'}`}
                    style={{ fontSize: 14, padding: '8px 16px', whiteSpace: 'nowrap', background: r === 5 && selectedRoundFilter === 5 ? 'var(--gold)' : undefined, color: r === 5 && selectedRoundFilter === 5 ? '#ffffff' : undefined }}
                  >
                    {r === 5 ? '🏆 Round 5 (Medal Finals)' : r === 4 ? 'Round 4 Matches (13–16)' : `Round ${r} Matches (${(r - 1) * 4 + 1}–${r * 4})`}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(() => {
                  const completedRegularMatches = rounds.filter(r => r.round_number < 5 && r.score_a !== null && r.score_b !== null && (r.score_a > 0 || r.score_b > 0));
                  const isPlayoffReady = completedRegularMatches.length >= 16;

                  const masterRankings = [...teamsStats].sort((a, b) => {
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    if (b.pf !== a.pf) return b.pf - a.pf;
                    if (b.pd !== a.pd) return b.pd - a.pd;
                    return a.id.localeCompare(b.id);
                  });

                  const tbdTeam1: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_1', group: 'A', name: 'TBD (#1 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
                  const tbdTeam2: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_2', group: 'A', name: 'TBD (#2 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
                  const tbdTeam3: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_3', group: 'B', name: 'TBD (#3 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
                  const tbdTeam4: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_4', group: 'B', name: 'TBD (#4 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };

                  const goldTeamA = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[0]?.id) || tbdTeam1) : tbdTeam1;
                  const goldTeamB = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[1]?.id) || tbdTeam2) : tbdTeam2;
                  const bronzeTeamA = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[2]?.id) || tbdTeam3) : tbdTeam3;
                  const bronzeTeamB = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[3]?.id) || tbdTeam4) : tbdTeam4;

                  const goldMatch = { id: 'm17', round: 5, court: 1, teamA: goldTeamA, teamB: goldTeamB };
                  const bronzeMatch = { id: 'm18', round: 5, court: 2, teamA: bronzeTeamA, teamB: bronzeTeamB };

                  const all18Matches = [...ALL_16_MATCHES, goldMatch, bronzeMatch];
                  const activeRoundMatches = all18Matches.filter(m => m.round === selectedRoundFilter);

                  return activeRoundMatches.map(m => {
                    const saved = savedLineups[m.id];
                    return (
                      <div key={m.id} className="card" style={{ padding: 18, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--foreground)' }}>
                          COURT {m.court} · MATCH #{m.id.replace('m', '')}
                        </span>
                        {saved ? (
                          <span style={{ fontSize: 12, fontWeight: 900, background: '#dcfce7', color: '#166534', border: '1px solid #166534', padding: '3px 8px', borderRadius: 2 }}>
                            🔒 LINEUP LOCKED & READY
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 900, background: '#fffbeb', color: '#b45309', border: '1px solid #b45309', padding: '3px 8px', borderRadius: 2 }}>
                            ⚠️ PENDING CAPTAIN SELECTION
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 18, fontWeight: 900, textAlign: 'center', marginBottom: 10 }}>
                        {m.teamA.name} vs {m.teamB.name}
                      </div>

                      {/* SS3 FIX: STRUCTURED SIDE-BY-SIDE TABLE FOR SAVED LINEUP (PLAYERS STACKED WITH VS IN MIDDLE) */}
                      {saved && (
                        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#f8fafc', border: '1px solid var(--border)' }}>
                            <thead>
                              <tr style={{ background: '#e2e8f0', borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '8px', fontWeight: 900 }}>Line Segment</th>
                                <th style={{ padding: '8px', fontWeight: 900 }}>{m.teamA.name} Players</th>
                                <th style={{ padding: '8px', fontWeight: 900, textAlign: 'center' }}>VS</th>
                                <th style={{ padding: '8px', fontWeight: 900 }}>{m.teamB.name} Players</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)' }}>Line 1 (0–15 Pts)</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line1.teamA[0]}</div>
                                  <div>{saved.line1.teamA[1]}</div>
                                </td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)', textAlign: 'center' }}>VS</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line1.teamB[0]}</div>
                                  <div>{saved.line1.teamB[1]}</div>
                                </td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)' }}>Line 2 (15–30 Pts)</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line2.teamA[0]}</div>
                                  <div>{saved.line2.teamA[1]}</div>
                                </td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)', textAlign: 'center' }}>VS</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line2.teamB[0]}</div>
                                  <div>{saved.line2.teamB[1]}</div>
                                </td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)' }}>Line 3 (30–44 Pts)</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line3.teamA[0]}</div>
                                  <div>{saved.line3.teamA[1]}</div>
                                </td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)', textAlign: 'center' }}>VS</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line3.teamB[0]}</div>
                                  <div>{saved.line3.teamB[1]}</div>
                                </td>
                              </tr>
                              <tr>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)' }}>Line 4 (45–51 Pts)</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line4.teamA[0]}</div>
                                  <div>{saved.line4.teamA[1]}</div>
                                </td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--muted)', textAlign: 'center' }}>VS</td>
                                <td style={{ padding: '8px', fontWeight: 900, color: 'var(--foreground)' }}>
                                  <div>{saved.line4.teamB[0]}</div>
                                  <div>{saved.line4.teamB[1]}</div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      <button onClick={() => setSelectedMatch(m)} className="btn-primary" style={{ width: '100%', fontSize: 14, minHeight: 40, fontWeight: 900 }}>
                        {saved ? '📋 Edit Lineup Schedule' : '📋 Set Lineup Schedule →'}
                      </button>
                    </div>
                  );
                });
              })()}
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => setSelectedMatch(null)} className="btn-secondary" style={{ marginBottom: 12, fontSize: 14, minHeight: 36 }}>
                ← Back to Match List
              </button>
              <PickleboysDynamicLineupSelector
                teamA={{ teamName: selectedMatch.teamA.name, captain: selectedMatch.teamA.captain, players: selectedMatch.teamA.roster }}
                teamB={{ teamName: selectedMatch.teamB.name, captain: selectedMatch.teamB.captain, players: selectedMatch.teamB.roster }}
                onConfirmLineup={lineup => {
                  handleSaveLineup(selectedMatch.id, lineup);
                  setSelectedMatch(null);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. SCORING TAB (CLEAN MATCH LAUNCHERS ONLY - NO LEADERBOARD ON THIS TAB) */}
      {activeTab === 'scoring' && (
        <div>
          {!activeOfficialScorekeeperMatch ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Instructions Header */}
              <div className="card" style={{ padding: 18, background: '#ffffff', borderLeft: '6px solid var(--primary)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em' }}>
                  OFFICIAL MATCH SCOREKEEPERS HUB
                </div>
                <h2 style={{ margin: '4px 0 6px 0', fontSize: 22, fontWeight: 900 }}>
                  Select Your Court Match Below
                </h2>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
                  Tap your court match below to launch your dedicated single-match scoring sheet. Each court scorer handles 1 match at a time on their phone.
                </p>

                {/* Round Selector Bar */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto' }}>
                  {[1, 2, 3, 4, 5].map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRoundFilter(r)}
                      className={`btn-${selectedRoundFilter === r ? 'primary' : 'secondary'}`}
                      style={{ fontSize: 14, padding: '8px 18px', whiteSpace: 'nowrap', background: r === 5 && selectedRoundFilter === 5 ? 'var(--gold)' : undefined, color: r === 5 && selectedRoundFilter === 5 ? '#ffffff' : undefined }}
                    >
                      {r === 5 ? '🏆 Round 5 (Medal Finals)' : r === 4 ? 'Round 4 (Cross-Group)' : `Round ${r} Matches`}
                    </button>
                  ))}
                </div>
              </div>

              {/* CLEAN MATCH LAUNCHER CARDS FOR COURTS 1–4 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {(() => {
                  const completedRegularMatches = rounds.filter(r => r.round_number < 5 && r.score_a !== null && r.score_b !== null && (r.score_a > 0 || r.score_b > 0));
                  const isPlayoffReady = completedRegularMatches.length >= 16;

                  const masterRankings = [...teamsStats].sort((a, b) => {
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    if (b.pf !== a.pf) return b.pf - a.pf;
                    if (b.pd !== a.pd) return b.pd - a.pd;
                    return a.id.localeCompare(b.id);
                  });

                  const tbdTeam1: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_1', group: 'A', name: 'TBD (#1 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
                  const tbdTeam2: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_2', group: 'A', name: 'TBD (#2 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
                  const tbdTeam3: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_3', group: 'B', name: 'TBD (#3 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
                  const tbdTeam4: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_4', group: 'B', name: 'TBD (#4 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };

                  const goldTeamA = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[0]?.id) || tbdTeam1) : tbdTeam1;
                  const goldTeamB = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[1]?.id) || tbdTeam2) : tbdTeam2;
                  const bronzeTeamA = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[3]?.id) || tbdTeam4) : tbdTeam4;
                  const bronzeTeamB = isPlayoffReady ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[2]?.id) || tbdTeam3) : tbdTeam3;

                  const goldMatch = { id: 'm17', round: 5, court: 1, teamA: goldTeamA, teamB: goldTeamB };
                  const bronzeMatch = { id: 'm18', round: 5, court: 2, teamA: bronzeTeamA, teamB: bronzeTeamB };

                  const all18Matches = [...ALL_16_MATCHES, goldMatch, bronzeMatch];
                  const activeRoundMatches = all18Matches.filter(m => m.round === selectedRoundFilter);

                  return activeRoundMatches.map(m => {
                    const saved = savedLineups[m.id];
                    const completed = rounds.find(r => r.round_number === m.round && r.court === m.court && r.score_a !== null && r.score_b !== null);
                    const isFinished = !!completed;
                    const winnerName = completed ? (completed.score_a! > completed.score_b! ? m.teamA.name : m.teamB.name) : null;

                    return (
                      <div key={m.id} className="card" style={{ padding: 18, background: '#ffffff', borderTop: isFinished ? '6px solid var(--gold)' : '6px solid var(--dark)', boxShadow: '4px 4px 0 var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase' }}>
                          COURT {m.court}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 900, background: isFinished ? 'var(--gold)' : 'var(--dark)', color: '#ffffff', padding: '2px 8px', borderRadius: 2 }}>
                          {isFinished ? 'COMPLETED' : `MATCH #${m.id.replace('m', '')}`}
                        </span>
                      </div>

                      <div style={{ fontSize: 18, fontWeight: 900, textAlign: 'center', marginTop: 4 }}>
                        {m.teamA.name} vs {m.teamB.name}
                      </div>

                      {isFinished ? (
                        <div style={{ marginTop: 10, background: '#fef3c7', border: '2px solid #b45309', padding: 10, borderRadius: 2, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: '#b45309', textTransform: 'uppercase' }}>
                            🏆 {winnerName} VICTORIOUS!
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#b45309', marginTop: 2 }}>
                            Final Score: {completed.score_a} – {completed.score_b}
                          </div>
                        </div>
                      ) : saved ? (
                        <div style={{ marginTop: 10, background: '#dcfce7', padding: 8, borderRadius: 2, fontSize: 12, fontWeight: 900, color: '#166534', textAlign: 'center' }}>
                          ✓ Captain Lineup Saved
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#b45309', fontWeight: 900, background: '#fffbeb', padding: 8, borderRadius: 2, textAlign: 'center' }}>
                          ⚠️ Lineup Pending Captain Selection
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (!saved && !isFinished) {
                            setSelectedMatch(m);
                            setActiveTab('lineup');
                          } else {
                            setActiveOfficialScorekeeperMatch(m);
                          }
                        }}
                        className={isFinished ? 'btn-secondary' : saved ? 'btn-primary' : 'btn-secondary'}
                        style={{
                          marginTop: 14,
                          width: '100%',
                          fontSize: 15,
                          minHeight: 48,
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: isFinished ? '#ffffff' : saved ? 'var(--dark)' : '#fffbeb',
                          color: isFinished ? 'var(--foreground)' : saved ? '#ffffff' : '#b45309',
                          border: isFinished ? '2px solid var(--border)' : saved ? '2px solid var(--dark)' : '2px solid #b45309'
                        }}
                      >
                        <ShieldCheck size={18} /> {isFinished ? `↩ Reopen Court ${m.court} Scorekeeper` : saved ? `Open Court ${m.court} Scoring Sheet →` : `🔒 Lineup Pending · Set Lineup First →`}
                      </button>
                    </div>
                  );
                });
              })()}
              </div>
            </div>
          ) : (
            /* DEDICATED FULL-SCREEN SINGLE-MATCH SCOREKEEPER CONSOLE */
            <PickleboysOfficialMatchScorekeeper
              matchId={activeOfficialScorekeeperMatch.id}
              roundNumber={activeOfficialScorekeeperMatch.round}
              courtNumber={activeOfficialScorekeeperMatch.court}
              teamAName={activeOfficialScorekeeperMatch.teamA.name}
              teamBName={activeOfficialScorekeeperMatch.teamB.name}
              teamARoster={activeOfficialScorekeeperMatch.teamA.roster}
              teamBRoster={activeOfficialScorekeeperMatch.teamB.roster}
              lineup={savedLineups[activeOfficialScorekeeperMatch.id]}
              onBack={() => setActiveOfficialScorekeeperMatch(null)}
              onLockLineupRequest={() => {
                setSelectedMatch(activeOfficialScorekeeperMatch);
                setActiveOfficialScorekeeperMatch(null);
                setActiveTab('schedule');
              }}
              onMatchComplete={async (sA, sB) => {
                const match = activeOfficialScorekeeperMatch;
                if (!match) return;
                await handleDirectScoreSave(match, sA, sB);
                setActiveOfficialScorekeeperMatch(null);
              }}
            />
          )}
        </div>
      )}

      {/* 5. DEDICATED LIVE LEADERBOARD & STANDINGS TAB */}
      {activeTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 18, background: '#ffffff', borderLeft: '6px solid var(--gold)' }}>
            <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              OFFICIAL LIVE TOURNAMENT STANDINGS
            </div>
            <h2 style={{ margin: '4px 0 6px 0', fontSize: 22, fontWeight: 900 }}>
              Live Top 8 Team Leaderboard & Playoff Tree
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
              Tiebreaker hierarchy: 1st Max Wins (W) → 2nd Points Taken (PF) → 3rd Point Differential (PD).
            </p>
          </div>

          {/* Master Standings Table */}
          <PickleboysStandingsTable teams={teamsStats} sessionId={sessionId || undefined} />

          {/* Graphical Playoff Tree */}
          <AmericanoBracketFlow teams={teamsStats} sessionId={sessionId || undefined} />

          {/* 🌟 1-TAP PLAYOFF MEDAL FINALS AUTO-CREATION & SCHEDULING BANNER */}
          {(() => {
            const completedRegularMatches = rounds.filter(r => r.round_number < 5 && r.score_a !== null && r.score_b !== null && (r.score_a > 0 || r.score_b > 0));
            const isAllRegularComplete = completedRegularMatches.length >= 16;

            const masterRankings = [...teamsStats].sort((a, b) => {
              if (b.wins !== a.wins) return b.wins - a.wins;
              if (b.pf !== a.pf) return b.pf - a.pf;
              if (b.pd !== a.pd) return b.pd - a.pd;
              return a.id.localeCompare(b.id);
            });

            const tbdTeam1: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_1', group: 'A', name: 'TBD (#1 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
            const tbdTeam2: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_2', group: 'A', name: 'TBD (#2 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
            const tbdTeam3: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_3', group: 'B', name: 'TBD (#3 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };
            const tbdTeam4: typeof OFFICIAL_PICKLEBOYS_TEAMS[0] = { id: 'tbd_4', group: 'B', name: 'TBD (#4 Seed)', captain: 'Pending Round 1–4 Results', roster: [] };

            const goldTeamA = isAllRegularComplete ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[0]?.id) || tbdTeam1) : tbdTeam1;
            const goldTeamB = isAllRegularComplete ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[1]?.id) || tbdTeam2) : tbdTeam2;
            const bronzeTeamA = isAllRegularComplete ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[2]?.id) || tbdTeam3) : tbdTeam3;
            const bronzeTeamB = isAllRegularComplete ? (OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === masterRankings[3]?.id) || tbdTeam4) : tbdTeam4;

            return (
              <div className="card" style={{ padding: 22, background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '3px solid #b45309', boxShadow: '6px 6px 0 #b45309' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#b45309', color: '#ffffff', padding: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={28} color="#ffffff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {isAllRegularComplete ? '🎉 REGULAR SEASON COMPLETED (16/16 MATCHES PLAYED)' : `⏳ REGULAR SEASON IN PROGRESS (${completedRegularMatches.length}/16 MATCHES PLAYED)`}
                    </div>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: 20, fontWeight: 900, color: '#78350f' }}>
                      {isAllRegularComplete ? 'Top 4 Playoff Seeding Decided!' : 'Top 4 Playoff Seeding Pending Round 1–4 Completion'}
                    </h3>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 16 }}>
                  {/* Gold Match Card Preview */}
                  <div style={{ background: '#ffffff', padding: 16, border: '2px solid #b45309', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#b45309', textTransform: 'uppercase' }}>🥇 GOLD MEDAL FINAL · COURT 1</div>
                    <div style={{ fontSize: 16, fontWeight: 900, marginTop: 6, color: 'var(--foreground)' }}>
                      {goldTeamA.name} vs {goldTeamB.name}
                    </div>
                  </div>
                  {/* Bronze Match Card Preview */}
                  <div style={{ background: '#ffffff', padding: 16, border: '2px solid #b45309', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#b45309', textTransform: 'uppercase' }}>🥉 BRONZE MEDAL PLAYOFF · COURT 2</div>
                    <div style={{ fontSize: 16, fontWeight: 900, marginTop: 6, color: 'var(--foreground)' }}>
                      {bronzeTeamA.name} vs {bronzeTeamB.name}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!isAllRegularComplete) return;
                    setSelectedRoundFilter(5);
                    setActiveTab('schedule');
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  disabled={!isAllRegularComplete}
                  style={{
                    marginTop: 18,
                    width: '100%',
                    padding: '14px 20px',
                    fontSize: 16,
                    fontWeight: 900,
                    background: isAllRegularComplete ? '#b45309' : '#9ca3af',
                    color: '#ffffff',
                    border: '3px solid var(--dark)',
                    boxShadow: '4px 4px 0 var(--dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    cursor: isAllRegularComplete ? 'pointer' : 'not-allowed',
                    opacity: isAllRegularComplete ? 1 : 0.7
                  }}
                >
                  <Zap size={22} /> {isAllRegularComplete ? '🚀 CREATE & LAUNCH PLAYOFF MEDAL FINALS SCHEDULE →' : '🔒 PLAYOFF SEEDING PENDING · COMPLETE ROUNDS 1–4 FIRST'}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* 6. MATCH RESULTS */}
      {activeTab === 'results' && (
        <div className="card" style={{ padding: 18 }}>
          {rounds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rounds.map((r, idx) => (
                <div key={r.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', border: '2px solid var(--border)', background: '#ffffff' }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Round {r.round_number} · Court {r.court}</span>
                  <span style={{ fontWeight: 900, fontSize: 15 }}>{r.score_a !== null ? `${r.score_a} – ${r.score_b}` : 'Scheduled'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Matches scheduled for Sunday session. Results update live.</div>
          )}
        </div>
      )}

      {/* 7. EXHAUSTIVE 30-METRIC MASTER ANALYTICS & BADGES PAGE */}
      {activeTab === 'analytics' && (() => {
        const totalPts = teamsStats.reduce((acc, t) => acc + t.pf, 0);
        const totalMatchesPlayed = rounds.filter(r => r.score_a !== null && r.score_b !== null).length;
        const avgMargin = totalMatchesPlayed > 0 ? (teamsStats.reduce((acc, t) => acc + Math.abs(t.pd), 0) / (totalMatchesPlayed * 2)).toFixed(1) : '0.0';

        const groupAPts = groupAStats.reduce((acc, t) => acc + t.pf, 0);
        const groupBPts = groupBStats.reduce((acc, t) => acc + t.pf, 0);
        const groupAWins = groupAStats.reduce((acc, t) => acc + t.wins, 0);
        const groupBWins = groupBStats.reduce((acc, t) => acc + t.wins, 0);

        const goldenDinkers = [...teamsStats].sort((a, b) => b.pf - a.pf)[0];
        const ironWall = [...teamsStats].sort((a, b) => a.pa - b.pa)[0];
        const dominanceAward = [...teamsStats].sort((a, b) => b.pd - a.pd)[0];
        const captainDependable = [...teamsStats].sort((a, b) => b.wins - a.wins)[0];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header Banner */}
            <div className="card" style={{ padding: 22, background: '#ffffff', borderLeft: '6px solid #b45309' }}>
              <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.08em' }}>
                OFFICIAL TOURNAMENT ANALYTICS HUB
              </div>
              <h2 style={{ margin: '4px 0 6px 0', fontSize: 26, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
                <BarChart2 size={28} style={{ color: '#b45309' }} /> Analytics
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
                Exhaustive suite of 30 specialized analytical metrics across 6 performance domains & fun achievement badges.
              </p>
            </div>

            {/* TOP METRICS SUMMARY CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="card" style={{ padding: 16, background: '#ffffff', textAlign: 'center', borderTop: '4px solid var(--primary)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>1. Total Points Scored</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary)', marginTop: 4 }}>{totalPts}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>Across all court fixtures</div>
              </div>

              <div className="card" style={{ padding: 16, background: '#ffffff', textAlign: 'center', borderTop: '4px solid var(--gold)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>2. Completed Fixtures</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--gold)', marginTop: 4 }}>{totalMatchesPlayed} / 16</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>51-Pt Rapid Fire Format</div>
              </div>

              <div className="card" style={{ padding: 16, background: '#ffffff', textAlign: 'center', borderTop: '4px solid #059669' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>3. Avg Victory Margin</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#059669', marginTop: 4 }}>{avgMargin} pts</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>Per finished match</div>
              </div>

              <div className="card" style={{ padding: 16, background: '#ffffff', textAlign: 'center', borderTop: '4px solid var(--dark)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase' }}>4. Pool A vs Pool B Battle</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', marginTop: 8 }}>
                  Pool A ({groupAWins}W) vs Pool B ({groupBWins}W)
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>
                  {groupAPts} pts vs {groupBPts} pts
                </div>
              </div>
            </div>

            {/* FUN BADGES & ACHIEVEMENTS GALLERY */}
            <div className="card" style={{ padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
                <Trophy size={22} style={{ color: 'var(--gold)' }} /> Official Tournament Achievements & Fun Badges
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {/* Badge 1: Golden Dinkers */}
                <div style={{ background: '#fefce8', border: '2px solid #b45309', padding: 14, borderRadius: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🥇 GOLDEN DINKERS BADGE
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', marginTop: 4 }}>
                    {goldenDinkers?.name || 'TBD'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>
                    Highest Offensive Firepower: <strong style={{ color: '#b45309' }}>{goldenDinkers?.pf || 0} Points Scored</strong>
                  </div>
                </div>

                {/* Badge 2: The Iron Wall */}
                <div style={{ background: '#f0fdf4', border: '2px solid #059669', padding: 14, borderRadius: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🛡️ THE IRON WALL BADGE
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', marginTop: 4 }}>
                    {ironWall?.name || 'TBD'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>
                    Best Defensive Wall: <strong style={{ color: '#059669' }}>Fewest Points Conceded ({ironWall?.pa || 0} PA)</strong>
                  </div>
                </div>

                {/* Badge 3: Dominance Award */}
                <div style={{ background: '#f8fafc', border: '2px solid var(--dark)', padding: 14, borderRadius: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--dark)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚡ POINT DIFFERENTIAL KING
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', marginTop: 4 }}>
                    {dominanceAward?.name || 'TBD'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>
                    Highest Court Spread: <strong style={{ color: 'var(--dark)' }}>{dominanceAward?.pd > 0 ? `+${dominanceAward.pd}` : dominanceAward?.pd || 0} PD</strong>
                  </div>
                </div>

                {/* Badge 4: Captain Dependable */}
                <div style={{ background: '#eff6ff', border: '2px solid #0284c7', padding: 14, borderRadius: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    👑 CAPTAIN DEPENDABLE
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', marginTop: 4 }}>
                    Capt. {captainDependable?.captain || 'TBD'} ({captainDependable?.name})
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>
                    Top Leadership Record: <strong style={{ color: '#0369a1' }}>{captainDependable?.wins || 0} Match Wins</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 30 ANALYTICAL METRICS GRID BY CATEGORY */}
            <div className="card" style={{ padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px 0', borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
                📈 Complete 30-Metric Analytics Catalog
              </h3>

              {/* Category I: Team Performance & Win Metrics (1-6) */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)', margin: '0 0 10px 0' }}>
                  Category I: Team Performance & Win Metrics (Metrics 1–6)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>1. Match Win%</strong>: Percentage of played matches won.
                  </div>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>2. Point Differential (PD)</strong>: Net score differential (PF - PA).
                  </div>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>3. Avg Win Margin</strong>: Average lead in victories.
                  </div>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>4. Avg Loss Deficit</strong>: Average points deficit in losses.
                  </div>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>5. Dominance Ratio (DR)</strong>: Ratio of Points Scored to Conceded.
                  </div>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>6. Clean Sheet Count</strong>: Matches holding opponents under 35 pts.
                  </div>
                </div>
              </div>

              {/* Category II: Point Scoring & Offensive Efficiency (7-12) */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: '#b45309', margin: '0 0 10px 0' }}>
                  Category II: Point Scoring & Offensive Efficiency (Metrics 7–12)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
                    <strong>7. PF Per Match</strong>: Average points scored per game.
                  </div>
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
                    <strong>8. Scoring Pace</strong>: Points scored per minute of court play.
                  </div>
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
                    <strong>9. 51-Pt Rush Speed</strong>: Fast game completion pace.
                  </div>
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
                    <strong>10. Peak Line Run</strong>: Longest scoring streak without service loss.
                  </div>
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
                    <strong>11. Line Win Rate</strong>: % of 15-point line segments won.
                  </div>
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2 }}>
                    <strong>12. Golden Point Win Rate</strong>: Sudden-death 50-50 conversion.
                  </div>
                </div>
              </div>

              {/* Category III: Defensive Rigidity & Point Concession (13-18) */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: '#059669', margin: '0 0 10px 0' }}>
                  Category III: Defensive Rigidity & Point Concession (Metrics 13–18)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    <strong>13. PA Per Match</strong>: Average points conceded per game.
                  </div>
                  <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    <strong>14. Defensive Efficiency</strong>: Points suppressed below 51 pts.
                  </div>
                  <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    <strong>15. Shutout Line Count</strong>: Holding opponents under 5 pts in a line.
                  </div>
                  <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    <strong>16. Break Point Defense</strong>: Halting opponent 4+ point runs.
                  </div>
                  <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    <strong>17. Side-Change Recovery</strong>: Performance after 25-pt court swap.
                  </div>
                  <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                    <strong>18. Opponent Point Ceiling</strong>: Holding opponents under 45 pts.
                  </div>
                </div>
              </div>

              {/* Category IV: Line-by-Line Rotation Dynamics (19-24) */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: '#0369a1', margin: '0 0 10px 0' }}>
                  Category IV: Line-by-Line Rotation & Segment Dynamics (Metrics 19–24)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                    <strong>19. Line 1 Opening Momentum</strong>: Lead created by Line 1 (0-14 pts).
                  </div>
                  <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                    <strong>20. Line 2 Transition Shift</strong>: Differential generated by Line 2 (15-29 pts).
                  </div>
                  <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                    <strong>21. Line 3 Defense Shift</strong>: Differential generated by Line 3 (30-44 pts).
                  </div>
                  <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                    <strong>22. Line 4 Closing Sprint</strong>: Differential generated by Line 4 (45-51 pts).
                  </div>
                  <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                    <strong>23. Top Duo Pair</strong>: Highest performing 2-player combination.
                  </div>
                  <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                    <strong>24. Lineup Synergy Index</strong>: Consistency across all 4 line shifts.
                  </div>
                </div>
              </div>

              {/* Category V: Clutch & Crunch-Time Metrics (25-28) */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: '#7c3aed', margin: '0 0 10px 0' }}>
                  Category V: Clutch & Crunch-Time Metrics (Metrics 25–28)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 2 }}>
                    <strong>25. Clutch Win%</strong>: Win rate in games decided by 5 pts or fewer.
                  </div>
                  <div style={{ padding: 12, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 2 }}>
                    <strong>26. Comeback Victory Rate</strong>: Winning after trailing at 25 pts.
                  </div>
                  <div style={{ padding: 12, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 2 }}>
                    <strong>27. Lead Preservation Rate</strong>: Winning when leading at 25 pts.
                  </div>
                  <div style={{ padding: 12, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 2 }}>
                    <strong>28. Endgame Sprint Index</strong>: Performance in the final 6 pts (45-51).
                  </div>
                </div>
              </div>

              {/* Category VI: Pool Supremacy & Inter-Group Dynamics (29-30) */}
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--dark)', margin: '0 0 10px 0' }}>
                  Category VI: Pool Supremacy & Leadership (Metrics 29–30)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>29. Pool A vs Pool B Net Spread</strong>: Cross-group seeding differential.
                  </div>
                  <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 2 }}>
                    <strong>30. Captain Leadership Win Index</strong>: Win % of captain line appearances.
                  </div>
                </div>
              </div>
            </div>

            {/* EXHAUSTIVE DEEP STATISTICAL MASTER TABLE */}
            <div className="card" style={{ padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px 0', borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
                📊 Master Team Analytics Breakdown
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '3px solid var(--border)' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 900 }}>Team Name</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900 }}>Pool</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900 }}>Captain</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>Wins</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>Losses</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>Points Scored (PF)</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>Points Conceded (PA)</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>Point Diff (PD)</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>Win Rate</th>
                      <th style={{ padding: '12px 14px', fontWeight: 900 }}>Special Honor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamsStats.map(t => {
                      const winRate = t.matchesPlayed > 0 ? Math.round((t.wins / t.matchesPlayed) * 100) : 0;
                      const isTopScorer = t.id === goldenDinkers?.id;
                      const isTopDefender = t.id === ironWall?.id;

                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 900, fontSize: 15 }}>{t.name}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 900 }}>
                            <span style={{ background: 'var(--dark)', color: '#ffffff', padding: '2px 8px', borderRadius: 2, fontSize: 12 }}>
                              Pool {t.group}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--muted)' }}>{t.captain}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center', color: '#b45309' }}>{t.wins}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center', color: 'var(--muted)' }}>{t.losses}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>{t.pf}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center', color: 'var(--muted)' }}>{t.pa}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center', color: t.pd > 0 ? '#059669' : t.pd < 0 ? '#dc2626' : 'var(--foreground)' }}>
                            {t.pd > 0 ? `+${t.pd}` : t.pd}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'center' }}>{winRate}%</td>
                          <td style={{ padding: '12px 14px' }}>
                            {isTopScorer ? (
                              <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: 2, fontSize: 12, fontWeight: 900 }}>
                                🥇 Golden Dinkers
                              </span>
                            ) : isTopDefender ? (
                              <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 2, fontSize: 12, fontWeight: 900 }}>
                                🛡️ Iron Wall
                              </span>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Active Contender</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

// SUBCOMPONENT FOR BACKUP DIRECT MATCH SCORE CARD
function PickleboysBackupMatchCard({
  match,
  completedFixture,
  onSaveScore,
  isViewOnly
}: {
  match: typeof ALL_16_MATCHES[0];
  completedFixture?: MatchFixture;
  onSaveScore: (sa: number, sb: number) => void;
  isViewOnly?: boolean;
}) {
  const [localScoreA, setLocalScoreA] = useState<string>(completedFixture?.score_a !== undefined && completedFixture?.score_a !== null ? String(completedFixture.score_a) : '');
  const [localScoreB, setLocalScoreB] = useState<string>(completedFixture?.score_b !== undefined && completedFixture?.score_b !== null ? String(completedFixture.score_b) : '');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (completedFixture) {
      if (completedFixture.score_a !== null && completedFixture.score_a !== undefined) {
        setLocalScoreA(String(completedFixture.score_a));
      }
      if (completedFixture.score_b !== null && completedFixture.score_b !== undefined) {
        setLocalScoreB(String(completedFixture.score_b));
      }
    }
  }, [completedFixture]);

  function handleSave() {
    if (isViewOnly) return;
    setErrorMessage(null);
    const sa = parseInt(localScoreA) || 0;
    const sb = parseInt(localScoreB) || 0;

    if (sa === 0 && sb === 0) {
      setErrorMessage('⚠️ Please enter scores for Team A and Team B before saving.');
      setSavedSuccess(false);
      return;
    }

    onSaveScore(sa, sb);
    setSavedSuccess(true);
  }

  return (
    <div className="card" style={{ padding: 22, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--foreground)' }}>
          MATCH #{match.id.replace('m', '')} · COURT {match.court} · ROUND {match.round}
        </span>
        {completedFixture || savedSuccess ? (
          <span style={{ fontSize: 13, fontWeight: 900, background: '#dcfce7', color: '#166534', border: '1px solid #166534', padding: '4px 10px', borderRadius: 2 }}>
            ✓ Score Saved
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 900, background: '#f1f5f9', color: 'var(--muted)', padding: '4px 10px', borderRadius: 2 }}>
            Pending Result
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)' }}>{match.teamA.name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Capt. {match.teamA.captain}</div>
          <input
            type="number"
            placeholder="0"
            max={51}
            disabled={isViewOnly}
            value={localScoreA}
            onChange={e => {
              const val = e.target.value;
              if (val !== '' && parseInt(val) > 51) {
                setLocalScoreA('51');
              } else {
                setLocalScoreA(val);
              }
              setErrorMessage(null);
              setSavedSuccess(false);
            }}
            style={{ width: 100, padding: '10px', fontSize: 24, fontWeight: 900, textAlign: 'center', border: '3px solid var(--border)', borderRadius: 4, marginTop: 8, opacity: isViewOnly ? 0.6 : 1 }}
          />
        </div>

        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--muted)' }}>VS</div>

        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)' }}>{match.teamB.name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Capt. {match.teamB.captain}</div>
          <input
            type="number"
            placeholder="0"
            max={51}
            disabled={isViewOnly}
            value={localScoreB}
            onChange={e => {
              const val = e.target.value;
              if (val !== '' && parseInt(val) > 51) {
                setLocalScoreB('51');
              } else {
                setLocalScoreB(val);
              }
              setErrorMessage(null);
              setSavedSuccess(false);
            }}
            style={{ width: 100, padding: '10px', fontSize: 24, fontWeight: 900, textAlign: 'center', border: '3px solid var(--border)', borderRadius: 4, marginTop: 8, opacity: isViewOnly ? 0.6 : 1 }}
          />
        </div>
      </div>

      {errorMessage && (
        <div style={{ marginTop: 14, background: '#fef2f2', border: '2px solid #dc2626', color: '#991b1b', padding: 12, borderRadius: 4, fontSize: 14, fontWeight: 900 }}>
          {errorMessage}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isViewOnly}
        className="btn-primary"
        style={{ width: '100%', marginTop: 16, fontSize: 15, minHeight: 48, fontWeight: 900, background: isViewOnly ? '#9ca3af' : '#059669', borderColor: isViewOnly ? '#9ca3af' : '#059669', cursor: isViewOnly ? 'not-allowed' : 'pointer' }}
      >
        {isViewOnly ? '🔒 Read-Only Mode (Scoring Locked)' : '💾 Save Final Match Result'}
      </button>
    </div>
  );
}
