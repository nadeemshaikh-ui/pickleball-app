'use client';

import { use, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Trophy, Crown, Flame, Users2, IndianRupee, UserPlus } from 'lucide-react';
import {
  listMyClubs,
  listClubMembers,
  fetchRemovedMemberNames,
  listPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  removeMember,
  permanentlyDeleteMember,
  setMemberRole,
  resolveMemberDisplayName,
  type ClubRow,
  type ClubMemberRow,
  type JoinRequestRow,
} from '@/lib/clubs';
import ConfirmModal from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabase';
import { listPlayers, upsertOwnPlayer, type PlayerRow } from '@/lib/players';
import { fetchLifetimeLeaderboard, fetchCrownBoards, fetchBestDuos, type RankedPlayer, type CrownBoard, type RankedDuo } from '@/lib/leagueStats';
import { computeCurrentStreaks } from '@/lib/streakRecords';
import { fetchMyDuesForClub, buildUpiDeepLink, type MyDueRow } from '@/lib/dues';
import { listSessions, type SessionRow } from '@/lib/db';
import { fetchTournaments, type TournamentRow } from '@/lib/tournaments';
import { formatLabel } from '@/lib/formatLabel';
import SignInGate from '@/components/SignInGate';
import { useCurrentClub } from '@/lib/useCurrentClub';
import ShareClubInviteButton from '@/components/ShareClubInviteButton';

// Format-specific results routing — Team Championship's stage/rapid-fire
// scoring produces a different results page than every other format.
function resultsLinkFor(s: SessionRow): string {
  if (s.status === 'in_progress') return `/session/${s.id}/schedule`;
  return s.format === 'team_championship' ? `/session/${s.id}/team-championship/results` : `/session/${s.id}/results`;
}

