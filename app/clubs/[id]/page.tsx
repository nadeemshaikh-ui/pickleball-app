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
  type ClubRow,
  type ClubMemberRow,
  type JoinRequestRow,
} from '@/lib/clubs';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { fetchLifetimeLeaderboard, fetchCrownBoards, fetchBestDuos, type RankedPlayer, type CrownBoard, type RankedDuo } from '@/lib/leagueStats';
import { computeCurrentStreaks } from '@/lib/streakRecords';
import { fetchMyDuesForClub, buildUpiDeepLink, type MyDueRow } from '@/lib/dues';
import { listSessions, type SessionRow } from '@/lib/db';
import { formatLabel } from '@/lib/formatLabel';
import SignInGate from '@/components/SignInGate';
import { useCurrentClub } from '@/lib/useCurrentClub';

// Format-specific results routing — Team Championship's stage/rapid-fire
// scoring produces a different results page than every other format.
function resultsLinkFor(s: SessionRow): string {
  if (s.status !== 'completed') return `/session/${s.id}/schedule`;
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
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
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
        const [memberRows, playerRows, board, crownBoards, currentStreaks, duos, recentSessions, removedNames] = await Promise.all([
          listClubMembers(id),
          listPlayers(id),
          fetchLifetimeLeaderboard(id),
          fetchCrownBoards(id),
          computeCurrentStreaks(id),
          fetchBestDuos(id),
          listSessions(id, 5),
          fetchRemovedMemberNames(id),
        ]);
        setMembers(memberRows.filter(m => !m.removed_at));
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

        const ownPlayer = playerRows.find(p => p.user_id === userId);
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
        <div>
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

      {crowns.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Crown size={18} /> Current Crowns</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {crowns.map(c => (
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
      )}

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
        <h2 style={{ marginTop: 0 }}>Members ({members.length})</h2>
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
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p?.name ?? 'Unnamed player'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Joined {new Date(m.joined_at).toLocaleDateString()}</div>
                </div>
                {m.role === 'admin' && (
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 4, padding: '2px 6px' }}>
                    Admin
                  </span>
                )}
              </>
            );
            return p ? (
              <Link key={m.user_id} href={`/clubs/${id}/players/${p.id}`} style={rowStyle}>
                {rowContent}
              </Link>
            ) : (
              <div key={m.user_id} style={rowStyle}>
                {rowContent}
              </div>
            );
          })}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
          {sessions.map(s => (
            <Link
              key={s.id}
              href={resultsLinkFor(s)}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: 'inherit' }}
            >
              <span>{formatLabel(s.format)}{s.status === 'completed' && ' — Results'}</span>
              <span style={{ color: 'var(--muted)' }}>{new Date(s.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
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
            style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, gridColumn: '1 / -1' }}
          >
            <Trophy size={15} /> Tournaments
          </Link>
        </div>
      </div>

      {role === 'admin' && (
        <Link href={`/clubs/${id}/settings`} className="text-link-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Flame size={14} /> Club Settings & Data Reset →
        </Link>
      )}
    </main>
  );
}
