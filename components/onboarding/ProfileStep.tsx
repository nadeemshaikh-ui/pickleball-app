'use client';

import { useEffect, useState } from 'react';
import { getOwnPlayer, upsertOwnPlayer } from '@/lib/players';
import { uploadPlayerPhoto } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export default function ProfileStep({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [dominantHand, setDominantHand] = useState<'right' | 'left' | 'ambidextrous' | ''>('');
  const [paddle, setPaddle] = useState('');
  const [playingSinceYear, setPlayingSinceYear] = useState('');
  const [signatureShot, setSignatureShot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const existing = await getOwnPlayer(clubId, user.id);
      if (existing) {
        setName(existing.name);
        setNickname(existing.nickname ?? '');
        setPhotoUrl(existing.photo_url);
        setDominantHand(existing.dominant_hand ?? '');
        setPaddle(existing.paddle ?? '');
        setPlayingSinceYear(existing.playing_since_year?.toString() ?? '');
        setSignatureShot(existing.signature_shot ?? '');
      } else {
        setName(user.user_metadata?.full_name ?? '');
      }
      setLoading(false);
    }
    load();
  }, [clubId]);

  async function handlePhotoSelect(file: File | null) {
    if (!file) return;
    try {
      setPhotoUrl(await uploadPlayerPhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in.');
      await upsertOwnPlayer({
        clubId,
        userId: user.id,
        name: trimmed,
        nickname: nickname.trim() || null,
        photoUrl,
        bio: null,
        dominantHand: dominantHand || null,
        paddle: paddle.trim() || null,
        playingSinceYear: playingSinceYear ? Number(playingSinceYear) : null,
        signatureShot: signatureShot.trim() || null,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — that name might already be taken.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p>Loading…</p>
      </div>
    );
  }

  const inputStyle = { width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Set up your player profile</h2>
      {photoUrl && <img src={photoUrl} alt="" width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
      <div>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Photo (optional)</label>
        <input type="file" accept="image/*" onChange={e => handlePhotoSelect(e.target.files?.[0] ?? null)} />
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" aria-label="Name" style={inputStyle} />
      <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Nickname (optional)" aria-label="Nickname" style={inputStyle} />

      <div style={{ display: 'flex', gap: 8 }}>
        <select value={dominantHand} onChange={e => setDominantHand(e.target.value as typeof dominantHand)} aria-label="Dominant hand" style={inputStyle}>
          <option value="">Dominant hand (optional)</option>
          <option value="right">Right</option>
          <option value="left">Left</option>
          <option value="ambidextrous">Ambidextrous</option>
        </select>
      </div>
      <input value={paddle} onChange={e => setPaddle(e.target.value)} placeholder="Paddle you play with (optional)" aria-label="Paddle" style={inputStyle} />
      <input
        value={playingSinceYear}
        onChange={e => setPlayingSinceYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="Playing since (year, optional)"
        aria-label="Playing since year"
        inputMode="numeric"
        style={inputStyle}
      />
      <input value={signatureShot} onChange={e => setSignatureShot(e.target.value)} placeholder="Signature shot — dink, smash, lob? (optional)" aria-label="Signature shot" style={inputStyle} />

      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
