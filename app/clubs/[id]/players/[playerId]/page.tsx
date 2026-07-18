'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Swords, Flame, Award } from 'lucide-react';
import { getPlayerById, type PlayerRow } from '@/lib/players';
import {
  fetchLifetimeLeaderboard,
  fetchEloHistory,
  fetchRivalriesForPlayer,
  fetchPotmWinCount,
  hasThreePeat,
  type RankedPlayer,
  type EloSnapshot,
  type Rivalry,
} from '@/lib/leagueStats';
import { fetchStreakRecords, computeCurrentStreaks, type StreakRecord } from '@/lib/streakRecords';
import { buildBadgeInput, computeBadges, type Badge } from '@/lib/badges';
import { listSessions, type SessionRow } from '@/lib/db';
import { formatLabel } from '@/lib/formatLabel';
import { listClubMembers } from '@/lib/clubs';
import BadgeMedallion from '@/components/BadgeMedallion';
import { useCurrentClub } from '@/lib/useCurrentClub';
import SignInGate from '@/components/SignInGate';

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string; playerId: string }> }) {
  const { id: clubId, playerId } = use(params);
  const { user, loading: userLoading } = useCurrentClub();
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [stats, setStats] = useState<RankedPlayer | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [eloHistory, setEloHistory] = useState<EloSnapshot[]>([]);
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [potmWins, setPotmWins] = useState(0);
  const [threePeat, setThreePeat] = useState(false);
  const [streakRecords, setStreakRecords] = useState<StreakRecord[]>([]);
  const [currentStreak, setCurrentStreak] = useState<{ type: 'win' | 'loss'; length: number } | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionRow[]>([]);
  const [removedAt, setRemovedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const p = await getPlayerById(clubId, playerId);
        if (!p) {
          setNotFound(true);
          return;
        }
        setPlayer(p);

        const [leaderboard, elo, rivalryList, badgeInput, potm, threePeatResult, records, streaks, sessions, members] = await Promise.all([
          fetchLifetimeLeaderboard(clubId),
          fetchEloHistory(clubId, p.name),
          fetchRivalriesForPlayer(clubId, p.name),
          buildBadgeInput(clubId, p.name, p.games_played, p.elo_rating),
          fetchPotmWinCount(clubId, p.name),
          hasThreePeat(clubId, p.name),
          fetchStreakRecords(clubId),
          computeCurrentStreaks(clubId),
          listSessions(clubId, 30),
          listClubMembers(clubId),
        ]);

        if (p.user_id) {
          setRemovedAt(members.find(m => m.user_id === p.user_id)?.removed_at ?? null);
        }

        const statsRow = leaderboard.find(row => row.name === p.name) ?? null;
        setStats(statsRow);
        const rankedIndex = leaderboard.filter(row => !row.provisional).findIndex(row => row.name === p.name);
        setRank(rankedIndex >= 0 ? rankedIndex + 1 : null);
        setEloHistory(elo);
        setRivalries(rivalryList.sort((a, b) => b.gamesTogether - a.gamesTogether));
        setBadges(computeBadges(badgeInput));
        setPotmWins(potm);
        setThreePeat(threePeatResult);
        setStreakRecords(records);
        setCurrentStreak(p.user_id ? streaks.get(p.name) ?? null : null);
        setRecentSessions(sessions.filter(s => s.players.includes(p.name)).slice(0, 5));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load player profile.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clubId, playerId, user, userLoading]);

  if (userLoading || loading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to view player profiles." />;
  if (loadError) {
    return (
      <main className="page">
        <Link href={`/clubs/${clubId}`} className="text-link-btn">← Club</Link>
        <p style={{ color: 'var(--danger)', marginTop: 12 }}>{loadError}</p>
      </main>
    );
  }
  if (notFound || !player) {
    return (
      <main className="page">
        <Link href={`/clubs/${clubId}`} className="text-link-btn">← Club</Link>
        <p style={{ color: 'var(--muted)', marginTop: 12 }}>Player not found.</p>
      </main>
    );
  }

  const winStreakRecord = streakRecords.find(r => r.streakType === 'win');
  const lossStreakRecord = streakRecords.find(r => r.streakType === 'loss');
  const maxElo = eloHistory.length > 0 ? Math.max(...eloHistory.map(e => e.eloRating)) : player.elo_rating;
  const minElo = eloHistory.length > 0 ? Math.min(...eloHistory.map(e => e.eloRating)) : player.elo_rating;

  return (
    <main className="page">
      <Link href={`/clubs/${clubId}`} className="text-link-btn">← Club</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '12px 0' }}>
        {player.photo_url ? (
          <img src={player.photo_url} alt="" width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <span style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} />
        )}
        <div>
          <h1 style={{ margin: 0 }}>{player.name}</h1>
          {player.nickname && <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>&ldquo;{player.nickname}&rdquo;</p>}
          {removedAt && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginTop: 4 }}>
              No longer an active member
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 13, color: 'var(--muted)' }}>
          {player.dominant_hand && <span>{player.dominant_hand === 'ambidextrous' ? 'Ambidextrous' : `${player.dominant_hand.charAt(0).toUpperCase()}${player.dominant_hand.slice(1)}-handed`}</span>}
          {player.paddle && <span>{player.paddle}</span>}
          {player.playing_since_year && <span>Playing since {player.playing_since_year}</span>}
          {player.signature_shot && <span>Signature: {player.signature_shot}</span>}
        </div>
        {player.bio && <p style={{ margin: '10px 0 0' }}>{player.bio}</p>}
      </div>

      {stats && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Rank</div><div style={{ fontWeight: 800, fontSize: 18 }}>{rank ? `#${rank}` : '—'}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Record</div><div style={{ fontWeight: 800, fontSize: 18 }}>{stats.wins}-{stats.losses}</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Win %</div><div style={{ fontWeight: 800, fontSize: 18 }}>{Math.round(stats.winPct * 100)}%</div></div>
            <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Games</div><div style={{ fontWeight: 800, fontSize: 18 }}>{stats.gamesPlayed}</div></div>
          </div>
          {currentStreak && currentStreak.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Flame size={15} /> Current {currentStreak.type === 'win' ? 'win' : 'loss'} streak: {currentStreak.length}
            </div>
          )}
        </div>
      )}

      {eloHistory.length >= 2 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={18} /> Rating Over Time</h2>
          <EloSparkline history={eloHistory} min={minElo} max={maxElo} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            <span>{new Date(eloHistory[0].recordedAt).toLocaleDateString()}</span>
            <span>Now: {player.elo_rating}</span>
          </div>
        </div>
      )}

      {(badges.length > 0 || potmWins > 0) && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Award size={18} /> Trophy Case</h2>
          {badges.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: potmWins > 0 ? 10 : 0 }}>
              {badges.map(b => <BadgeMedallion key={b.id} badge={b} size={32} />)}
            </div>
          )}
          {potmWins > 0 && (
            <p style={{ margin: 0, fontSize: 13 }}>
              Player of the Month: {potmWins}× {threePeat && '— on a 3-peat 🔥'}
            </p>
          )}
          {(winStreakRecord?.holderName === player.name || lossStreakRecord?.holderName === player.name) && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              {winStreakRecord?.holderName === player.name && `Club win-streak record: ${winStreakRecord.recordLength}`}
              {lossStreakRecord?.holderName === player.name && `Club loss-streak record: ${lossStreakRecord.recordLength}`}
            </p>
          )}
        </div>
      )}

      {rivalries.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Swords size={18} /> Head-to-Head</h2>
          {rivalries.slice(0, 5).map(r => {
            const opponent = r.players[0] === player.name ? r.players[1] : r.players[0];
            const [wins, losses] = r.players[0] === player.name ? r.record : [r.record[1], r.record[0]];
            return (
              <div key={opponent} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                <span>vs {opponent}</span>
                <span style={{ color: 'var(--muted)' }}>{wins}-{losses} ({r.gamesTogether} games)</span>
              </div>
            );
          })}
        </div>
      )}

      {recentSessions.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
          {recentSessions.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span>{formatLabel(s.format)}</span>
              <span style={{ color: 'var(--muted)' }}>{new Date(s.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// Minimal inline sparkline — no charting dependency for one line on one page.
function EloSparkline({ history, min, max }: { history: EloSnapshot[]; min: number; max: number }) {
  const width = 100;
  const height = 32;
  const range = Math.max(max - min, 1);
  const points = history.map((h, i) => {
    const x = history.length > 1 ? (i / (history.length - 1)) * width : 0;
    const y = height - ((h.eloRating - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: 48 }}>
      <polyline points={points.join(' ')} fill="none" stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
