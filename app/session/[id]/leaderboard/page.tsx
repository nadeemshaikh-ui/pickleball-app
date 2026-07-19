'use client';

import { use, useEffect, useRef, useState } from 'react';
import { getSession, getRounds, type SessionRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotalsN, type PlayerStats } from '@/lib/analytics';
import SquadStandingsCard from '@/components/SquadStandingsCard';
import { shareElementAsImage } from '@/lib/shareImage';
import SessionNav from '@/components/SessionNav';
import Avatar from '@/components/Avatar';
import NewSessionLink from '@/components/NewSessionLink';
import SessionDate from '@/components/SessionDate';
import GroupHeader from '@/components/GroupHeader';
import { WhatsAppIcon } from '@/components/icons';
import ShareBrandedHeader from '@/components/ShareBrandedHeader';
import SquadVersusHero from '@/components/SquadVersusHero';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';

const POLL_INTERVAL_MS = 4000;

export default function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [squadTotals, setSquadTotals] = useState<Map<string, number> | null>(null);
  const [gamesCompleted, setGamesCompleted] = useState(0);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const leaderboardCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [s, rounds] = await Promise.all([getSession(id), getRounds(id), preloadPlayerPhotos()]);
      if (cancelled) return;
      setSession(s);
      setLeaderboard(computeLeaderboard(rounds));
      setGamesTotal(rounds.length);
      setGamesCompleted(rounds.filter(r => r.score_a !== null).length);
      if (s.format === 'squad_rivalry' && s.squads) {
        setSquadTotals(computeSquadTotalsN(rounds, s.squads));
      }
    }

    load();
    // Live-updating leaderboard: simple polling rather than a Supabase
    // realtime subscription — this is a basic, low-traffic hobby app, so
    // polling every few seconds is far cheaper to build and run than wiring
    // up realtime channels for a handful of concurrent viewers.
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  async function handleShareLeaderboard() {
    if (!leaderboardCaptureRef.current) return;
    setImageShareError(null);
    try {
      const result = await shareElementAsImage(leaderboardCaptureRef.current, `leaderboard-${id}.png`);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  return (
    <>
      <main className="page">
        <div className="page-header-row">
          <NewSessionLink />
          <button
            className="icon-btn"
            aria-label="Share leaderboard image on WhatsApp"
            onClick={handleShareLeaderboard}
          >
            <WhatsAppIcon size={24} />
          </button>
        </div>
        {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{imageShareError}</p>}

        <div ref={leaderboardCaptureRef}>
          <ShareBrandedHeader clubId={session?.club_id} />
        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        <h1>Leaderboard</h1>
        {session && <SessionDate createdAt={session.created_at} venue={session.venue} />}
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          {gamesCompleted} of {gamesTotal} games played — updates live
        </p>

        {squadTotals && session?.squads && session.squads.length === 2 && (
          <div className="card" style={{ marginTop: 16 }}>
            <SquadVersusHero
              goldLabel={session.squads[0].label || 'Gold'}
              blackLabel={session.squads[1].label || 'Black'}
              goldLogoUrl={session.squads[0].logoUrl ?? null}
              blackLogoUrl={session.squads[1].logoUrl ?? null}
              goldScore={squadTotals.get(session.squads[0].id) ?? 0}
              blackScore={squadTotals.get(session.squads[1].id) ?? 0}
            />
          </div>
        )}
        {squadTotals && session?.squads && session.squads.length > 2 && (
          <div className="card" style={{ marginTop: 16 }}>
            <SquadStandingsCard squads={session.squads} totalsByTeam={squadTotals} />
          </div>
        )}

        <h2>Standings</h2>
        {leaderboard.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', marginBottom: 6 }}>
            <span style={{ width: 30 }} />
            <span style={{ width: 24 }} />
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Player
            </span>
            <span style={{ flex: '1 1 auto', maxWidth: 80 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'right' }}>
              Win–Loss · Win%
            </span>
          </div>
        )}
        <div className="card">
          {leaderboard.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No games scored yet.</p>
          )}
          {leaderboard.map((p, i) => {
            const maxWins = Math.max(1, ...leaderboard.map(x => x.wins));
            return (
              <div key={p.name} className="leaderboard-row">
                <span className={`rank-badge rank-${i + 1 <= 3 ? i + 1 : ''}`}>{i + 1}</span>
                <Avatar name={p.name} size={24} />
                <span className="leaderboard-name">{p.name}</span>
                <div className="win-bar-track" style={{ maxWidth: 80 }}>
                  <div className="win-bar-fill" style={{ width: `${(p.wins / maxWins) * 100}%` }} />
                </div>
                <span className="leaderboard-stats">
                  {p.wins}W-{p.losses}L · {p.wins + p.losses > 0 ? `${Math.round((p.wins / (p.wins + p.losses)) * 100)}%` : '—'}
                </span>
              </div>
            );
          })}
        </div>
        </div>
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
