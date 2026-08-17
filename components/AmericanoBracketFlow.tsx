'use client';

import React from 'react';
import { Trophy, Award, Crown } from 'lucide-react';
import type { PickleboysTeamStats } from './PickleboysStandingsTable';

interface AmericanoBracketFlowProps {
  teams: PickleboysTeamStats[];
  sessionId?: string;
}

export default function AmericanoBracketFlow({ teams }: AmericanoBracketFlowProps) {
  // OFFICIAL RANKING HIERARCHY: 1. Max Wins -> 2. Points Taken (PF) -> 3. Point Differential (PD)
  const masterRankings = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins; // 1st: Max Wins
    if (b.pf !== a.pf) return b.pf - a.pf;         // 2nd: Points Taken / Points Scored (PF)
    if (b.pd !== a.pd) return b.pd - a.pd;         // 3rd: Point Differential (PD)
    return a.id.localeCompare(b.id);               // 4th: Deterministic ID Fallback
  });

  const hasAnyPlayed = teams.some(t => t.matchesPlayed > 0);

  const rank1 = hasAnyPlayed ? (masterRankings[0] || { name: 'TBD (#1 Seed)', captain: 'TBD', wins: 0, losses: 0, pf: 0, pd: 0 }) : { name: 'TBD (#1 Seed)', captain: 'Pending Round 1–4', wins: 0, losses: 0, pf: 0, pd: 0 };
  const rank2 = hasAnyPlayed ? (masterRankings[1] || { name: 'TBD (#2 Seed)', captain: 'TBD', wins: 0, losses: 0, pf: 0, pd: 0 }) : { name: 'TBD (#2 Seed)', captain: 'Pending Round 1–4', wins: 0, losses: 0, pf: 0, pd: 0 };
  const rank3 = hasAnyPlayed ? (masterRankings[2] || { name: 'TBD (#3 Seed)', captain: 'TBD', wins: 0, losses: 0, pf: 0, pd: 0 }) : { name: 'TBD (#3 Seed)', captain: 'Pending Round 1–4', wins: 0, losses: 0, pf: 0, pd: 0 };
  const rank4 = hasAnyPlayed ? (masterRankings[3] || { name: 'TBD (#4 Seed)', captain: 'TBD', wins: 0, losses: 0, pf: 0, pd: 0 }) : { name: 'TBD (#4 Seed)', captain: 'Pending Round 1–4', wins: 0, losses: 0, pf: 0, pd: 0 };

  const consolidated = masterRankings.slice(4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>
          Master Rankings Playoff Progression
        </div>
        <h2 style={{ margin: '6px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 24, fontWeight: 900 }}>
          <Trophy size={26} style={{ color: 'var(--gold)' }} /> Playoff Qualification & Overall Team Rankings
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '6px 0 0 0', fontWeight: 700 }}>
          1st Criteria: Max Wins | 2nd Criteria: Points Taken (PF) | 3rd Criteria: Point Differential (PD) | Top 2 → Final
        </p>
      </div>

      {/* Bracket Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 18,
          alignItems: 'start'
        }}
      >
        {/* Column 1: Top 4 Overall Ranked Teams */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
          <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 900, background: 'var(--dark)', color: '#ffffff', padding: '4px 10px', borderRadius: 2 }}>
              PLAYOFF QUALIFIERS
            </span>
            <h3 style={{ margin: '8px 0 0 0', fontSize: 20, fontWeight: 900 }}>Top 4 Overall Teams</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {masterRankings.slice(0, 4).map((t, idx) => {
              const rank = idx + 1;
              const isFinalist = rank === 1 || rank === 2; // Top 2 -> Final
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    border: '2px solid var(--border)',
                    background: isFinalist ? '#fef3c7' : '#fff7ed',
                    color: 'var(--foreground)',
                    borderRadius: 2,
                    boxShadow: '2px 2px 0 var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 900, fontSize: 16, background: 'var(--dark)', color: '#ffffff', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                      #{rank}
                    </span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Capt. {t.captain} · PD: {t.pd > 0 ? `+${t.pd}` : t.pd}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 900 }}>
                    <span>{t.wins}W–{t.losses}L</span>
                    {isFinalist ? <Crown size={18} style={{ color: '#b45309' }} /> : <Award size={18} style={{ color: '#c2410c' }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Playoff Matches */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, background: '#f8fafc', padding: 20 }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase' }}>Championship Playoff Matches</span>
          </div>

          {/* Gold Medal Final Box (Top 2 Overall) */}
          <div style={{ background: '#fef3c7', border: '3px solid var(--gold)', padding: 20, borderRadius: 4, textAlign: 'center', boxShadow: '4px 4px 0 var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Trophy size={20} /> 🥇 Gold Medal Final (1st & 2nd Place)
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--foreground)', marginTop: 10 }}>
              Rank #1 ({rank1.name}) vs Rank #2 ({rank2.name})
            </div>
            <div style={{ fontSize: 13, color: '#b45309', fontWeight: 800, marginTop: 6, background: '#ffffff', padding: '6px 12px', borderRadius: 2, display: 'inline-block', border: '1px solid #b45309' }}>
              Court 1 · 51-Point Rapid-Fire Championship
            </div>
          </div>

          {/* 3rd Place Match Box (3rd & 4th Overall) */}
          <div style={{ background: '#fff7ed', border: '3px solid #c2410c', padding: 20, borderRadius: 4, textAlign: 'center', boxShadow: '4px 4px 0 var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#c2410c', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Award size={20} /> 🥉 Bronze Medal Match (3rd & 4th Place)
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--foreground)', marginTop: 10 }}>
              Rank #4 ({rank4.name}) vs Rank #3 ({rank3.name})
            </div>
            <div style={{ fontSize: 13, color: '#c2410c', fontWeight: 800, marginTop: 6, background: '#ffffff', padding: '6px 12px', borderRadius: 2, display: 'inline-block', border: '1px solid #c2410c' }}>
              Court 2 · 51-Point Rapid-Fire Playoff
            </div>
          </div>
        </div>

        {/* Column 3: Ranks #5 to #8 Consolidated Standings */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
          <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 900, background: '#f1f3f4', color: 'var(--foreground)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 2 }}>
              CONSOLIDATED STANDINGS
            </span>
            <h3 style={{ margin: '8px 0 0 0', fontSize: 20, fontWeight: 900 }}>Rank #5 to #8 Teams</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {consolidated.map((t, idx) => {
              const rank = idx + 5;
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    border: '2px solid var(--border)',
                    background: '#ffffff',
                    color: 'var(--foreground)',
                    borderRadius: 2
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 900, fontSize: 14, background: '#e2e8f0', color: 'var(--foreground)', width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                      #{rank}
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Capt. {t.captain} · PD: {t.pd > 0 ? `+${t.pd}` : t.pd}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    {t.wins}W–{t.losses}L
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
