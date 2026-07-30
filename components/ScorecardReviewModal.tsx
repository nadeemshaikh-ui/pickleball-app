'use client';

import { useState } from 'react';
import { Camera, CheckCircle2, AlertTriangle, Edit3, X, Save, Sparkles } from 'lucide-react';
import { type ScannedMatchResult } from '@/app/api/ai/scan-scorecard/route';

interface ScorecardReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedResults: ScannedMatchResult[];
  onConfirm: (confirmedScores: { roundNumber: number; court: string; scoreA: number; scoreB: number }[]) => void;
}

export default function ScorecardReviewModal({ isOpen, onClose, scannedResults, onConfirm }: ScorecardReviewModalProps) {
  const [editableResults, setEditableResults] = useState<ScannedMatchResult[]>(scannedResults);

  if (!isOpen) return null;

  function handleScoreChange(index: number, field: 'scoreA' | 'scoreB', val: string) {
    const n = parseInt(val, 10);
    setEditableResults(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: Number.isNaN(n) ? 0 : Math.max(0, Math.min(99, n)),
        confidence: 1.0, // Manually verified by user
      };
      return copy;
    });
  }

  function handleSave() {
    const formatted = editableResults.map(r => ({
      roundNumber: r.roundNumber,
      court: r.court,
      scoreA: r.scoreA,
      scoreB: r.scoreB,
    }));
    onConfirm(formatted);
    onClose();
  }

  const lowConfidenceCount = editableResults.filter(r => r.confidence < 0.8).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--card-bg, #0f172a)',
          border: '1px solid var(--border, rgba(255,255,255,0.15))',
          borderRadius: 20,
          padding: 24,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} style={{ color: '#2563eb' }} /> AI Scorecard Fail-Safe Review
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {lowConfidenceCount > 0 ? (
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} />
            <span>AI flagged <strong>{lowConfidenceCount} match score(s)</strong> with low confidence. Please verify or correct them below before confirming.</span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px 0' }}>
            Review scanned match scores below. You can edit any score before saving to live session rankings.
          </p>
        )}

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
          {editableResults.map((r, idx) => (
            <div
              key={`${r.roundNumber}-${r.court}`}
              style={{
                background: r.confidence < 0.8 ? 'rgba(245, 158, 11, 0.06)' : 'var(--card, rgba(255,255,255,0.03))',
                border: r.confidence < 0.8 ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: 'var(--muted)' }}>
                  Round {r.roundNumber} · Court {r.court}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  {r.teamA.join(' & ') || 'Team A'} <span style={{ opacity: 0.5 }}>vs</span> {r.teamB.join(' & ') || 'Team B'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={r.scoreA}
                  onChange={e => handleScoreChange(idx, 'scoreA', e.target.value)}
                  style={{ width: 44, textAlign: 'center', padding: '6px 4px', fontSize: 15, fontWeight: 800, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)' }}
                />
                <span style={{ fontWeight: 800, opacity: 0.4 }}>–</span>
                <input
                  type="number"
                  value={r.scoreB}
                  onChange={e => handleScoreChange(idx, 'scoreB', e.target.value)}
                  style={{ width: 44, textAlign: 'center', padding: '6px 4px', fontSize: 15, fontWeight: 800, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
            <Save size={16} /> Confirm & Update Standings
          </button>
        </div>
      </div>
    </div>
  );
}
