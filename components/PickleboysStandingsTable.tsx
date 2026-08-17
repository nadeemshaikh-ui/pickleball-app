'use client';

import React from 'react';
import { Trophy, Award, ChevronRight, BarChart2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export interface PickleboysTeamStats {
  id: string;
  name: string;
  captain: string;
  group: 'A' | 'B';
  matchesPlayed: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  pd: number;
  winPct: number;
}

interface PickleboysStandingsTableProps {
  teams: PickleboysTeamStats[];
  sessionId?: string;
  clubId?: string;
}

export default function PickleboysStandingsTable({ teams, sessionId }: PickleboysStandingsTableProps) {
  // OFFICIAL RANKING HIERARCHY:
  // 1. Max Wins (W)
  // 2. Total Points Taken / Scored (PF)
  // 3. Point Differential (PD = PF - PA)
  // 4. Deterministic ID Fallback
  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins; // 1st Criteria: Max Wins
    if (b.pf !== a.pf) return b.pf - a.pf;         // 2nd Criteria: Points Taken / Points Scored (PF)
    if (b.pd !== a.pd) return b.pd - a.pd;         // 3rd Criteria: Point Differential (PD)
    return a.id.localeCompare(b.id);               // 4th Criteria: Deterministic ID Fallback
  });
  const hasAnyPlayed = sorted.some(t => t.matchesPlayed > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, padding: 20, background: '#ffffff', borderLeft: '6px solid var(--gold)' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            OFFICIAL LIVE TOURNAMENT STANDINGS
          </div>
          <h2 style={{ margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 900 }}>
            <Trophy size={26} style={{ color: 'var(--gold)' }} /> Top 8 Master Leaderboard
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
            Tiebreaker Hierarchy: 1st Max Wins (W) → 2nd Points Taken (PF) → 3rd Point Differential (PD)
          </p>
        </div>

        {sessionId && (
          <Link href={`/session/${sessionId}/play`} className="btn-primary" style={{ fontSize: 14, textDecoration: 'none', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={18} /> Launch Court Scorekeeper →
          </Link>
        )}
      </div>

      {/* 1 SINGLE MASTER UNIFIED TABLE FORMAT (DESKTOP + MOBILE SCROLLABLE) */}
      <div className="card" style={{ padding: 24, background: '#ffffff', border: '4px solid var(--border)', boxShadow: '6px 6px 0 var(--border)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 15, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '4px solid var(--border)' }}>
              <th style={{ padding: '16px 14px', fontWeight: 900, width: '64px', fontSize: 13, textTransform: 'uppercase' }}>Rank</th>
              <th style={{ padding: '16px 16px', fontWeight: 900, fontSize: 14, textTransform: 'uppercase' }}>Team Name</th>
              <th style={{ padding: '16px 12px', fontWeight: 900, textAlign: 'center', fontSize: 13, textTransform: 'uppercase' }}>Played</th>
              <th style={{ padding: '16px 14px', fontWeight: 900, textAlign: 'center', background: '#fffbeb', color: '#b45309', fontSize: 14, textTransform: 'uppercase' }}>W</th>
              <th style={{ padding: '16px 14px', fontWeight: 900, textAlign: 'center', fontSize: 13, textTransform: 'uppercase' }}>L</th>
              <th style={{ padding: '16px 12px', fontWeight: 900, textAlign: 'center', fontSize: 13, textTransform: 'uppercase' }}>PF</th>
              <th style={{ padding: '16px 12px', fontWeight: 900, textAlign: 'center', fontSize: 13, textTransform: 'uppercase' }}>PA</th>
              <th style={{ padding: '16px 14px', fontWeight: 900, textAlign: 'center', background: '#f0fdf4', color: '#166534', fontSize: 14, textTransform: 'uppercase' }}>PD</th>
              <th style={{ padding: '16px 16px', fontWeight: 900, fontSize: 13, textTransform: 'uppercase' }}>Playoff Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => {
              const rank = idx + 1;
              const isFinalist = rank === 1 || rank === 2;
              const isBronze = rank === 3 || rank === 4;

              const bgRow = !hasAnyPlayed ? (idx % 2 === 0 ? '#ffffff' : '#f8fafc') : isFinalist ? '#fefce8' : isBronze ? '#fff7ed' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const statusBg = !hasAnyPlayed ? '#f1f5f9' : isFinalist ? '#fef3c7' : isBronze ? '#ffedd5' : '#f1f5f9';
              const statusColor = !hasAnyPlayed ? 'var(--muted)' : isFinalist ? '#b45309' : isBronze ? '#c2410c' : 'var(--muted)';
              const statusText = !hasAnyPlayed ? '⏳ Round 1–4 Pending' : isFinalist ? '🥇 Gold Finalist (#1/#2)' : isBronze ? '🥉 Bronze Playoff (#3/#4)' : `Rank #${rank} Consolidation`;

              return (
                <tr key={t.id} style={{ background: bgRow, borderBottom: '2px solid var(--border)' }}>
                  <td style={{ padding: '16px 14px', fontWeight: 900 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: isFinalist ? 'var(--gold)' : isBronze ? 'var(--dark)' : 'var(--border)',
                        color: isFinalist || isBronze ? '#ffffff' : 'var(--foreground)',
                        fontSize: 15,
                        fontWeight: 900
                      }}
                    >
                      #{rank}
                    </span>
                  </td>
                  <td style={{ padding: '16px 16px', fontWeight: 900, fontSize: 18, whiteSpace: 'nowrap' }}>{t.name}</td>
                  <td style={{ padding: '16px 12px', fontWeight: 900, textAlign: 'center', fontSize: 15 }}>{t.matchesPlayed}/4</td>
                  <td style={{ padding: '16px 14px', fontWeight: 900, textAlign: 'center', background: '#fffbeb', color: '#b45309', fontSize: 18 }}>{t.wins}</td>
                  <td style={{ padding: '16px 14px', fontWeight: 800, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>{t.losses}</td>
                  <td style={{ padding: '16px 12px', fontWeight: 900, textAlign: 'center', fontSize: 15 }}>{t.pf}</td>
                  <td style={{ padding: '16px 12px', fontWeight: 800, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>{t.pa}</td>
                  <td style={{ padding: '16px 14px', fontWeight: 900, textAlign: 'center', background: '#f0fdf4', color: t.pd > 0 ? '#059669' : t.pd < 0 ? '#dc2626' : 'var(--foreground)', fontSize: 17 }}>
                    {t.pd > 0 ? `+${t.pd}` : t.pd}
                  </td>
                  <td style={{ padding: '16px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ background: statusBg, color: statusColor, padding: '8px 12px', borderRadius: 2, fontSize: 13, fontWeight: 900 }}>
                      {statusText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
