'use client';

import React, { useState } from 'react';
import { Award, CheckCircle2, Search, X } from 'lucide-react';

interface DuprConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  onSaveDUPR: (duprId: string, rating: number) => Promise<void>;
  initialDuprId?: string;
  initialRating?: number;
}

export default function DuprConnectModal({
  isOpen,
  onClose,
  playerName,
  onSaveDUPR,
  initialDuprId = '',
  initialRating = 3.5
}: DuprConnectModalProps) {
  const [duprId, setDuprId] = useState(initialDuprId);
  const [rating, setRating] = useState(initialRating);
  const [searching, setSearching] = useState(false);
  const [foundProfile, setFoundProfile] = useState<{ name: string; duprId: string; rating: number } | null>(null);

  if (!isOpen) return null;

  async function handleAutoLookup() {
    try {
      setSearching(true);
      const res = await fetch(`/api/dupr/lookup-player?name=${encodeURIComponent(playerName)}`);
      const data = await res.json();

      if (data.profile) {
        setFoundProfile(data.profile);
        setDuprId(data.profile.duprId);
        setRating(data.profile.rating);
      } else {
        alert(`No exact match found for "${playerName}". Please type your 6-character DUPR ID below.`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    if (!duprId.trim()) {
      alert('Please enter a valid DUPR ID.');
      return;
    }
    await onSaveDUPR(duprId.toUpperCase().trim(), rating);
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--dark)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Connect DUPR Profile</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>Link official DUPR rating for {playerName}</p>
          </div>
        </div>

        <button
          onClick={handleAutoLookup}
          disabled={searching}
          className="btn-secondary"
          style={{ width: '100%', marginBottom: 16, fontSize: 13, minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Search size={15} /> {searching ? 'Searching DUPR Database...' : '1-Tap Auto Find My DUPR Profile'}
        </button>

        {foundProfile && (
          <div style={{ background: '#fef3c7', border: '1.5px solid var(--border)', padding: 12, borderRadius: 2, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#b45309', textTransform: 'uppercase' }}>Found DUPR Profile</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#78350f', marginTop: 2 }}>
              {foundProfile.name} (ID: {foundProfile.duprId}) — Rating: {foundProfile.rating}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 900, color: 'var(--foreground)', display: 'block', marginBottom: 4 }}>
              Official DUPR ID
            </label>
            <input
              type="text"
              value={duprId}
              onChange={e => setDuprId(e.target.value)}
              placeholder="e.g. K9X2P4"
              style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 2, fontWeight: 800, fontSize: 14, textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 900, color: 'var(--foreground)', display: 'block', marginBottom: 4 }}>
              Current DUPR Rating
            </label>
            <input
              type="number"
              step="0.01"
              min="1.0"
              max="8.0"
              value={rating}
              onChange={e => setRating(parseFloat(e.target.value) || 3.5)}
              style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 2, fontWeight: 800, fontSize: 14 }}
            />
          </div>
        </div>

        <button onClick={handleSave} className="btn-primary" style={{ width: '100%', fontSize: 15 }}>
          <CheckCircle2 size={18} style={{ marginRight: 6 }} /> Link & Verify DUPR Profile
        </button>
      </div>
    </div>
  );
}
