'use client';

import { useState } from 'react';
import { QrCode, X, Copy, Check, ExternalLink } from 'lucide-react';

interface CourtQrModalProps {
  sessionId: string;
  courtLabel: string;
}

export default function CourtQrModal({ sessionId, courtLabel }: CourtQrModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pickleball-app-two.vercel.app';
  const selfScoreUrl = `${baseUrl}/session/${sessionId}/play?court=${encodeURIComponent(courtLabel)}&mode=self_score`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(selfScoreUrl)}`;

  function handleCopy() {
    navigator.clipboard.writeText(selfScoreUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary btn-sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
      >
        <QrCode size={15} /> Court {courtLabel} Self-Score QR
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
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
              maxWidth: 360,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                <QrCode size={18} style={{ color: '#3b82f6' }} /> Court {courtLabel} Self-Scoring
              </h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Players on Court {courtLabel} can scan this QR code to log match scores directly on their phones!
            </p>

            <div style={{ background: '#ffffff', padding: 16, borderRadius: 16, display: 'inline-block', marginBottom: 16 }}>
              <img src={qrImageUrl} alt={`Court ${courtLabel} QR`} width={200} height={200} style={{ display: 'block', borderRadius: 8 }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={handleCopy}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}
              >
                {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                {copied ? 'Copied Link!' : 'Copy Link'}
              </button>
              <a
                href={selfScoreUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}
              >
                <ExternalLink size={14} /> Open Mode
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
