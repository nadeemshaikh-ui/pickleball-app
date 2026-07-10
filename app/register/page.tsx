'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getOwnPlayer, upsertOwnPlayer, listPlayers, type PlayerRow } from '@/lib/players';
import { uploadPlayerPhoto } from '@/lib/db';
import type { User } from '@supabase/supabase-js';

export default function RegisterPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [directory, setDirectory] = useState<PlayerRow[]>([]);

  useEffect(() => {
    async function load() {
      const [u, players] = await Promise.all([getCurrentUser(), listPlayers()]);
      setUser(u);
      setDirectory(players);
      if (u) {
        const own = await getOwnPlayer(u.id);
        if (own) {
          setName(own.name);
          setNickname(own.nickname ?? '');
          setBio(own.bio ?? '');
          setPhotoUrl(own.photo_url);
        } else {
          setName(u.user_metadata?.full_name ?? '');
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handlePhotoSelect(file: File | null) {
    if (!file) return;
    try {
      const url = await uploadPlayerPhoto(file);
      setPhotoUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    }
  }

  async function handleSave() {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await upsertOwnPlayer({
        userId: user.id,
        name: trimmed,
        nickname: nickname.trim() || null,
        photoUrl,
        bio: bio.trim() || null,
      });
      setSaved(true);
      setDirectory(await listPlayers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — that name might already be taken.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;

  if (!user) {
    return (
      <main className="page">
        <h1>Register</h1>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>Sign in first to register a player profile.</p>
        <Link href="/login" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Register</h1>
      <div className="card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {photoUrl && (
          <img src={photoUrl} alt="" width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Photo</label>
          <input type="file" accept="image/*" onChange={e => handlePhotoSelect(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
            style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Nickname (optional)</label>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="What people call you on court"
            style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Bio (optional)</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        {error && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{error}</p>}
        {saved && <p style={{ color: 'var(--dark)', fontWeight: 700, fontSize: 14 }}>✓ Saved.</p>}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      <h2>Registered Players ({directory.length})</h2>
      <div className="card">
        {directory.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nobody's registered yet.</p>}
        {directory.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            {p.photo_url ? (
              <img src={p.photo_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#eee', display: 'inline-block' }} />
            )}
            <span>{p.name}{p.nickname && ` (${p.nickname})`}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
