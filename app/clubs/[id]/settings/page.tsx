'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserPlus, Share2 } from 'lucide-react';
import {
  listMyClubs,
  listPendingJoinRequests,
  resolveJoinRequest,
  updateClubBranding,
  updateClubUpiVpa,
  listClubMembers,
  type ClubRow,
  type JoinRequestRow,
} from '@/lib/clubs';
import { shareElementAsImage } from '@/lib/shareImage';

export default function ClubSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [club, setClub] = useState<ClubRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<JoinRequestRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFile2, setLogoFile2] = useState<File | null>(null);
  const [upiVpa, setUpiVpa] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [upiSavedMsg, setUpiSavedMsg] = useState<string | null>(null);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const inviteCaptureRef = useRef<HTMLDivElement>(null);

  async function load() {
    const memberships = await listMyClubs();
    const mine = memberships.find(m => m.club_id === id);
    setIsAdmin(mine?.role === 'admin');
    if (mine) {
      setClub(mine.club);
      setName(mine.club.name);
      setUpiVpa(mine.club.upi_vpa ?? '');
    }
    if (mine?.role === 'admin') {
      const [req, members] = await Promise.all([listPendingJoinRequests(id), listClubMembers(id)]);
      setPending(req);
      setMemberCount(members.length);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveBranding() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await updateClubBranding(id, name.trim(), logoFile, logoFile2);
      setSavedMsg('Saved.');
      setLogoFile(null);
      setLogoFile2(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveUpi() {
    setSavingUpi(true);
    setUpiSavedMsg(null);
    try {
      await updateClubUpiVpa(id, upiVpa.trim() || null);
      setUpiSavedMsg('Saved.');
    } catch (e) {
      setUpiSavedMsg(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSavingUpi(false);
    }
  }

  async function handleResolve(request: JoinRequestRow, decision: 'approved' | 'rejected') {
    await resolveJoinRequest(request, decision);
    setPending(prev => prev.filter(r => r.id !== request.id));
    if (decision === 'approved') setMemberCount(c => c + 1);
  }

  async function handleShareInvite() {
    if (!inviteCaptureRef.current) return;
    setImageShareError(null);
    try {
      const result = await shareElementAsImage(inviteCaptureRef.current, `invite-${id}.png`);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!club) return <main className="page"><p>Club not found, or you're not a member.</p></main>;
  if (!isAdmin) return <main className="page"><p>Only this club's admin can view settings.</p></main>;

  return (
    <main className="page">
      <Link href="/clubs" className="text-link-btn">← Clubs</Link>
      <h1>{club.name} Settings</h1>

      <h2>Branding</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(club.logo_url || club.logo_url_2) && (
          <div style={{ display: 'flex', gap: 12 }}>
            {club.logo_url && <img src={club.logo_url} alt="" width={56} height={56} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
            {club.logo_url_2 && <img src={club.logo_url_2} alt="" width={56} height={56} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
          </div>
        )}
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>Club name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Replace logo 1
          </label>
          <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Replace logo 2 (optional — shown alongside logo 1 on session/league headers)
          </label>
          <input type="file" accept="image/*" onChange={e => setLogoFile2(e.target.files?.[0] ?? null)} />
        </div>
        {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
        {savedMsg && <p style={{ color: 'var(--dark)', fontWeight: 700, fontSize: 13 }}>{savedMsg}</p>}
        <button className="btn-primary" onClick={handleSaveBranding} disabled={saving}>
          {saving ? 'Saving…' : 'Save Branding'}
        </button>
      </div>

      <h2>Dues Payment</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            UPI ID (for the pay link on dues)
          </label>
          <input
            value={upiVpa}
            onChange={e => setUpiVpa(e.target.value)}
            placeholder="yourname@upi"
            style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        {upiSavedMsg && <p style={{ color: 'var(--dark)', fontWeight: 700, fontSize: 13 }}>{upiSavedMsg}</p>}
        <button className="btn-primary" onClick={handleSaveUpi} disabled={savingUpi}>
          {savingUpi ? 'Saving…' : 'Save UPI ID'}
        </button>
      </div>

      <h2>Invite</h2>
      <div className="card">
        <div ref={inviteCaptureRef} style={{ padding: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={16} /> Join {club.name}!</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Share this code — joining is instant, no approval needed:</p>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>{club.join_code}</div>
        </div>
        {imageShareError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{imageShareError}</p>}
        <button
          className="btn-secondary"
          style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 12 }}
          onClick={handleShareInvite}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Share2 size={15} /> Share Invite on WhatsApp</span>
        </button>
      </div>

      <h2>Pending Join Requests ({pending.length})</h2>
      <div className="card">
        {pending.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No pending requests.</p>}
        {pending.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>Requested {new Date(r.requested_at).toLocaleDateString()}</span>
            <button className="btn-primary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolve(r, 'approved')}>
              Approve
            </button>
            <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolve(r, 'rejected')}>
              Reject
            </button>
          </div>
        ))}
      </div>

      <h2>Members</h2>
      <div className="card">
        <p style={{ fontSize: 14 }}>{memberCount} member{memberCount === 1 ? '' : 's'}</p>
      </div>
    </main>
  );
}
