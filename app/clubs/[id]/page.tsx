'use client';

import { use, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Trophy, Crown, Flame, Gavel } from 'lucide-react';
import {
  listMyClubs,
  listClubMembers,
  fetchRemovedMemberNames,
  type ClubRow,
  type ClubMemberRow,
} from '@/lib/clubs';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { fetchLifetimeLeaderboard, fetchCrownBoards, type RankedPlayer, type CrownBoard } from '@/lib/leagueStats';
import { listSessions, type SessionRow } from '@/lib/db';
import { formatLabel } from '@/lib/formatLabel';
import SignInGate from '@/components/SignInGate';
import { useCurrentClub } from '@/lib/useCurrentClub';

// A couple of the most legible crowns for a quick-glance dashboard card —
// the full board (10 exclusive crowns) lives on /league/stats, this is just
// a taste so the dashboard isn't empty for an active club.
const HIGHLIGHT_BADGE_IDS = ['the_real_king', 'streak_king'];

export default function ClubDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: userLoading } = useCurrentClub();
  const [club, setClub] = useState<ClubRow | null>(null);
  const [role, setRole] = useState<'admin' | 'member' | null>(null);
  const [members, setMembers] = useState<ClubMemberRow[]>([]);
  const [playersByUserId, setPlayersByUserId] = useState<Map<string, PlayerRow>>(new Map());
  const [leaderboard, setLeaderboard] = useState<RankedPlayer[]>([]);
  const [crowns, setCrowns] = useState<CrownBoard[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notMember, setNotMember] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
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
        const [memberRows, playerRows, board, crownBoards, recentSessions, removedNames] = await Promise.all([
          listClubMembers(id),
          listPlayers(id),
          fetchLifetimeLeaderboard(id),
          fetchCrownBoards(id),
          listSessions(id, 5),
          fetchRemovedMemberNames(id),
        ]);
        setMembers(memberRows.filter(m => !m.removed_at));
        setPlayersByUserId(new Map(playerRows.filter(p => p.user_id).map(p => [p.user_id as string, p])));
        setLeaderboard(board.filter(p => !removedNames.has(p.name)));
        setCrowns(
          crownBoards
            .map(c => ({ ...c, standings: c.standings.filter(s => !removedNames.has(s.name)) }))
            .filter(c => HIGHLIGHT_BADGE_IDS.includes(c.badgeId) && c.standings.length > 0)
        );
        setSessions(recentSessions);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load club.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, user, userLoading]);

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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {crowns.map(c => (
              <div key={c.badgeId}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{c.standings[0].name}</div>
              </div>
            ))}
          </div>
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
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span>{formatLabel(s.format)}</span>
              <span style={{ color: 'var(--muted)' }}>{new Date(s.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href="/setup" className="btn-primary" style={{ textAlign: 'center' }}>Start Session</Link>
          <Link href="/league" className="btn-secondary" style={{ textAlign: 'center' }}>League</Link>
          <Link href="/tournaments" className="btn-secondary" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Trophy size={15} /> Tournaments
          </Link>
          <Link href="/tournaments/auctions" className="btn-secondary" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Gavel size={15} /> Auctions
          </Link>
        </div>
      </div>

      {role === 'admin' && (
        <Link href={`/clubs/${id}/settings`} className="text-link-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Flame size={14} /> Club Settings & Danger Zone →
        </Link>
      )}
    </main>
  );
}