export default function ClubDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: userLoading } = useCurrentClub();
  const [club, setClub] = useState<ClubRow | null>(null);
  const [role, setRole] = useState<'admin' | 'member' | null>(null);
  const [members, setMembers] = useState<ClubMemberRow[]>([]);
  const [playersByUserId, setPlayersByUserId] = useState<Map<string, PlayerRow>>(new Map());
  const [leaderboard, setLeaderboard] = useState<RankedPlayer[]>([]);
  const [crowns, setCrowns] = useState<CrownBoard[]>([]);
  const [streaks, setStreaks] = useState<Map<string, { type: 'win' | 'loss'; length: number }>>(new Map());
  const [bestDuo, setBestDuo] = useState<RankedDuo | null>(null);
  const [myDues, setMyDues] = useState<MyDueRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [unlinkedPlayers, setUnlinkedPlayers] = useState<PlayerRow[]>([]);
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notMember, setNotMember] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const userId = user.id;
    async function load() {
      try {
        const memberships = await listMyClubs();
        const mine = memberships.find(m => m.club_id === id);
        if (!mine) {
          setNotMember(true);
          return;
        }
        setClub(mine.club);
        setRole(mine.role);
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentClubId', id);
        }
        let [memberRows, playerRows, board, crownBoards, currentStreaks, duos, recentSessions, clubTournaments, removedNames] = await Promise.all([
          listClubMembers(id),
          listPlayers(id),
          fetchLifetimeLeaderboard(id),
          fetchCrownBoards(id),
          computeCurrentStreaks(id),
          fetchBestDuos(id),
          listSessions(id, 10),
          fetchTournaments(id).catch(() => []),
          fetchRemovedMemberNames(id),
        ]);

        // Auto-heal missing or unnamed player profile using Google Auth metadata
        let ownPlayer = playerRows.find(p => p.user_id === userId);
        if (user && (!ownPlayer || !ownPlayer.name || ownPlayer.name === 'Unnamed player')) {
          const googleName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Player');
          const googlePhoto = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
          try {
            await upsertOwnPlayer({
              clubId: id,
              userId: userId,
              name: googleName,
              nickname: null,
              photoUrl: googlePhoto,
              bio: null,
            });
            playerRows = await listPlayers(id);
            ownPlayer = playerRows.find(p => p.user_id === userId);
          } catch {
            // Ignore if RLS or network issue
          }
        }
        setMembers(memberRows.filter(m => !m.removed_at));
        setUnlinkedPlayers(playerRows.filter(p => !p.user_id));
        setPlayersByUserId(new Map(playerRows.filter(p => p.user_id).map(p => [p.user_id as string, p])));
        setLeaderboard(board.filter(p => !removedNames.has(p.name)));
        setCrowns(
          crownBoards
            .map(c => ({ ...c, standings: c.standings.filter(s => !removedNames.has(s.name)) }))
            .filter(c => c.standings.length > 0)
        );
        setStreaks(currentStreaks);
        setBestDuo(duos.filter(d => !d.provisional).sort((a, b) => b.winPct - a.winPct || b.gamesPlayed - a.gamesPlayed)[0] ?? null);
        setSessions(recentSessions);
        setTournaments(clubTournaments);

        if (ownPlayer) fetchMyDuesForClub(id, ownPlayer.name).then(setMyDues).catch(() => {});

        if (mine.role === 'admin') {
          try {
            setJoinRequests(await listPendingJoinRequests(id));
          } catch (e) {
            setJoinRequestError(e instanceof Error ? e.message : 'Failed to load join requests.');
          }
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load club.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, user, userLoading]);

  async function handleResolveJoinRequest(request: JoinRequestRow, decision: 'approved' | 'rejected') {
    setJoinRequestError(null);
    try {
      if (decision === 'approved') {
        await approveJoinRequest(request.id);
      } else {
        await rejectJoinRequest(request.id);
      }
      setJoinRequests(prev => prev.filter(r => r.id !== request.id));
      if (decision === 'approved') {
        const [memberRows, playerRows] = await Promise.all([listClubMembers(id), listPlayers(id)]);
        setMembers(memberRows.filter(m => !m.removed_at));
        setPlayersByUserId(new Map(playerRows.filter(p => p.user_id).map(p => [p.user_id as string, p])));
      }
    } catch (e) {
      setJoinRequestError(e instanceof Error ? e.message : 'Failed to resolve request.');
    }
  }

  const [confirmTarget, setConfirmTarget] = useState<{
    action: 'role' | 'remove' | 'delete' | 'delete_player';
    userId: string;
    name: string;
    targetRole?: 'admin' | 'member';
  } | null>(null);

  async function executeConfirmAction() {
    if (!confirmTarget) return;
    const { action, userId, targetRole } = confirmTarget;
    setConfirmTarget(null);
    try {
      if (action === 'role' && targetRole) {
        await setMemberRole(id, userId, targetRole);
        setMembers(prev => prev.map(m => (m.user_id === userId ? { ...m, role: targetRole } : m)));
      } else if (action === 'remove') {
        await removeMember(id, userId);
        setMembers(prev => prev.filter(m => m.user_id !== userId));
      } else if (action === 'delete') {
        await permanentlyDeleteMember(id, userId);
        setMembers(prev => prev.filter(m => m.user_id !== userId));
      } else if (action === 'delete_player') {
        const { error } = await supabase.from('players').delete().eq('id', userId);
        if (error) throw error;
        setUnlinkedPlayers(prev => prev.filter(p => p.id !== userId));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed.');
    }
  }

  if (userLoading || loading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to view this club." />;
  if (loadError) {
    return (
      <main className="page">
        <Link href="/clubs" className="text-link-btn">← Clubs</Link>
        <p style={{ color: 'var(--danger)', marginTop: 12 }}>{loadError}</p>
      </main>
    );
  }
  if (notMember || !club) {
    return (
      <main className="page">
        <Link href="/clubs" className="text-link-btn">← Clubs</Link>
        <p style={{ color: 'var(--muted)', marginTop: 12 }}>You&apos;re not a member of this club.</p>
      </main>
    );
  }

  const topPlayers = leaderboard.filter(p => !p.provisional).slice(0, 5);

  return (
    <main className="page">
      <Link href="/clubs" className="text-link-btn">← Clubs</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
        {club.logo_url ? (
          <img src={club.logo_url} alt="" width={56} height={56} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {club.name}
            {role === 'admin' && (
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 4, padding: '2px 6px' }}>
                Admin
              </span>
            )}
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            {members.length} member{members.length === 1 ? '' : 's'} · est. {new Date(club.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <ShareClubInviteButton clubName={club.name} joinCode={club.join_code} fullWidth />
      </div>

      {/* DEDICATED COMBINED CLUB ANALYTICS BANNER */}
      <div className="card" style={{ marginBottom: 16, border: '2px solid #0f172a', background: '#0f172a', color: '#ffffff', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, color: '#e5fa00', background: 'rgba(229,250,0,0.1)', padding: '3px 8px', borderRadius: 4 }}>
              DEDICATED CLUB ANALYTICS & PLAYER PERFORMANCE HUB
            </span>
            <h2 style={{ margin: '6px 0 0 0', fontSize: 20, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 Combined Tournament Analytics
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
              Deep stats for all 139 matches across both tournaments: Player Self-Audit, Multi-Select Player Filter, Duo Synergy & Nemesis H2H.
            </p>
          </div>
          <Link
            href={`/clubs/${id}/analytics`}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: 900, textDecoration: 'none', background: '#e5fa00', color: '#0f172a', borderRadius: 10 }}
          >
            Open Analytics Page →
          </Link>
        </div>
      </div>

      {/* Active Tournament & Running Sessions Banner */}
      {(() => {
        const inProgress = sessions.filter(s => s.status === 'in_progress');
        const isPickleboysClub = club.id === 'a99a150f-7bb8-4b4a-ab86-90f945dcbf36' || club.name.toLowerCase().replace(/[^a-z]/g, '').includes('pickleboys');
        if (inProgress.length === 0 && !isPickleboysClub) return null;

        return (
          <div className="card" style={{ marginBottom: 16, border: '2px solid #2563eb', background: 'linear-gradient(135deg, rgba(37,99,235,0.05) 0%, rgba(37,99,235,0.02) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: 4 }}>
                  Active Tournament / Live Session
                </span>
                <h2 style={{ margin: '6px 0 0 0', fontSize: 18, fontWeight: 900, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={20} style={{ color: '#d97706' }} /> Active Club Tournaments
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isPickleboysClub && (
                <div style={{ background: '#ffffff', borderRadius: 12, padding: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: '#0f172a' }}>Pickleboys Sunday 51-Point Championship</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
                      8 Teams · 48 Players · 51-Point Rapid-Fire Format
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link
                      href="/tournaments/pickleboys"
                      className="btn-primary"
                      style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, textDecoration: 'none', background: '#2563eb', color: '#fff', borderRadius: 8 }}
                    >
                      View Tournament Hub →
                    </Link>
                  </div>
                </div>
              )}

              {inProgress.map(s => {
                const title = s.group_name || formatLabel(s.format);
                const isMwMavericks = s.id === 'mw_mavericks_season_2_2026';
                const playUrl = isMwMavericks ? '/tournaments/mw-mavericks' : (s.format === 'team_championship' ? `/session/${s.id}/play` : `/session/${s.id}/schedule`);
                const hubUrl = isMwMavericks ? '/tournaments/mw-mavericks' : (s.format === 'team_championship' ? `/session/${s.id}/team-championship/results` : `/session/${s.id}/analytics`);

                return (
                  <div key={s.id} style={{ background: '#ffffff', borderRadius: 12, padding: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#dc2626', fontSize: 12 }}>🔴</span> {title}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
                        Created {new Date(s.created_at).toLocaleDateString()} · {s.players?.length || 0} Players
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Link
                        href={playUrl}
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, textDecoration: 'none', background: '#16a34a', color: '#fff', borderRadius: 8 }}
                      >
                        Live Scorekeeper →
                      </Link>
                      <Link
                        href={hubUrl}
                        className="btn-secondary"
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, textDecoration: 'none', borderRadius: 8 }}
                      >
                        Standings
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {role === 'admin' && (joinRequests.length > 0 || joinRequestError) && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--primary)' }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={18} /> Pending Join Requests ({joinRequests.length})
          </h2>
          {joinRequestError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13 }}>{joinRequestError}</p>}
          {joinRequests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              {r.photo_url ? (
                <img src={r.photo_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{r.name ?? 'Unnamed player'}</span>
              <button className="btn-primary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolveJoinRequest(r, 'approved')}>
                Approve
              </button>
              <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleResolveJoinRequest(r, 'rejected')}>
                Reject
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>About</h2>
        {club.description ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{club.description}</p>
        ) : (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>No description yet.</p>
        )}
        {role === 'admin' && (
          <Link href={`/clubs/${id}/settings`} className="text-link-btn" style={{ display: 'inline-block', marginTop: 8, fontSize: 13 }}>
            Edit in Settings →
          </Link>
        )}
      </div>

      {topPlayers.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={18} /> Top Players</h2>
          {topPlayers.map((p, i) => (
            <div key={p.name} className="leaderboard-row">
              <span className={`rank-badge ${i < 3 ? `rank-${i + 1}` : ''}`}>{i + 1}</span>
              <span className="leaderboard-name">{p.name}</span>
              <span className="leaderboard-stats">{p.wins}-{p.losses} ({Math.round(p.winPct * 100)}%)</span>
            </div>
          ))}
          <Link href="/league/stats" style={{ display: 'block', textAlign: 'right', fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            View full leaderboard →
          </Link>
        </div>
      )}

      {(() => {
        const activeCrowns = crowns.filter(c => c.standings.length > 0);
        if (activeCrowns.length === 0) return null;
        return (
          <div className="card" style={{ marginBottom: 12 }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Crown size={18} /> Current Crowns</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {activeCrowns.map(c => (
              <div
                key={c.badgeId}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  background: 'var(--surface-2, rgba(127,127,127,0.04))',
                }}
              >
                <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.3 }}>{c.label}</div>
                <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{c.standings[0].name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.standings[0].value} {c.unit}</div>
              </div>
            ))}
          </div>
          <Link href="/league/crowns" style={{ display: 'block', textAlign: 'right', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            View full crown board →
          </Link>
        </div>
        );
      })()}

      {(() => {
        const activeStreaks = Array.from(streaks.entries())
          .filter(([, s]) => s.type === 'win' && s.length >= 2)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 5);
        if (activeStreaks.length === 0) return null;
        return (
          <div className="card" style={{ marginBottom: 12 }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Flame size={18} /> On a Streak</h2>
            {activeStreaks.map(([name, s]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{name}</span>
                <span style={{ color: 'var(--muted)' }}>{s.length} wins in a row</span>
              </div>
            ))}
          </div>
        );
      })()}

      {bestDuo && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Users2 size={18} /> Best Duo</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{bestDuo.players.join(' & ')}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {bestDuo.wins}-{bestDuo.gamesPlayed - bestDuo.wins} ({Math.round(bestDuo.winPct * 100)}%)
            </span>
          </div>
        </div>
      )}

      {myDues.length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--danger)' }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><IndianRupee size={18} /> Your Dues</h2>
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            You owe <strong>₹{myDues.reduce((sum, d) => sum + d.amount_owed, 0)}</strong> across {myDues.length} session{myDues.length === 1 ? '' : 's'}.
          </p>
          {club.upi_vpa && (
            <a
              href={buildUpiDeepLink(club.upi_vpa, myDues.reduce((sum, d) => sum + d.amount_owed, 0), club.name)}
              className="btn-primary"
              style={{ display: 'inline-block', fontSize: 13, padding: '6px 14px' }}
            >
              Pay via UPI
            </a>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Registered Members ({members.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {members.map(m => {
            const p = playersByUserId.get(m.user_id);
            const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'inherit', textDecoration: 'none' };
            const rowContent = (
              <>
                {p?.photo_url ? (
                  <img src={p.photo_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {resolveMemberDisplayName({
                      player_name: p?.name,
                      google_name: m.google_name,
                      email: m.email || (m.user_id === user?.id ? user?.email : null),
                    })}
                  </div>
                  {m.email && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
                      {m.email}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Joined {new Date(m.joined_at).toLocaleDateString()}</div>
                </div>
                {m.role === 'admin' && (
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 4, padding: '1px 5px' }}>
                    Admin
                  </span>
                )}
                {role === 'admin' && m.user_id !== user?.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button
                      className="btn-secondary"
                      style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const displayName = resolveMemberDisplayName({ player_name: p?.name, google_name: m.google_name, email: m.email });
                        const nextRole = m.role === 'admin' ? 'member' : 'admin';
                        setConfirmTarget({
                          action: 'role',
                          userId: m.user_id,
                          name: displayName,
                          targetRole: nextRole,
                        });
                      }}
                    >
                      {m.role === 'admin' ? 'Make Member' : 'Make Admin'}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, borderColor: 'var(--danger)', color: 'var(--danger)', whiteSpace: 'nowrap' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const displayName = resolveMemberDisplayName({ player_name: p?.name, google_name: m.google_name, email: m.email });
                        setConfirmTarget({
                          action: 'remove',
                          userId: m.user_id,
                          name: displayName,
                        });
                      }}
                    >
                      Remove
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ minHeight: 26, padding: '2px 6px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, background: 'var(--danger)', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const displayName = resolveMemberDisplayName({ player_name: p?.name, google_name: m.google_name, email: m.email });
                        setConfirmTarget({
                          action: 'delete',
                          userId: m.user_id,
                          name: displayName,
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            );
            return p ? (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Link href={`/clubs/${id}/players/${p.id}`} style={{ ...rowStyle, flex: 1 }}>
                  {rowContent}
                </Link>
              </div>
            ) : (
              <div key={m.user_id} style={rowStyle}>
                {rowContent}
              </div>
            );
          })}
        </div>
      </div>

      {unlinkedPlayers.length > 0 && (
        <div className="card" style={{ marginBottom: 12, background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)' }}>
          <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>
            Temporary Guest Roster Names ({unlinkedPlayers.length})
          </h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-4px 0 10px 0' }}>
            Unlinked player names entered during past session setups. They are not official club members.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {unlinkedPlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                {role === 'admin' && (
                  <button
                    className="btn-secondary"
                    style={{ minHeight: 24, padding: '2px 8px', fontSize: 10, fontWeight: 800, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmTarget({
                        action: 'delete_player',
                        userId: p.id,
                        name: p.name,
                      });
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tournaments.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
              <Trophy size={20} style={{ color: 'var(--primary)' }} /> Club Tournaments ({tournaments.length})
            </h2>
            <Link href="/tournaments" className="text-link-btn" style={{ fontSize: 12 }}>View All →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tournaments.map(t => {
              const isOngoing = t.status === 'active' || t.status === 'draft';
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: isOngoing ? 'rgba(37,99,235,0.06)' : 'var(--surface-2, rgba(127,127,127,0.04))',
                    border: isOngoing ? '1.5px solid rgba(37,99,235,0.25)' : '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--foreground)' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Created {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: isOngoing ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                        color: isOngoing ? '#10b981' : '#64748b',
                      }}
                    >
                      {isOngoing ? 'ONGOING / SCHEDULED' : 'COMPLETED'}
                    </span>
                    <Link
                      href={`/watch/${t.share_token}`}
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 8, textDecoration: 'none' }}
                    >
                      Watch / Schedule →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Recent Session Matches & Activity</h2>
            <Link href="/league/sessions" className="text-link-btn" style={{ fontSize: 12 }}>All Sessions →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => {
              const isLive = s.status === 'in_progress';
              return (
                <Link
                  key={s.id}
                  href={resultsLinkFor(s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: isLive ? 'rgba(234,179,8,0.08)' : 'var(--surface-2, rgba(127,127,127,0.04))',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {formatLabel(s.format)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: isLive ? '#eab308' : 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isLive ? '🔴 LIVE IN PROGRESS' : 'RESULTS →'}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href="/setup" className="btn-primary" style={{ textAlign: 'center' }}>Start Session</Link>
          <Link href="/league" className="btn-secondary" style={{ textAlign: 'center' }}>League</Link>
          <Link
            href="/tournaments"
            className="btn-secondary"
            style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Trophy size={15} /> Tournaments
          </Link>
          {id === 'fccd4a42-f3c7-4d93-9493-1e91828e66e2' && (
            <Link
              href="/tournaments/hotshots-draft"
              className="btn-secondary"
              style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, gridColumn: '1 / -1', borderColor: '#d4af37', background: 'rgba(212,175,55,0.05)', color: '#aa8529', fontWeight: 800 }}
            >
              👑 Hotshots Live Draft & Team Selection
            </Link>
          )}
        </div>
      </div>

      {role === 'admin' && (
        <Link href={`/clubs/${id}/settings`} className="text-link-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Flame size={14} /> Club Settings & Data Reset →
        </Link>
      )}

      {confirmTarget && (
        <ConfirmModal
          title={
            confirmTarget.action === 'role'
              ? confirmTarget.targetRole === 'member'
                ? 'Revoke Admin Privileges'
                : 'Promote to Admin'
              : confirmTarget.action === 'remove'
              ? 'Remove Member from Club'
              : 'Permanently Delete Member'
          }
          message={
            confirmTarget.action === 'role'
              ? `Are you sure you want to change ${confirmTarget.name}'s role to ${confirmTarget.targetRole}?`
              : confirmTarget.action === 'remove'
              ? `Are you sure you want to remove ${confirmTarget.name} from ${club.name}?`
              : `CAUTION: Are you sure you want to permanently delete ${confirmTarget.name}? This action cannot be undone.`
          }
          confirmLabel={
            confirmTarget.action === 'role'
              ? confirmTarget.targetRole === 'member'
                ? 'Revoke Admin Rights'
                : 'Make Admin'
              : confirmTarget.action === 'remove'
              ? 'Remove Member'
              : 'Permanently Delete'
          }
          danger={confirmTarget.action !== 'role' || confirmTarget.targetRole === 'member'}
          onConfirm={executeConfirmAction}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </main>
  );
}
