'use client';

import React, { useState } from 'react';
import { Swords, Users, Award, FileText, Trophy, Zap, ShieldCheck, Sparkles, CheckCircle2, Clock, UserCheck, LayoutGrid, List } from 'lucide-react';
import { type RoundRow } from '@/lib/db';

interface MatchItem {
  roundNumber: number;
  court: number;
  teamA: string[];
  teamB: string[];
  scoreA: number | null;
  scoreB: number | null;
  sittingOut?: string[];
}

interface CustomScheduleRound {
  round_number: number;
  court: number;
  team_a: string[];
  team_b: string[];
  sitting_out?: string[];
}

interface TournamentDeepAnalyticsProps {
  customSchedule?: CustomScheduleRound[];
  dbRounds?: RoundRow[];
  players?: string[];
}

export default function TournamentDeepAnalytics({ customSchedule = [], dbRounds = [], players = [] }: TournamentDeepAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'h2h' | 'partnerships' | 'badges' | 'matches'>('h2h');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [matchViewMode, setMatchViewMode] = useState<'cards' | 'table'>('cards');

  // Build unified match list
  const allMatches: MatchItem[] = [];

  if (dbRounds && dbRounds.length > 0) {
    dbRounds.forEach(r => {
      allMatches.push({
        roundNumber: r.round_number,
        court: r.court,
        teamA: r.team_a || [],
        teamB: r.team_b || [],
        scoreA: r.score_a,
        scoreB: r.score_b,
        sittingOut: r.sitting_out || []
      });
    });
  } else if (customSchedule && customSchedule.length > 0) {
    customSchedule.forEach(s => {
      allMatches.push({
        roundNumber: s.round_number,
        court: s.court,
        teamA: s.team_a || [],
        teamB: s.team_b || [],
        scoreA: null,
        scoreB: null,
        sittingOut: s.sitting_out || []
      });
    });
  }

  // Derive complete player list
  const playerSet = new Set<string>(players);
  allMatches.forEach(m => {
    m.teamA.forEach(p => playerSet.add(p));
    m.teamB.forEach(p => playerSet.add(p));
    if (m.sittingOut) m.sittingOut.forEach(p => playerSet.add(p));
  });
  const playerList = Array.from(playerSet).filter(Boolean).sort();

  // Compute H2H records
  const h2hMap: Record<string, Record<string, { played: number; wins: number; losses: number; pf: number; pa: number }>> = {};

  playerList.forEach(p1 => {
    h2hMap[p1] = {};
    playerList.forEach(p2 => {
      if (p1 !== p2) {
        h2hMap[p1][p2] = { played: 0, wins: 0, losses: 0, pf: 0, pa: 0 };
      }
    });
  });

  // Track player total stats for Badges
  const playerStats: Record<string, { played: number; wins: number; losses: number; pf: number; pa: number }> = {};
  playerList.forEach(p => {
    playerStats[p] = { played: 0, wins: 0, losses: 0, pf: 0, pa: 0 };
  });

  // Compute Partnership records
  const partnershipMap: Record<string, { pair: string; p1: string; p2: string; played: number; wins: number; losses: number; pf: number; pa: number }> = {};

  allMatches.forEach(m => {
    if (m.scoreA != null && m.scoreB != null) {
      const sa = m.scoreA ?? 0;
      const sb = m.scoreB ?? 0;

      // Track Player Stats
      m.teamA.forEach(p => {
        if (playerStats[p]) {
          playerStats[p].played++;
          playerStats[p].pf += sa;
          playerStats[p].pa += sb;
          if (sa > sb) playerStats[p].wins++;
          else if (sb > sa) playerStats[p].losses++;
        }
      });

      m.teamB.forEach(p => {
        if (playerStats[p]) {
          playerStats[p].played++;
          playerStats[p].pf += sb;
          playerStats[p].pa += sa;
          if (sb > sa) playerStats[p].wins++;
          else if (sa > sb) playerStats[p].losses++;
        }
      });

      // Track Partnerships
      const pairA = [...m.teamA].sort().join(' & ');
      const pairB = [...m.teamB].sort().join(' & ');

      if (pairA && m.teamA.length === 2) {
        if (!partnershipMap[pairA]) partnershipMap[pairA] = { pair: pairA, p1: m.teamA[0], p2: m.teamA[1], played: 0, wins: 0, losses: 0, pf: 0, pa: 0 };
        partnershipMap[pairA].played++;
        partnershipMap[pairA].pf += sa;
        partnershipMap[pairA].pa += sb;
        if (sa > sb) partnershipMap[pairA].wins++;
        else if (sb > sa) partnershipMap[pairA].losses++;
      }

      if (pairB && m.teamB.length === 2) {
        if (!partnershipMap[pairB]) partnershipMap[pairB] = { pair: pairB, p1: m.teamB[0], p2: m.teamB[1], played: 0, wins: 0, losses: 0, pf: 0, pa: 0 };
        partnershipMap[pairB].played++;
        partnershipMap[pairB].pf += sb;
        partnershipMap[pairB].pa += sa;
        if (sb > sa) partnershipMap[pairB].wins++;
        else if (sa > sb) partnershipMap[pairB].losses++;
      }

      // Track H2H Matrix
      m.teamA.forEach(p1 => {
        m.teamB.forEach(p2 => {
          if (h2hMap[p1] && h2hMap[p1][p2]) {
            h2hMap[p1][p2].played++;
            h2hMap[p1][p2].pf += sa;
            h2hMap[p1][p2].pa += sb;
            if (sa > sb) h2hMap[p1][p2].wins++;
            else if (sb > sa) h2hMap[p1][p2].losses++;
          }
          if (h2hMap[p2] && h2hMap[p2][p1]) {
            h2hMap[p2][p1].played++;
            h2hMap[p2][p1].pf += sb;
            h2hMap[p2][p1].pa += sa;
            if (sb > sa) h2hMap[p2][p1].wins++;
            else if (sa > sb) h2hMap[p2][p1].losses++;
          }
        });
      });
    }
  });

  const sortedPartnerships = Object.values(partnershipMap).sort((a, b) => {
    const winRateA = a.played > 0 ? a.wins / a.played : 0;
    const winRateB = b.played > 0 ? b.wins / b.played : 0;
    if (winRateB !== winRateA) return winRateB - winRateA;
    return (b.pf - b.pa) - (a.pf - a.pa);
  });

  // Calculate Session Badges
  const sessionBadges: { title: string; recipient: string; icon: React.ElementType; color: string; bg: string; description: string }[] = [];

  const rankedPlayers = Object.entries(playerStats)
    .filter(([_, st]) => st.played > 0)
    .sort((a, b) => {
      const winRateA = a[1].played > 0 ? a[1].wins / a[1].played : 0;
      const winRateB = b[1].played > 0 ? b[1].wins / b[1].played : 0;
      if (winRateB !== winRateA) return winRateB - winRateA;
      return (b[1].pf - b[1].pa) - (a[1].pf - a[1].pa);
    });

  if (rankedPlayers.length > 0) {
    const topPlayer = rankedPlayers[0];
    sessionBadges.push({
      title: 'THE HOTSHOT Champion',
      recipient: topPlayer[0],
      icon: Trophy,
      color: '#d97706',
      bg: '#fffbeb',
      description: `Ranked #1 with ${topPlayer[1].wins} Wins and +${topPlayer[1].pf - topPlayer[1].pa} Point Differential`
    });
  }

  const undefeated = rankedPlayers.filter(([_, st]) => st.played >= 3 && st.losses === 0);
  if (undefeated.length > 0) {
    undefeated.forEach(([pName, st]) => {
      sessionBadges.push({
        title: 'Perfectionist (Undefeated)',
        recipient: pName,
        icon: ShieldCheck,
        color: '#16a34a',
        bg: '#f0fdf4',
        description: `Flawless ${st.wins}-0 record across all matches played`
      });
    });
  }

  const goldenDuos = sortedPartnerships.filter(d => d.played >= 2 && d.losses === 0);
  goldenDuos.forEach(d => {
    sessionBadges.push({
      title: 'Golden Duo Partnership',
      recipient: d.pair,
      icon: Sparkles,
      color: '#2563eb',
      bg: '#eff6ff',
      description: `Undefeated partnership (${d.wins}-0) with a +${d.pf - d.pa} point differential`
    });
  });

  const nailBiterMatches = allMatches.filter(m => m.scoreA != null && m.scoreB != null && Math.abs((m.scoreA ?? 0) - (m.scoreB ?? 0)) <= 2 && Math.abs((m.scoreA ?? 0) - (m.scoreB ?? 0)) > 0);
  if (nailBiterMatches.length > 0) {
    const clutchPlayers = new Set<string>();
    nailBiterMatches.forEach(m => {
      const sa = m.scoreA ?? 0;
      const sb = m.scoreB ?? 0;
      const winners = (sa > sb) ? m.teamA : m.teamB;
      winners.forEach(w => clutchPlayers.add(w));
    });

    sessionBadges.push({
      title: 'Clutch Survivor (Nail-Biter)',
      recipient: Array.from(clutchPlayers).join(', '),
      icon: Zap,
      color: '#ea580c',
      bg: '#fff7ed',
      description: `Won high-stakes match decided by 2 points or fewer`
    });
  }

  return (
    <div style={{ marginTop: 24, background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden', color: '#0f172a' }}>
      {/* Header Bar */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a', margin: 0, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
              Deep Analytics & Score Sheets
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0', fontWeight: 500 }}>
              Head-to-Head rivalries, duo partnership records, session badges & match score cards
            </p>
          </div>

          {/* Tab Selection Navigation */}
          <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 4, borderRadius: 10, gap: 4 }}>
            <button
              onClick={() => setActiveTab('h2h')}
              style={{
                padding: '8px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'h2h' ? '#0f172a' : 'transparent',
                color: activeTab === 'h2h' ? '#ffffff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Swords size={15} /> Head-to-Head
            </button>

            <button
              onClick={() => setActiveTab('partnerships')}
              style={{
                padding: '8px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'partnerships' ? '#0f172a' : 'transparent',
                color: activeTab === 'partnerships' ? '#ffffff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Users size={15} /> Partnerships
            </button>

            <button
              onClick={() => setActiveTab('badges')}
              style={{
                padding: '8px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'badges' ? '#0f172a' : 'transparent',
                color: activeTab === 'badges' ? '#ffffff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Award size={15} /> Badges ({sessionBadges.length})
            </button>

            <button
              onClick={() => setActiveTab('matches')}
              style={{
                padding: '8px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'matches' ? '#0f172a' : 'transparent',
                color: activeTab === 'matches' ? '#ffffff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <FileText size={15} /> Score Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content Area */}
      <div style={{ padding: 24 }}>

        {/* 1. SCORE SHEET TAB */}
        {activeTab === 'matches' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>
                Total Matches: <strong style={{ color: '#0f172a' }}>{allMatches.length}</strong>
              </div>

              {/* View Switcher: Card Layout vs Table Layout */}
              <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 3, borderRadius: 8, gap: 2 }}>
                <button
                  onClick={() => setMatchViewMode('cards')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: matchViewMode === 'cards' ? '#ffffff' : 'transparent',
                    color: matchViewMode === 'cards' ? '#0f172a' : '#64748b',
                    boxShadow: matchViewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <LayoutGrid size={14} /> Match Cards
                </button>
                <button
                  onClick={() => setMatchViewMode('table')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: matchViewMode === 'table' ? '#ffffff' : 'transparent',
                    color: matchViewMode === 'table' ? '#0f172a' : '#64748b',
                    boxShadow: matchViewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <List size={14} /> Compact Table
                </button>
              </div>
            </div>

            {/* CARD VIEW MODE */}
            {matchViewMode === 'cards' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {allMatches.map((m, idx) => {
                  const sa = m.scoreA ?? null;
                  const sb = m.scoreB ?? null;
                  const hasScore = sa !== null && sb !== null;
                  const teamAWon = hasScore && sa > sb;
                  const teamBWon = hasScore && sb > sa;

                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top Bar: Round & Court */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                            ROUND {m.roundNumber}
                          </span>
                          <span style={{ background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>
                            COURT {m.court}
                          </span>
                        </div>

                        {hasScore ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: 11, fontWeight: 800 }}>
                            <CheckCircle2 size={13} /> SCORED
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>
                            <Clock size={13} /> PENDING
                          </span>
                        )}
                      </div>

                      {/* Scoreline Box */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                        {/* Team A */}
                        <div style={{ flex: 1, textAlign: 'left', paddingRight: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: teamAWon ? '#16a34a' : '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {m.teamA.join(' & ')}
                          </div>
                          {teamAWon && (
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              🏆 Winner
                            </span>
                          )}
                        </div>

                        {/* Score Pill */}
                        <div style={{ background: hasScore ? '#0f172a' : '#e2e8f0', color: hasScore ? '#ffffff' : '#64748b', padding: '6px 14px', borderRadius: 8, fontSize: 15, fontWeight: 900, letterSpacing: 1, textAlign: 'center', minWidth: 64 }}>
                          {hasScore ? `${sa} – ${sb}` : 'VS'}
                        </div>

                        {/* Team B */}
                        <div style={{ flex: 1, textAlign: 'right', paddingLeft: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: teamBWon ? '#16a34a' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            {m.teamB.join(' & ')}
                          </div>
                          {teamBWon && (
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              🏆 Winner
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Resting Players Row */}
                      {m.sittingOut && m.sittingOut.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #e2e8f0', fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <UserCheck size={13} style={{ color: '#d97706' }} />
                          <span>Resting: <strong>{m.sittingOut.join(', ')}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* COMPACT TABLE VIEW MODE */}
            {matchViewMode === 'table' && (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Round</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Court</th>
                      <th style={{ padding: '12px 16px' }}>Team A</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Score</th>
                      <th style={{ padding: '12px 16px' }}>Team B</th>
                      <th style={{ padding: '12px 16px' }}>Winner</th>
                      <th style={{ padding: '12px 16px' }}>Resting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMatches.map((m, idx) => {
                      const sa = m.scoreA ?? null;
                      const sb = m.scoreB ?? null;
                      const hasScore = sa !== null && sb !== null;
                      const teamAWon = hasScore && sa > sb;
                      const teamBWon = hasScore && sb > sa;
                      const winnerText = hasScore
                        ? (sa > sb ? `Team A (${m.teamA.join(' & ')})` : sb > sa ? `Team B (${m.teamB.join(' & ')})` : 'Tie')
                        : 'Pending';

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, color: '#d97706' }}>R{m.roundNumber}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>C{m.court}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: teamAWon ? '#16a34a' : '#0f172a' }}>{m.teamA.join(' & ')}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 900, fontSize: 14, color: '#0f172a' }}>
                            {hasScore ? `${sa} – ${sb}` : <span style={{ color: '#94a3b8', fontSize: 12 }}>— vs —</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: teamBWon ? '#16a34a' : '#0f172a' }}>{m.teamB.join(' & ')}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: hasScore ? '#16a34a' : '#94a3b8', fontSize: 12 }}>
                            {hasScore ? `🏆 ${winnerText}` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                            {m.sittingOut && m.sittingOut.length > 0 ? m.sittingOut.join(', ') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. HEAD-TO-HEAD TAB */}
        {activeTab === 'h2h' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Filter Rivalry Matrix:</span>
              <select
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(e.target.value)}
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <option value="all">Show All Players (Full Rivalry Matrix)</option>
                {playerList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>
                    <th style={{ padding: '12px 16px' }}>Player</th>
                    <th style={{ padding: '12px 16px' }}>Opponent</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>Matches</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>H2H Record</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>Points Scored</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>Point Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {playerList
                    .filter(p1 => selectedPlayer === 'all' || p1 === selectedPlayer)
                    .flatMap(p1 =>
                      Object.keys(h2hMap[p1] || {})
                        .filter(p2 => (h2hMap[p1][p2]?.played || 0) > 0)
                        .map((p2, rIdx) => {
                          const rec = h2hMap[p1][p2];
                          const diff = rec.pf - rec.pa;
                          return (
                            <tr key={`${p1}-${p2}`} style={{ borderBottom: '1px solid #f1f5f9', background: rIdx % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>{p1}</td>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>vs {p2}</td>
                              <td style={{ padding: '12px 12px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>{rec.played}</td>
                              <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 900, color: rec.wins > rec.losses ? '#16a34a' : rec.losses > rec.wins ? '#dc2626' : '#64748b' }}>
                                {rec.wins}W – {rec.losses}L
                              </td>
                              <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{rec.pf} – {rec.pa}</td>
                              <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 900, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b' }}>
                                {diff > 0 ? `+${diff}` : diff}
                              </td>
                            </tr>
                          );
                        })
                    )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. PARTNERSHIPS TAB */}
        {activeTab === 'partnerships' && (
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Rank & Duo Partnership</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>Matches</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>Record</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>Win %</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>Points Scored</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>Point Diff</th>
                </tr>
              </thead>
              <tbody>
                {sortedPartnerships.length > 0 ? (
                  sortedPartnerships.map((pair, idx) => {
                    const winPct = pair.played > 0 ? Math.round((pair.wins / pair.played) * 100) : 0;
                    const diff = pair.pf - pair.pa;
                    return (
                      <tr key={pair.pair} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                          <span style={{ display: 'inline-block', width: 22, color: idx === 0 ? '#d97706' : '#64748b', fontWeight: 900 }}>#{idx + 1}</span>
                          {pair.pair}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>{pair.played}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 900, color: pair.wins > pair.losses ? '#16a34a' : pair.losses > pair.wins ? '#dc2626' : '#64748b' }}>
                          {pair.wins}W – {pair.losses}L
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 800, color: winPct >= 60 ? '#16a34a' : '#0f172a' }}>
                          {winPct}%
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{pair.pf} – {pair.pa}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 900, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b' }}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                      No scored partnership matches recorded yet. Enter scores to view duo analytics!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. BADGES TAB */}
        {activeTab === 'badges' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {sessionBadges.length > 0 ? (
              sessionBadges.map((badge, idx) => {
                const IconComp = badge.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      background: badge.bg,
                      border: `1.5px solid ${badge.color}`,
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ background: badge.color, color: '#ffffff', padding: 10, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconComp size={22} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: badge.color }}>{badge.title}</h4>
                      <p style={{ margin: '3px 0 6px 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{badge.recipient}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.4, fontWeight: 500 }}>{badge.description}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: '#64748b' }}>
                Enter session scores to unlock session badges & achievements!
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
