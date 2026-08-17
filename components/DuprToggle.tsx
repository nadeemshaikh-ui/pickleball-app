'use client';

import React from 'react';
import { Award, ShieldCheck } from 'lucide-react';

interface DuprToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function DuprToggle({
  checked,
  onChange,
  label = 'DUPR Rated Event',
  sublabel = 'Auto-submit completed scores to official DUPR player ratings',
  size = 'md'
}: DuprToggleProps) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        background: checked ? '#fffbeb' : '#ffffff',
        border: checked ? '2px solid var(--dark)' : '1.5px solid #cbd5e1',
        borderRadius: 4,
        padding: size === 'sm' ? '8px 12px' : '12px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: checked ? '3px 3px 0 var(--dark)' : 'none',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            background: checked ? 'var(--dark)' : '#f1f5f9',
            color: checked ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid var(--dark)'
          }}
        >
          <Award size={18} />
        </div>
        <div>
          <div style={{ fontSize: size === 'sm' ? 13 : 14, fontWeight: 900, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {label}
            {checked && (
              <span style={{ fontSize: 10, fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 2, border: '1px solid #b45309' }}>
                OFFICIAL DUPR
              </span>
            )}
          </div>
          {sublabel && <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 1 }}>{sublabel}</div>}
        </div>
      </div>

      {/* Switch Control */}
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? 'var(--dark)' : '#cbd5e1',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.2s ease',
          border: '1.5px solid var(--dark)'
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#ffffff',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }}
        />
      </div>
    </div>
  );
}
