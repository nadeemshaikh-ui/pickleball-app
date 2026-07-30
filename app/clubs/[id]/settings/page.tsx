'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserPlus, Share2, AlertTriangle, Code2, AlertOctagon } from 'lucide-react';
import {
  listMyClubs,
  getClubById,
  isSuperAdmin,
  listPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  updateClubBranding,
  updateClubUpiVpa,
  updateClubDescription,
  listClubMembers,
  setDangerZoneAccess,
  setMemberRole,
  removeMember,
  restoreMember,
  permanentlyDeleteMember,
  resolveMemberDisplayName,
  formatEmailName,
  resetClubData,
  type ClubRow,
  type JoinRequestRow,
  type ClubMemberRow,
} from '@/lib/clubs';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import ConfirmModal from '@/components/ConfirmModal';
import { isDevModeEnabled, setDevModeEnabled } from '@/lib/devMode';
import { fetchRecentErrorsForClub, type AppErrorRow } from '@/lib/errorLog';
import ShareClubInviteButton from '@/components/ShareClubInviteButton';

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
  const [errors, setErrors] = useState<AppErrorRow[]>([]);

  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFile2, setLogoFile2] = useState<File | null>(null);
  const [upiVpa, setUpiVpa] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [upiSavedMsg, setUpiSavedMsg] = useState<string | null>(null);
  const [descriptionSavedMsg, setDescriptionSavedMsg] = useState<string | null>(null);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [unlinkedPlayers, setUnlinkedPlayers] = useState<PlayerRow[]>([]);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [inviteImageFile, setInviteImageFile] = useState<File | null>(null);
  const inviteCaptureRef = useRef<HTMLDivElement>(null);

  const [manualName, setManualName] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  async function handleAddManualPlayer() {
    if (!manualName.trim()) return;
    setManualSubmitting(true);
    setMemberActionError(null);
    setManualSuccessMsg(null);
    try {
      const rawInput = manualName.trim();
      const isEmail = rawInput.includes('@');
      const displayName = isEmail ? formatEmailName(rawInput) : rawInput;
      const playerEmail = isEmail ? rawInput.toLowerCase() : null;
      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ club_id: id, name: displayName, email: playerEmail, user_id: null })
        .select('*')
        .single();
      if (error) throw error;
      setUnlinkedPlayers(prev => [...prev, newPlayer]);
      setMemberCount(c => c + 1);
      setManualSuccessMsg(`Successfully added "${displayName}" to the club roster!`);
      setManualName('');
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to add player.');
    } finally {
      setManualSubmitting(false);
    }
  }

  async function load() {
    const [memberships, superAdmin] = await Promise.all([
      listMyClubs(),
      isSuperAdmin().catch(() => false),
    ]);
    const mine = memberships.find(m => m.club_id === id);
    const hasAdminAccess = mine?.role === 'admin' || superAdmin;
    setIsAdmin(hasAdminAccess);

    let currentClubData = mine?.club ?? null;
    if (!currentClubData && superAdmin) {
      currentClubData = await getClubById(id);
    }

    if (currentClubData) {
      setClub(currentClubData);
      setName(currentClubData.name);
      setUpiVpa(currentClubData.upi_vpa ?? '');
      setDescription(currentClubData.description ?? '');
    }

    if (hasAdminAccess) {
      const [req, memberRows, playerRows, user, errorRows] = await Promise.all([
        listPendingJoinRequests(id),
        listClubMembers(id),
        listPlayers(id),
        getCurrentUser(),
        fetchRecentErrorsForClub(id).catch(() => []),
      ]);
      const unlinked = playerRows.filter(p => !p.user_id);
      setPending(req);
      setUnlinkedPlayers(unlinked);
      setMemberCount(memberRows.filter(m => !m.removed_at).length + unlinked.length);
      setMembers(memberRows);
      setMemberNames(new Map(playerRows.filter(p => p.user_id).map(p => [p.user_id as string, p.name])));
      setOwnUserId(user?.id ?? null);
      setOwnDangerZoneAccess(superAdmin || (memberRows.find(m => m.user_id === user?.id)?.danger_zone_access ?? false));
      setErrors(errorRows);
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

  const [demoteTarget, setDemoteTarget] = useState<{ userId: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);

  async function handleSetRole(userId: string, role: 'admin' | 'member') {
    setMemberActionError(null);
    try {
      await setMemberRole(id, userId, role);
      setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, role } : m)));
      setDemoteTarget(null);
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to update role.');
    }
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setMemberActionError(null);
    try {
      await removeMember(id, removeTarget.userId);
      setMembers(prev => prev.map(m => (m.user_id === removeTarget.userId ? { ...m, removed_at: new Date().toISOString() } : m)));
      setMemberCount(c => Math.max(0, c - 1));
      setRemoveTarget(null);
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to remove member.');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setMemberActionError(null);
    try {
      await permanentlyDeleteMember(id, deleteTarget.userId);
      setMembers(prev => prev.filter(m => m.user_id !== deleteTarget.userId));
      setMemberCount(c => Math.max(0, c - 1));
      setDeleteTarget(null);
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to delete member.');
    }
  }

  async function handleRestore(userId: string) {
    setMemberActionError(null);
    try {
      await restoreMember(id, userId);
      setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, removed_at: null, removed_by: null } : m)));
      setMemberCount(c => c + 1);
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to restore member.');
    }
  }

  async function handleDeleteUnlinkedPlayer(playerId: string) {
    if (!confirm('Permanently delete this player from the club roster?')) return;
    setMemberActionError(null);
    try {
      const { error } = await supabase.from('players').delete().eq('id', playerId);
      if (error) throw error;
      setUnlinkedPlayers(prev => prev.filter(p => p.id !== playerId));
      setMemberCount(c => Math.max(0, c - 1));
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to delete player.');
    }
  }

  useEffect(() => {
    load();
    setDevMode(isDevModeEnabled());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pre-render the invite image as soon as the join code is ready, well
  // before the user clicks share — rendering inside the click handler burns
  // the browser's user-gesture window on some mobile browsers, so
  // navigator.share() gets silently rejected even though canShare() said
  // yes. Same fix already applied to the session recap and Team
  // Championship stage share buttons.
  useEffect(() => {
    if (!club?.join_code || !inviteCaptureRef.current) return;
    renderElementToImage(inviteCaptureRef.current, `invite-${id}.png`)
      .then(file => {
        setInviteImageFile(file);
        setImageShareError(null);
      })
      .catch(e => {
        setInviteImageFile(null);
        setImageShareError(e instanceof Error ? `Couldn't prepare the image: ${e.message}` : "Couldn't prepare the image.");
      });
  }, [club, id]);

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

  async function handleSaveDescription() {
    setSavingDescription(true);
    setDescriptionSavedMsg(null);
    try {
      await updateClubDescription(id, description.trim() || null);
      setDescriptionSavedMsg('Saved.');
    } catch (e) {
      setDescriptionSavedMsg(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSavingDescription(false);
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
    setError(null);
    try {
      if (decision === 'approved') {
        await approveJoinRequest(request.id);
      } else {
        await rejectJoinRequest(request.id);
      }
      setPending(prev => prev.filter(r => r.id !== request.id));
      if (decision === 'approved') setMemberCount(c => c + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve request.');
    }
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
    setImageShareError(null);
    try {
      const file = inviteImageFile ?? (inviteCaptureRef.current ? await renderElementToImage(inviteCaptureRef.current, `invite-${id}.png`) : null);
      if (!file) {
        setImageShareError("Couldn't prepare the image — try again.");
        return;
      }
      const result = await shareCachedImage(file);
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

      <h2>About</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Shown on the club dashboard everyone sees
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this club about? Who's it for?"
            rows={3}
            style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical' }}
          />
        </div>
        {descriptionSavedMsg && <p style={{ color: 'var(--dark)', fontWeight: 700, fontSize: 13 }}>{descriptionSavedMsg}</p>}
        <button className="btn-primary" onClick={handleSaveDescription} disabled={savingDescription}>
          {savingDescription ? 'Saving…' : 'Save Description'}
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
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={16} /> Join {club.name}!
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
            Share this link on WhatsApp — joining is 100% instant with Google Sign-In, no admin approval needed:
          </p>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>{club.join_code}</div>
        </div>
        <ShareClubInviteButton clubName={club.name} joinCode={club.join_code} fullWidth />
      </div>

      <h2>Pending Join Requests ({pending.length})</h2>
      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <div className="card">
        {pending.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No pending requests.</p>}
        {pending.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            {r.photo_url ? (
              <img src={r.photo_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name ?? 'Unnamed player'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {[r.dominant_hand, r.paddle, r.playing_since_year ? `since ${r.playing_since_year}` : null].filter(Boolean).join(' · ') || `Requested ${new Date(r.requested_at).toLocaleDateString()}`}
              </div>
            </div>
            <button className="btn-primary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolve(r, 'approved')}>
              Approve
            </button>
            <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolve(r, 'rejected')}>
              Reject
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12, borderColor: 'var(--primary)' }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Add Player Manually to Club</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4, marginBottom: 10 }}>
          Register a player directly on your club roster so they can play matches immediately before signing in with Google.
        </p>
        {manualSuccessMsg && <p style={{ color: 'var(--success, #22c55e)', fontWeight: 600, fontSize: 13, margin: '4px 0 8px' }}>{manualSuccessMsg}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            placeholder="Player Full Name (e.g. Viki Rajani)"
            aria-label="Player full name"
            style={{ flex: 1, minHeight: 38, padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <button
            className="btn-primary"
            onClick={handleAddManualPlayer}
            disabled={manualSubmitting || !manualName.trim()}
            style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}
          >
            {manualSubmitting ? 'Adding…' : 'Add Player'}
          </button>
        </div>
      </div>

      <h2>Members</h2>
      {memberActionError && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{memberActionError}</p>}
      <div className="card">
        <p style={{ fontSize: 14, marginBottom: 10 }}>{memberCount} member{memberCount === 1 ? '' : 's'}</p>
        {members.filter(m => !m.removed_at).map(m => {
          const adminCount = members.filter(x => !x.removed_at && x.role === 'admin').length;
          const isLastAdmin = m.role === 'admin' && adminCount <= 1;
          return (
            <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 140, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {resolveMemberDisplayName({
                      player_name: memberNames.get(m.user_id),
                      google_name: m.google_name,
                      email: m.email,
                    })}
                  </span>
                  {m.role === 'admin' && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      ADMIN
                    </span>
                  )}
                </div>
                {m.email && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, justifyContent: 'flex-end' }}>
                {m.role === 'admin' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', marginRight: 2 }}>
                    <input
                      type="checkbox"
                      checked={m.danger_zone_access}
                      onChange={() => handleToggleDangerZone(m.user_id, m.danger_zone_access)}
                    />
                    Reset Access
                  </label>
                )}
                <button
                  className="btn-secondary"
                  style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap' }}
                  onClick={() => {
                    const memberName = resolveMemberDisplayName({ player_name: memberNames.get(m.user_id), google_name: m.google_name, email: m.email });
                    if (m.role === 'admin') {
                      setDemoteTarget({ userId: m.user_id, name: memberName });
                    } else {
                      handleSetRole(m.user_id, 'admin');
                    }
                  }}
                  disabled={isLastAdmin}
                  title={isLastAdmin ? "Club needs at least one admin — promote someone else first" : undefined}
                >
                  {m.role === 'admin' ? 'Make Member' : 'Make Admin'}
                </button>
                {m.user_id !== ownUserId && (
                  <>
                    <button
                      className="btn-secondary"
                      style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, borderColor: 'var(--danger)', color: 'var(--danger)', whiteSpace: 'nowrap' }}
                      onClick={() => setRemoveTarget({ userId: m.user_id, name: resolveMemberDisplayName({ player_name: memberNames.get(m.user_id), google_name: m.google_name, email: m.email }) })}
                    >
                      Remove
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, background: 'var(--danger)', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => setDeleteTarget({ userId: m.user_id, name: resolveMemberDisplayName({ player_name: memberNames.get(m.user_id), google_name: m.google_name, email: m.email }) })}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {unlinkedPlayers.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              {p.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.email}</div>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button
                className="btn-secondary"
                style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap' }}
                onClick={() => alert(`"${p.name}" will automatically receive Admin rights when they sign in with Google.`)}
              >
                Make Admin
              </button>
              <button
                className="btn-secondary"
                style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, borderColor: 'var(--danger)', color: 'var(--danger)', whiteSpace: 'nowrap' }}
                onClick={() => handleDeleteUnlinkedPlayer(p.id)}
              >
                Remove
              </button>
              <button
                className="btn-secondary"
                style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, background: 'var(--danger)', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
                onClick={() => handleDeleteUnlinkedPlayer(p.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {members.some(m => m.removed_at) && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Removed</p>
            {members.filter(m => m.removed_at).map(m => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{memberNames.get(m.user_id) ?? 'Unknown'}</span>
                <button className="btn-secondary" style={{ minHeight: 28, padding: '3px 10px', fontSize: 12 }} onClick={() => handleRestore(m.user_id)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {removeTarget && (
        <ConfirmModal
          title="Remove member?"
          message={`${removeTarget.name} will lose access to this club. Their match history and stats stay intact and can be restored later.`}
          confirmLabel="Remove"
          onConfirm={handleConfirmRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

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

      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertOctagon size={18} /> Errors</h2>
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Client errors from any member's browser, across your whole club — not just yours. Last {errors.length} shown.
        </p>
        {errors.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No errors logged for this club yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {errors.map(e => (
              <div key={e.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--muted)' }}>
                  <span>{e.path ?? '—'}</span>
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                </div>
                <div style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 2, wordBreak: 'break-word' }}>{e.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={18} /> Data Reset</h2>
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
            You don&apos;t have Reset Access. Ask another admin to grant it above.
          </p>
        )}
      </div>

      {demoteTarget && (
        <ConfirmModal
          title="Revoke Admin Privileges"
          message={`Are you sure you want to revoke Admin rights from ${demoteTarget.name}? They will become a regular member.`}
          confirmLabel="Revoke Admin Rights"
          danger
          onConfirm={() => handleSetRole(demoteTarget.userId, 'member')}
          onCancel={() => setDemoteTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Permanently Delete Member"
          message={`CAUTION: Are you sure you want to permanently delete ${deleteTarget.name}? This action cannot be undone.`}
          confirmLabel="Permanently Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

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
