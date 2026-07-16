'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { getCurrentUser, signOut } from '@/lib/auth';
import { getOwnPlayer, upsertOwnPlayer, listPlayers, type PlayerRow } from '@/lib/players';
import { uploadPlayerPhoto } from '@/lib/db';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { getDisplayNamePref, setDisplayNamePref, type DisplayNamePref } from '@/lib/displayNamePref';
import type { User } from '@supabase/supabase-js';

export default function RegisterPage() {
  const router = useRouter();
  const { currentClubId, isCurrentClubAdmin, loading: clubLoading } = useCurrentClub();
  const [namePref, setNamePref] = useState<DisplayNamePref>('nickname');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [dominantHand, setDominantHand] = useState<'right' | 'left' | 'ambidextrous' | ''>('');
  const [paddle, setPaddle] = useState('');
  const [playingSinceYear, setPlayingSinceYear] = useState('');
  const [signatureShot, setSignatureShot] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [directory, setDirectory] = useState<PlayerRow[]>([]);

  useEffect(() => {
    setNamePref(getDisplayNamePref());
  }, []);

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    async function load() {
      const [u, players] = await Promise.all([getCurrentUser(), listPlayers(currentClubId!)]);
      setUser(u);
      setDirectory(players);
      if (u) {
        const own = await getOwnPlayer(currentClubId!, u.id);
        if (own) {
          setName(own.name);
          setNickname(own.nickname ?? '');
          setBio(own.bio ?? '');
          setPhotoUrl(own.photo_url);
          setDominantHand(own.dominant_hand ?? '');
          setPaddle(own.paddle ?? '');
          setPlayingSinceYear(own.playing_since_year?.toString() ?? '');
          setSignatureShot(own.signature_shot ?? '');
        } else {
          setName(u.user_metadata?.full_name ?? '');
        }
      }
      setLoading(false);
    }
    load();
  }, [currentClubId, clubLoading]);

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

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
    if (!user || !currentClubId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await upsertOwnPlayer({
        clubId: currentClubId,
        userId: user.id,
        name: trimmed,
        nickname: nickname.trim() || null,
        photoUrl,
        bio: bio.trim() || null,
        dominantHand: dominantHand || null,
        paddle: paddle.trim() || null,
        playingSinceYear: playingSinceYear ? Number(playingSinceYear) : null,
        signatureShot: signatureShot.trim() || null,
      });
      setSaved(true);
      setDirectory(await listPlayers(currentClubId));
      setTimeout(() => router.push('/'), 600);
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
        <h1>Profile</h1>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>Sign in first to register a player profile.</p>
        <Link href="/login" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
          Sign In
        </Link>
      </main>
    );
  }

  const inputStyle = { width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 };

  return (
    <main className="page">
      <h1>Profile</h1>

      <Link
        href={`/players/${user.id}`}
        className="card"
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, textDecoration: 'none', color: 'inherit' }}
      >
        <Trophy size={20} />
        <span style={{ fontWeight: 700, flex: 1 }}>My Stats Across Clubs</span>
        <span style={{ fontSize: 18 }}>→</span>
      </Link>

      <h2>My Profile</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {photoUrl && (
          <img src={photoUrl} alt="" width={140} height={140} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Photo</label>
          <input type="file" accept="image/*" onChange={e => handlePhotoSelect(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Nickname (optional)</label>
          <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="What people call you on court" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Bio (optional)</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} style={{ ...inputStyle, minHeight: 'unset' }} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Dominant hand (optional)</label>
          <select value={dominantHand} onChange={e => setDominantHand(e.target.value as typeof dominantHand)} style={inputStyle}>
            <option value="">Not set</option>
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="ambidextrous">Ambidextrous</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Paddle (optional)</label>
          <input value={paddle} onChange={e => setPaddle(e.target.value)} placeholder="e.g. Selkirk Vanguard" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Playing since (optional)</label>
          <input
            value={playingSinceYear}
            onChange={e => setPlayingSinceYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Year, e.g. 2023"
            inputMode="numeric"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Signature shot (optional)</label>
          <input value={signatureShot} onChange={e => setSignatureShot(e.target.value)} placeholder="Dink, smash, lob…" style={inputStyle} />
        </div>
        {error && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{error}</p>}
        {saved && <p style={{ color: 'var(--dark)', fontWeight: 700, fontSize: 14 }}>✓ Saved.</p>}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      <h2>Club Directory ({directory.length})</h2>
      <div className="card">
        {directory.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nobody's registered yet.</p>}
        {directory.map(p => {
          const row = (
            <>
              {p.photo_url ? (
                <img src={p.photo_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#eee', display: 'inline-block' }} />
              )}
              <span>
                {p.name}{p.nickname && ` (${p.nickname})`}
                {p.paddle && <span style={{ color: 'var(--muted)', fontSize: 12 }}> · {p.paddle}</span>}
              </span>
            </>
          );
          return p.user_id ? (
            <Link key={p.id} href={`/players/${p.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', color: 'inherit', textDecoration: 'none' }}>
              {row}
            </Link>
          ) : (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              {row}
            </div>
          );
        })}
      </div>

      <h2>Display</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Show player names as</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={namePref === 'nickname' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => {
              setNamePref('nickname');
              setDisplayNamePref('nickname');
            }}
          >
            Nickname
          </button>
          <button
            type="button"
            className={namePref === 'firstName' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => {
              setNamePref('firstName');
              setDisplayNamePref('firstName');
            }}
          >
            First Name
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>This device only — falls back to first name if someone has no nickname set.</p>
      </div>

      <h2>Account</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isCurrentClubAdmin && currentClubId && (
          <Link href={`/clubs/${currentClubId}/settings`} className="btn-secondary" style={{ textAlign: 'center' }}>
            Club Settings
          </Link>
        )}
        <button className="btn-secondary" onClick={handleSignOut} style={{ color: 'var(--danger)' }}>
          Sign Out
        </button>
      </div>
    </main>
  );
}
