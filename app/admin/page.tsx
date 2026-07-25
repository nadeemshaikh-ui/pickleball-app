'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  isSuperAdmin,
  listAllClubsForSuperAdmin,
  resetClubData,
  deleteClub,
  listPendingClubCreationRequests,
  approveClubCreationRequest,
  rejectClubCreationRequest,
  listAllPendingJoinRequestsForSuperAdmin,
  approveJoinRequest,
  rejectJoinRequest,
  listClubMembers,
  setMemberRole,
  setDangerZoneAccess,
  removeMember,
  restoreMember,
  type SuperAdminClubRow,
  type ClubCreationRequestRow,
  type SuperAdminJoinRequestRow,
  type ClubMemberRow,
} from '@/lib/clubs';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { fetchRecentErrorsAllClubs, isTestArtifactError, explainError, type AppErrorRow } from '@/lib/errorLog';
import ConfirmModal from '@/components/ConfirmModal';

export default function SuperAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [clubs, setClubs] = useState<SuperAdminClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [members, setMembers] = useState<ClubMemberRow[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<SuperAdminClubRow | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminClubRow | null>(null);
  const [deletingClub, setDeletingClub] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<AppErrorRow[]>([]);
  const [creationRequests, setCreationRequests] = useState<ClubCreationRequestRow[]>([]);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationLoadError, setCreationLoadError] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<SuperAdminJoinRequestRow[]>([]);
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);
  const [joinRequestLoadError, setJoinRequestLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await isSuperAdmin();
      setAllowed(ok);
      if (ok) {
        setClubs(await listAllClubsForSuperAdmin());
        setErrors(await fetchRecentErrorsAllClubs().catch(() => []));
        try {
          setCreationRequests(await listPendingClubCreationRequests());
        } catch (e) {
          // Don't fold a broken query/policy into "zero pending requests" —
          // that's indistinguishable from the real empty state and a super
          // admin would never notice requests are stuck.
          setCreationLoadError(e instanceof Error ? e.message : 'Failed to load club creation requests.');
        }
        try {
          setJoinRequests(await listAllPendingJoinRequestsForSuperAdmin());
        } catch (e) {
          setJoinRequestLoadError(e instanceof Error ? e.message : 'Failed to load join requests.');
        }
      }
      setLoading(false);
    })();
  }, []);

  async function handleResolveCreation(request: ClubCreationRequestRow, decision: 'approved' | 'rejected') {
    setCreationError(null);
    try {
      if (decision === 'approved') {
        await approveClubCreationRequest(request.id);
      } else {
        await rejectClubCreationRequest(request.id);
      }
      // Remove immediately on RPC success — before the club-list refresh,
      // so a refresh failure can't leave an already-resolved request
      // showing as pending and re-clickable.
      setCreationRequests(prev => prev.filter(r => r.id !== request.id));
      if (decision === 'approved') {
        setClubs(await listAllClubsForSuperAdmin());
      }
    } catch (e) {
      setCreationError(e instanceof Error ? e.message : 'Failed to resolve request.');
    }
  }

  async function handleResolveJoinRequest(request: SuperAdminJoinRequestRow, decision: 'approved' | 'rejected') {
    setJoinRequestError(null);
    try {
      if (decision === 'approved') {
        await approveJoinRequest(request.id);
      } else {
        await rejectJoinRequest(request.id);
      }
      setJoinRequests(prev => prev.filter(r => r.id !== request.id));
      if (decision === 'approved') {
        setClubs(await listAllClubsForSuperAdmin());
      }
    } catch (e) {
      setJoinRequestError(e instanceof Error ? e.message : 'Failed to resolve request.');
    }
  }

  async function toggleExpand(clubId: string) {
    if (expandedClubId === clubId) {
      setExpandedClubId(null);
      return;
    }
    setExpandedClubId(clubId);
    setPlayersLoading(true);
    try {
      const [playerRows, memberRows] = await Promise.all([listPlayers(clubId), listClubMembers(clubId)]);
      setPlayers(playerRows);
      setMembers(memberRows);
    } finally {
      setPlayersLoading(false);
    }
  }

  async function handleSetRole(clubId: string, userId: string, role: 'admin' | 'member') {
    setMemberActionError(null);
    try {
      await setMemberRole(clubId, userId, role);
      setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, role } : m)));
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to update role.');
    }
  }

  async function handleSetDangerZone(clubId: string, userId: string, current: boolean) {
    setMemberActionError(null);
    try {
      await setDangerZoneAccess(clubId, userId, !current);
      setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, danger_zone_access: !current } : m)));
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to update Reset Access.');
    }
  }

  // Cross-club, unlike the club-settings version of this action — real
  // gap found live: remove_club_member/restore_club_member only checked
  // is_club_admin(), so a super admin who wasn't personally a member of
  // the target club got a hard error. Fixed at the RPC level (now accepts
  // is_super_admin() too); this just wires the UI to it.
  async function handleRemoveMember(clubId: string, userId: string) {
    setMemberActionError(null);
    try {
      await removeMember(clubId, userId);
      setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, removed_at: new Date().toISOString() } : m)));
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to remove member.');
    }
  }

  async function handleRestoreMember(clubId: string, userId: string) {
    setMemberActionError(null);
    try {
      await restoreMember(clubId, userId);
      setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, removed_at: null, removed_by: null } : m)));
    } catch (e) {
      setMemberActionError(e instanceof Error ? e.message : 'Failed to restore member.');
    }
  }

  async function handleReset() {
    if (!resetTarget) return;
    setResetting(true);
    setResetMsg(null);
    try {
      await resetClubData(resetTarget.id);
      setResetMsg(`"${resetTarget.name}" reset — all sessions and stats cleared.`);
      if (expandedClubId === resetTarget.id) setPlayers(await listPlayers(resetTarget.id));
    } catch (e) {
      setResetMsg(e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setResetting(false);
      setResetTarget(null);
    }
  }

  async function handleDeleteClub() {
    if (!deleteTarget) return;
    setDeletingClub(true);
    setDeleteMsg(null);
    try {
      await deleteClub(deleteTarget.id);
      setClubs(prev => prev.filter(c => c.id !== deleteTarget.id));
      if (expandedClubId === deleteTarget.id) setExpandedClubId(null);
      setDeleteMsg(`"${deleteTarget.name}" deleted.`);
    } catch (e) {
      setDeleteMsg(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeletingClub(false);
      setDeleteTarget(null);
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!allowed) return <main className="page"><p>Not authorized.</p></main>;

  return (
    <main className="page">
      {(creationRequests.length > 0 || creationLoadError) && (
        <>
          <h1>Pending Club Creation Requests ({creationRequests.length})</h1>
          {creationLoadError && <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>Couldn&apos;t load: {creationLoadError}</p>}
          {creationError && <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>{creationError}</p>}
          <div className="card" style={{ padding: 0, marginBottom: 20 }}>
            {creationRequests.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.requested_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Requested {new Date(r.requested_at).toLocaleDateString()} — this account already has a club</div>
                </div>
                <button className="btn-primary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolveCreation(r, 'approved')}>
                  Approve
                </button>
                <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolveCreation(r, 'rejected')}>
                  Reject
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {(joinRequests.length > 0 || joinRequestLoadError) && (
        <>
          <h1>Pending Join Requests ({joinRequests.length})</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Every club's join requests in one place — no need to open each club's own Settings page.
          </p>
          {joinRequestLoadError && <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>Couldn&apos;t load: {joinRequestLoadError}</p>}
          {joinRequestError && <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>{joinRequestError}</p>}
          <div className="card" style={{ padding: 0, marginBottom: 20 }}>
            {joinRequests.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                {r.photo_url ? (
                  <img src={r.photo_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name ?? 'Unnamed player'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Wants to join <strong>{r.club_name}</strong> — requested {new Date(r.requested_at).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn-primary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolveJoinRequest(r, 'approved')}>
                  Approve
                </button>
                <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolveJoinRequest(r, 'rejected')}>
                  Reject
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h1>All Clubs ({clubs.length})</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Super admin view — every club on the platform, regardless of your own membership. Tap a club to see its roster and reset its data.
      </p>
      {resetMsg && <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{resetMsg}</p>}
      {deleteMsg && <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{deleteMsg}</p>}

      <div className="card" style={{ padding: 0 }}>
        {clubs.map(c => (
          <div key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', flexWrap: 'wrap' }}
              onClick={() => toggleExpand(c.id)}
            >
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.member_count} member{c.member_count === 1 ? '' : 's'}</span>
              <Link
                href={`/clubs/${c.id}/settings`}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px', textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}
              >
                Settings
              </Link>
              <button
                className="btn-secondary"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)', fontSize: 12, padding: '4px 10px' }}
                onClick={e => {
                  e.stopPropagation();
                  setResetTarget(c);
                }}
              >
                Reset
              </button>
              <button
                className="btn-secondary"
                style={{ background: 'var(--danger)', color: 'white', borderColor: 'var(--danger)', fontSize: 12, padding: '4px 10px' }}
                onClick={e => {
                  e.stopPropagation();
                  setDeleteTarget(c);
                }}
              >
                Delete
              </button>
            </div>

            {expandedClubId === c.id && (
              <div style={{ padding: '4px 12px 12px', background: 'var(--muted-bg, rgba(0,0,0,0.02))' }}>
                {memberActionError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12, marginBottom: 8 }}>{memberActionError}</p>}

                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Admins & Roles
                </p>
                {playersLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading members…</p>
                ) : (
                  (() => {
                    const nameByUserId = new Map(players.filter(p => p.user_id).map(p => [p.user_id as string, p.nickname || p.name]));
                    const activeMembers = members.filter(m => !m.removed_at);
                    const removedMembers = members.filter(m => m.removed_at);
                    const adminCount = activeMembers.filter(m => m.role === 'admin').length;
                    return (
                      <div style={{ marginBottom: 14 }}>
                        {activeMembers.length === 0 ? (
                          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No members.</p>
                        ) : (
                          activeMembers.map(m => {
                            const isLastAdmin = m.role === 'admin' && adminCount <= 1;
                            return (
                              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap' }}>
                                <span style={{ flex: 1, fontSize: 13 }}>
                                  {nameByUserId.get(m.user_id) ?? 'Unknown'}
                                  {m.role === 'admin' && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: 'var(--primary)' }}>ADMIN</span>}
                                </span>
                                {m.role === 'admin' && (
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={m.danger_zone_access}
                                      onChange={() => handleSetDangerZone(c.id, m.user_id, m.danger_zone_access)}
                                    />
                                    Reset Access
                                  </label>
                                )}
                                <button
                                  className="btn-secondary"
                                  style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}
                                  onClick={() => handleSetRole(c.id, m.user_id, m.role === 'admin' ? 'member' : 'admin')}
                                  disabled={isLastAdmin}
                                  title={isLastAdmin ? "Club needs at least one admin — promote someone else first" : undefined}
                                >
                                  {m.role === 'admin' ? 'Make Member' : 'Make Admin'}
                                </button>
                                <button
                                  className="btn-secondary"
                                  style={{ minHeight: 26, padding: '2px 8px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                  onClick={() => handleRemoveMember(c.id, m.user_id)}
                                  disabled={isLastAdmin}
                                  title={isLastAdmin ? "Club needs at least one admin — promote someone else first" : undefined}
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })
                        )}
                        {removedMembers.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                            <p style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Removed</p>
                            {removedMembers.map(m => (
                              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                                <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{nameByUserId.get(m.user_id) ?? 'Unknown'}</span>
                                <button
                                  className="btn-secondary"
                                  style={{ minHeight: 26, padding: '2px 8px', fontSize: 11 }}
                                  onClick={() => handleRestoreMember(c.id, m.user_id)}
                                >
                                  Restore
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}

                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Roster
                </p>
                {playersLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading roster…</p>
                ) : players.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>No players registered yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                        <th style={{ padding: '4px 6px', fontWeight: 700 }}>Player</th>
                        <th style={{ padding: '4px 6px', fontWeight: 700 }}>Games</th>
                        <th style={{ padding: '4px 6px', fontWeight: 700 }}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map(p => (
                        <tr key={p.id}>
                          <td style={{ padding: '4px 6px' }}>{p.nickname || p.name}</td>
                          <td style={{ padding: '4px 6px' }}>{p.games_played}</td>
                          <td style={{ padding: '4px 6px' }}>{Math.round(p.elo_rating)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>Errors — All Clubs</h2>
      {(() => {
        const realErrors = errors.filter(e => !isTestArtifactError(e));
        const testErrors = errors.filter(e => isTestArtifactError(e));
        return (
          <>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              {realErrors.length} real error{realErrors.length === 1 ? '' : 's'} from actual visitors
              {testErrors.length > 0 && ` — ${testErrors.length} test-run error${testErrors.length === 1 ? '' : 's'} hidden below`}.
            </p>
            {realErrors.length === 0 ? (
              <p className="card" style={{ fontSize: 13, color: 'var(--muted)' }}>No real errors logged — nothing to act on right now.</p>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto', marginBottom: testErrors.length > 0 ? 10 : 0 }}>
                {realErrors.map(e => (
                  <div key={e.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--muted)' }}>
                      <span>{clubs.find(c => c.id === e.club_id)?.name ?? 'Unknown club'} · {e.path ?? '—'}</span>
                      <span>{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 2, wordBreak: 'break-word' }}>{e.message}</div>
                    {explainError(e.message) && (
                      <div style={{ color: 'var(--muted)', marginTop: 2 }}>💡 {explainError(e.message)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {testErrors.length > 0 && (
              <details>
                <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
                  Test-run noise ({testErrors.length}) — from the e2e suite, safe to ignore
                </summary>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginTop: 8 }}>
                  {testErrors.map(e => (
                    <div key={e.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, fontSize: 12, opacity: 0.6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--muted)' }}>
                        <span>{e.path ?? '—'}</span>
                        <span>{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ marginTop: 2, wordBreak: 'break-word' }}>{e.message}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        );
      })()}

      {resetTarget && (
        <ConfirmModal
          title="Reset all club data?"
          message={`This permanently deletes every session, match, badge, and streak record for "${resetTarget.name}". Player names/photos are kept, stats reset to zero. This cannot be undone.`}
          confirmLabel={resetting ? 'Resetting…' : 'Reset Club Data'}
          danger
          requireText={resetTarget.name}
          onConfirm={handleReset}
          onCancel={() => setResetTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this club?"
          message={`This permanently removes "${deleteTarget.name}" itself — every member, session, tournament, and stat tied to it. There is no undo. Use this for test/dummy clubs, not a real club you just want to reset.`}
          confirmLabel={deletingClub ? 'Deleting…' : 'Delete Club'}
          danger
          requireText={deleteTarget.name}
          onConfirm={handleDeleteClub}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}
