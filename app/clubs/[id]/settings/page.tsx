'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserPlus, Share2, AlertTriangle, Code2 } from 'lucide-react';
import {
  listMyClubs,
  listPendingJoinRequests,
  resolveJoinRequest,
  updateClubBranding,
  updateClubUpiVpa,
  listClubMembers,
  setDangerZoneAccess,
  resetClubData,
  type ClubRow,
  type JoinRequestRow,
  type ClubMemberRow,
} from '@/lib/clubs';
import { listPlayers } from '@/lib/players';
import { getCurrentUser } from '@/lib/auth';
import { shareElementAsImage } from '@/lib/shareImage';
import ConfirmModal from '@/components/ConfirmModal';
import { isDevModeEnabled, setDevModeEnabled } from '@/lib/devMode';

export default function ClubSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [club, setClub] = useState<ClubRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<JoinRequestRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<ClubMemberRow[]>([]);
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
  const [ownDangerZoneAccess, setOwnDangerZoneAccess] = useState(false);
  const [ownUserId, setOwnUserId] = useState<string | null>(null);

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
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
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
      const [req, memberRows, playerRows, user] = await Promise.all([
        listPendingJoinRequests(id),
        listClubMembers(id),
        listPlayers(id),
        getCurrentUser(),
      ]);
      setPending(req);
      setMemberCount(memberRows.length);
      setMembers(memberRows);
      setMemberNames(new Map(playerRows.filter(p => p.user_id).map(p => [p.user_id as string, p.name])));
      setOwnUserId(user?.id ?? null);
      setOwnDangerZoneAccess(memberRows.find(m => m.user_id === user?.id)?.danger_zone_access ?? false);
    }
    setLoading(false);
  }

  async function handleToggleDangerZone(userId: string, current: boolean) {
    try {
      await setDangerZoneAccess(id, userId, !current);
      setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, danger_zone_access: !current } : m)));
      if (userId === ownUserId) setOwnDangerZoneAccess(!current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update access.');
    }
  }

  useEffect(() => {
    load();
    setDevMode(isDevModeEnabled());
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

  async function handleResetClub() {
    if (!club) return;
    setShowResetConfirm(false);
    setResetting(true);
    setResetMsg(null);
    try {
      await resetClubData(id);
      setResetMsg('Club data reset. All sessions and stats cleared.');
    } catch (e) {
      setResetMsg(e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setResetting(false);
    }
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
        <p style={{ fontSize: 14, marginBottom: 10 }}>{memberCount} member{memberCount === 1 ? '' : 's'}</p>
        {members.filter(m => m.role === 'admin').map(m => (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span style={{ flex: 1, fontSize: 13 }}>{memberNames.get(m.user_id) ?? 'Unknown'}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={m.danger_zone_access}
                onChange={() => handleToggleDangerZone(m.user_id, m.danger_zone_access)}
              />
              Danger Zone access
            </label>
          </div>
        ))}
      </div>

      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Code2 size={18} /> Developer Mode</h2>
      <div className="card">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={devMode}
            onChange={e => {
              setDevMode(e.target.checked);
              setDevModeEnabled(e.target.checked);
            }}
          />
          <span style={{ fontSize: 13 }}>
            Show a floating debug panel (your user/club id, role, current route, recent errors) — this browser only.
          </span>
        </label>
      </div>

      <h2 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={18} /> Danger Zone</h2>
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Permanently deletes every session, match, badge, and streak record for this club — e.g. to start a new season.
          Player roster (names, photos) is kept; their stats reset to zero. Cannot be undone.
        </p>
        {resetMsg && <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{resetMsg}</p>}
        {ownDangerZoneAccess ? (
          <button
            className="btn-secondary"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
          >
            {resetting ? 'Resetting…' : 'Reset All Club Data'}
          </button>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            You don&apos;t have Danger Zone access. Ask another admin to grant it above.
          </p>
        )}
      </div>

      {showResetConfirm && club && (
        <ConfirmModal
          title="Reset all club data?"
          message={`This permanently deletes every session, match, badge, and streak record for "${club.name}". Player names/photos are kept, stats reset to zero. This cannot be undone.`}
          confirmLabel="Reset Club Data"
          danger
          requireText={club.name}
          onConfirm={handleResetClub}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </main>
  );
}
