'use client';

import React, { forwardRef } from 'react';
import { Trophy, Smartphone, ShieldCheck, Flame, BarChart2 } from 'lucide-react';

interface MwMavericksScorecardImageTemplateProps {
  mwScore: number;
  svkmScore: number;
  s1Mw: number;
  s1Svkm: number;
  s2Mw: number;
  s2Svkm: number;
  s3Mw: number;
  s3Svkm: number;
  rfMw: number;
  rfSvkm: number;
  rapidFireWinner: string | null;
}

export const MwMavericksScorecardImageTemplate = forwardRef<HTMLDivElement, MwMavericksScorecardImageTemplateProps>(
  function MwMavericksScorecardImageTemplate(
    { mwScore, svkmScore, s1Mw, s1Svkm, s2Mw, s2Svkm, s3Mw, s3Svkm, rfMw, rfSvkm, rapidFireWinner },
    ref
  ) {
    return (
      <div
        ref={ref}
        style={{
          width: 640,
          padding: 28,
          background: '#0f172a',
          borderRadius: 24,
          boxSizing: 'border-box',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Visible Outer Frame Border - Guarantees Zero Edge Crop on WhatsApp */}
        <div
          style={{
            background: '#ffffff',
            border: '6px solid #cbd5e1',
            borderRadius: 20,
            padding: 28,
            boxSizing: 'border-box',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Monday Wednesday Club · Season II
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: '6px 0 4px 0' }}>
              MW Mavericks vs SVKM Challengers
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>
              12th August 2026 · Official Championship Scorecard
            </div>
          </div>

          {/* Big Squad Score Hero Box */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', textAlign: 'center', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>MW MAVERICKS</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>{mwScore}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>Total Points</div>
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: '#94a3b8' }}>VS</div>

            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>SVKM CHALLENGERS</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>{svkmScore}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>Total Points</div>
            </div>
          </div>

          {/* Session Points Breakdown Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Session 1: Opening Battle (1 pt/win)</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{s1Mw} – {s1Svkm}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Session 2: Momentum Shift (2 pts/win)</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{s2Mw} – {s2Svkm}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Session 3: Final Charge (3 pts/win)</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{s3Mw} – {s3Svkm}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', border: '2px solid #0f172a', borderRadius: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>Rapid Fire Finale (Winner +10 Bonus)</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{rfMw} – {rfSvkm} Wins</span>
            </div>
          </div>

          {rapidFireWinner && (
            <div style={{ padding: 14, background: '#f1f5f9', border: '2px solid #0f172a', borderRadius: 12, textAlign: 'center', fontWeight: 900, fontSize: 15, color: '#0f172a', marginBottom: 20 }}>
              Rapid Fire Grand Finale Winner: {rapidFireWinner}
            </div>
          )}

          {/* Footer Branding & URL */}
          <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
              Official Tournament Hub
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
              https://pickleball-app-two.vercel.app/tournaments/mw-mavericks
            </div>
          </div>
        </div>
      </div>
    );
  }
);
