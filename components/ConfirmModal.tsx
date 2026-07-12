'use client';

import { useState } from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  requireText?: string; // if set, user must type this exact text to enable Confirm
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, requireText, onConfirm, onCancel }: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const canConfirm = !requireText || typed === requireText;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onCancel}
    >
      <div className="card" style={{ maxWidth: 400, width: '100%', borderColor: danger ? 'var(--danger)' : undefined }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, color: danger ? 'var(--danger)' : undefined }}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'pre-line' }}>{message}</p>
        {requireText && (
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={`Type "${requireText}" to confirm`}
            aria-label="Confirmation text"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: requireText ? 0 : 16 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1, borderColor: danger ? 'var(--danger)' : undefined, color: danger ? 'var(--danger)' : undefined }}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
