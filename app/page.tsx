'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { getOwnPlayer } from '@/lib/players';
import { getLatestActiveSession, deleteSession, type SessionRow } from '@/lib/db';
import { fetchLifetimeLeaderboard, type LifetimePlayerStats } from '@/lib/leagueStats';
import { computeBadges, buildBadgeInput, type Badge } from '@/lib/badges';
import { listMyClubs, requestToJoinClub, type ClubMembership } from '@/lib/clubs';
import AiScheduleImporter from '@/components/AiScheduleImporter';
import { Play, Sparkles, Trophy, Zap, ShieldCheck, Plus, Users, ChevronRight, RefreshCw, BarChart2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, currentClub, currentClubId, setCurrentClubId, loading: clubLoading } = useCurrentClub();
  
  const [ownStats, setOwnStats] = useState<LifetimePlayerStats | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [myClubs, setMyClubs] = useState<ClubMembership[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [showAiModal, setShowAiModal] = useState(false);

  // Load My Clubs
  useEffect(() => {
    listMyClubs().then(setMyClubs).catch(() => setMyClubs([]));
  }, [user]);

  // Load active session
  useEffect(() => {
    getLatestActiveSession(currentClubId).then(setActiveSession).catch(() => setActiveSession(null));
  }, [currentClubId]);

  // Load player stats & badges
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDashboardLoading(true);
      try {
        if (currentClubId && user) {
          const own = await getOwnPlayer(currentClubId, user.id);
          if (cancelled) return;
          if (own) {
            const leaderboard = await fetchLifetimeLeaderboard(currentClubId);
            if (cancelled) return;
            const idx = leaderboard.findIndex(p => p.name.toLowerCase() === own.name.toLowerCase());
            setRank(idx >= 0 ? idx + 1 : null);
            const foundStats = idx >= 0 ? leaderboard[idx] : null;
            setOwnStats(foundStats);
            const input = await buildBadgeInput(currentClubId, own.name, foundStats?.gamesPlayed || 0, own.elo_rating || 1200);
            if (cancelled) return;
            setBadges(computeBadges(input));
          }
        }
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, currentClubId]);

  async function handleAbandonSession() {
    if (!activeSession) return;
    if (!confirm('Are you sure you want to abandon and delete this active session? All round scores logged so far will be permanently removed.')) return;
    try {
      await deleteSession(activeSession.id);
      setActiveSession(null);
    } catch (err) {
      alert('Failed to abandon session. Please try again.');
    }
  }

  const winRate = ownStats && ownStats.gamesPlayed > 0 ? Math.round((ownStats.wins / ownStats.gamesPlayed) * 100) : 0;
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'Pickleball Player');

  return (
    <main className="page" style={{ paddingBottom: 80, background: '#f8fafc' }}>
      
      {/* Hero Welcome Card */}
      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1.1 }}>
              {currentClub ? currentClub.name : 'Personal Player Dashboard'}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
              Welcome back, {userName}!
            </h1>
          </div>

          {currentClub && rank && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#d97706', padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={16} /> Club Rank #{rank}
            </div>
          )}
        </div>

        {/* Player Lifetime Stats Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 10, textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Elo Rating</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{ownStats ? Math.round(ownStats.wilsonScore * 1000) : 1200}</div>
          </div>
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 10, textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Record</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{ownStats ? `${ownStats.wins}W - ${ownStats.losses}L` : '0W - 0L'}</div>
          </div>
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 10, textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Win Rate</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>{winRate}%</div>
          </div>
          <div style={{ background: '#fafafa', padding: 12, borderRadius: 10, textAlign: 'center', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Badges</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#d97706', marginTop: 2 }}>{badges.length} Earned</div>
          </div>
        </div>
      </div>

      {/* Active Session Resume Banner */}
      {activeSession && (
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 14, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#2563eb', color: '#ffffff', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Live Session</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>{activeSession.group_name || 'Club Match Play'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Link
              href={`/session/${activeSession.id}/play`}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Play size={14} /> Resume
            </Link>
            <button
              onClick={handleAbandonSession}
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                padding: '8px 12px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Abandon
            </button>
          </div>
        </div>
      )}

      {/* Quick Play & Action Grid */}
      <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={18} style={{ color: '#2563eb' }} /> Quick Actions & Play Modes
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 24 }}>
        
        {/* Instant Session Launch */}
        <Link
          href="/setup"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 18,
            textDecoration: 'none',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ background: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>Start Club Session</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>Scramble, Squads, Fixed Pairs or King of Court</p>
          </div>
          <ChevronRight size={18} style={{ color: '#94a3b8' }} />
        </Link>

        {/* Dedicated Guest Mode Open Play Launcher */}
        <Link
          href="/setup?guest=true"
          style={{
            background: '#ffffff',
            border: '1.5px solid #10b981',
            borderRadius: 14,
            padding: 18,
            textDecoration: 'none',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ background: '#10b981', color: '#ffffff', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#047857' }}>Guest Mode Open Play</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#059669' }}>Host non-club matches with WhatsApp share & QR code</p>
          </div>
          <ChevronRight size={18} style={{ color: '#10b981' }} />
        </Link>

        {/* AI Schedule & Rules Import */}
        <div
          onClick={() => setShowAiModal(true)}
          style={{
            background: '#ffffff',
            border: '1.5px solid #93c5fd',
            borderRadius: 14,
            padding: 18,
            cursor: 'pointer',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ background: '#2563eb', color: '#ffffff', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#1e40af' }}>AI Schedule Scanner</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#3b82f6' }}>Upload PDF/image schedule & auto-create mode</p>
          </div>
          <ChevronRight size={18} style={{ color: '#2563eb' }} />
        </div>

        {/* League Standings & Analytics */}
        <Link
          href={currentClubId ? `/clubs/${currentClubId}` : '/league/stats'}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 18,
            textDecoration: 'none',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ background: '#d97706', color: '#ffffff', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>Club Analytics & Leaderboard</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>H2H records, rankings, duo chemistry</p>
          </div>
          <ChevronRight size={18} style={{ color: '#94a3b8' }} />
        </Link>
      </div>

      {/* My Clubs Section (Non-blocking) */}
      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} /> My Pickleball Clubs ({myClubs.length})
          </h2>

          <Link
            href="/clubs/join"
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#2563eb',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Plus size={14} /> Join / Create Club
          </Link>
        </div>

        {myClubs.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {myClubs.map(m => {
              const isActive = m.club_id === currentClubId;
              return (
                <div
                  key={m.club_id}
                  onClick={() => {
                    setCurrentClubId(m.club_id);
                    router.push(`/clubs/${m.club_id}`);
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: isActive ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isActive ? '#eff6ff' : '#fafafa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: isActive ? '#1e40af' : '#0f172a' }}>{m.club.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{m.role} · View Club Page →</div>
                  </div>
                  {isActive && <ShieldCheck size={16} style={{ color: '#2563eb' }} />}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: 'center', background: '#fafafa', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#64748b' }}>You haven't joined a club yet. Join one to sync rankings with friends!</p>
            <Link
              href="/clubs/join"
              style={{
                background: '#0f172a',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              Browse & Join Clubs
            </Link>
          </div>
        )}
      </div>

      {/* AI Schedule Modal */}
      <AiScheduleImporter isOpen={showAiModal} onClose={() => setShowAiModal(false)} />

    </main>
  );
}
