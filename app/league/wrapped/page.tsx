'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Share2, Gift, Swords } from 'lucide-react';
import {
  fetchLifetimeLeaderboard,
  fetchPlayerOfTheMonthBoard,
  fetchYearlyLeaderboard,
  fetchBestDuos,
  fetchRivalriesForPlayer,
  fetchMvpCounts,
  fetchStreaks,
  type RankedDuo,
  type Rivalry,
} from '@/lib/leagueStats';
import { fetchStreakRecords } from '@/lib/streakRecords';
import { fetchPersonalBests, type PersonalBests } from '@/lib/personalBests';
import { flightForRating } from '@/lib/flights';
import { computeBadges, type Badge } from '@/lib/badges';
import { getCurrentUser } from '@/lib/auth';
import { getOwnPlayer } from '@/lib/players';
import { shareElementAsImage } from '@/lib/shareImage';
import { useCurrentClub } from '@/lib/useCurrentClub';
import Avatar from '@/components/Avatar';
import BadgeMedallion from '@/components/BadgeMedallion';

const POWER_DUO_MIN_GAMES = 10;
const POWER_DUO_MIN_WIN_RATE = 0.7;

type Period = 'month' | 'year';

interface WrappedData {
  playerName: string;
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  favoritePartner: { name: string; winPct: number; gamesPlayed: number } | null;
  nemesis: Rivalry | null;
  biggestWin: PersonalBests;
  badges: Badge[];
}

export default function WrappedPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          setLoadError('Sign in to see your Wrapped.');
          return;
        }
        const own = await getOwnPlayer(currentClubId!, user.id);
        if (!own) {
          setLoadError('Set up your player profile first — see Setup.');
          return;
        }

        const [periodBoard, duos, rivalries, mvpCounts, streaks, streakRecords, personalBests] = await Promise.all([
          period === 'month' ? fetchPlayerOfTheMonthBoard(currentClubId!) : fetchYearlyLeaderboard(currentClubId!),
          fetchBestDuos(currentClubId!),
          fetchRivalriesForPlayer(currentClubId!, own.name),
          fetchMvpCounts(currentClubId!),
          fetchStreaks(currentClubId!),
          fetchStreakRecords(currentClubId!),
          fetchPersonalBests(currentClubId!, own.name),
        ]);

        const periodStats = periodBoard.find(p => p.name === own.name);

        const ownDuos = duos.filter(d => d.players.includes(own.name) && d.gamesPlayed >= 5);
        const favoritePartner =
          ownDuos.length === 0
            ? null
            : (() => {
                const best = [...ownDuos].sort((a, b) => b.winPct - a.winPct)[0];
                return { name: best.players[0] === own.name ? best.players[1] : best.players[0], winPct: best.winPct, gamesPlayed: best.gamesPlayed };
              })();

        const closeRivalries = rivalries.filter(r => r.gamesTogether >= 3);
        const nemesis =
          closeRivalries.length === 0
            ? null
            : [...closeRivalries].sort((a, b) => Math.abs(a.record[0] - a.record[1]) - Math.abs(b.record[0] - b.record[1]))[0];

        const winStreakRecordHolder = streakRecords.find(r => r.streakType === 'win')?.holderName;
        const lossStreakRecordHolder = streakRecords.find(r => r.streakType === 'loss')?.holderName;
        const eligibleDuos = duos.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
        const topDuo = eligibleDuos.length > 0 ? [...eligibleDuos].sort((a, b) => b.winPct - a.winPct)[0] : null;
        const flight = flightForRating(own.elo_rating);

        const badges = computeBadges({
          gamesPlayed: own.games_played,
          currentStreak: streaks.get(own.name) ?? 0,
          mvpCount: mvpCounts.get(own.name) ?? 0,
          flight,
          isWinStreakRecordHolder: winStreakRecordHolder === own.name,
          isLossStreakRecordHolder: lossStreakRecordHolder === own.name,
          duoCount: duos.filter(d => d.players.includes(own.name)).length,
          hasPowerDuo: duos.some(d => d.players.includes(own.name) && d.gamesPlayed >= POWER_DUO_MIN_GAMES && d.winPct >= POWER_DUO_MIN_WIN_RATE),
          isClubTopDuo: topDuo !== null && topDuo.players.includes(own.name),
        });

        setData({
          playerName: own.name,
          eloRating: own.elo_rating,
          gamesPlayed: periodStats?.gamesPlayed ?? 0,
          wins: periodStats?.wins ?? 0,
          losses: periodStats?.losses ?? 0,
          favoritePartner,
          nemesis,
          biggestWin: personalBests,
          badges,
        });
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load your Wrapped.');
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    init();
  }, [currentClubId, clubLoading, period]);

  async function handleShare() {
    if (!cardsRef.current) return;
    setImageShareError(null);
    try {
      const result = await shareElementAsImage(cardsRef.current, `pickleball-wrapped-${period}.png`);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;
  if (loadError) return <main className="page"><p style={{ color: 'var(--danger)' }}>{loadError}</p></main>;
  if (!data) return null;

  const winPct = data.gamesPlayed > 0 ? Math.round((data.wins / data.gamesPlayed) * 100) : 0;
  const periodLabel = period === 'month' ? "This Month" : 'This Year';

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league" className="text-link-btn">← League</Link>
        <button className="icon-btn" aria-label="Share Wrapped image on WhatsApp" onClick={handleShare}><Share2 size={16} /></button>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gift size={22} /> Your Pickleball Wrapped</h1>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, marginBottom: 16 }}>
        <button className={period === 'month' ? 'btn-primary' : 'btn-secondary'} style={{ minHeight: 32, padding: '4px 14px', fontSize: 13 }} onClick={() => setPeriod('month')}>Monthly</button>
        <button className={period === 'year' ? 'btn-primary' : 'btn-secondary'} style={{ minHeight: 32, padding: '4px 14px', fontSize: 13 }} onClick={() => setPeriod('year')}>Yearly</button>
      </div>

      {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{imageShareError}</p>}

      <div ref={cardsRef} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <Avatar name={data.playerName} size={56} />
          <h2 style={{ marginTop: 8, marginBottom: 0 }}>{periodLabel} on the Court</h2>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8 }}>{data.gamesPlayed}</div>
          <div style={{ color: 'var(--muted)' }}>matches played</div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{data.wins}W - {data.losses}L</div>
          <div style={{ color: 'var(--muted)' }}>{winPct}% win rate</div>
        </div>

        {data.favoritePartner && (
          <div className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Favorite Partner</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{data.favoritePartner.name}</div>
            <div style={{ color: 'var(--muted)' }}>
              {Math.round(data.favoritePartner.winPct * 100)}% win rate together ({data.favoritePartner.gamesPlayed} games)
            </div>
          </div>
        )}

        {data.nemesis && (
          <div className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Swords size={13} /> Your Nemesis</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{data.nemesis.players[1]}</div>
            <div style={{ color: 'var(--muted)' }}>
              {data.nemesis.record[0]}-{data.nemesis.record[1]} head-to-head
            </div>
          </div>
        )}

        {data.biggestWin.biggestMargin !== null && (
          <div className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Biggest Win</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {data.biggestWin.biggestMarginOwnScore}-{data.biggestWin.biggestMarginOppScore}
            </div>
            <div style={{ color: 'var(--muted)' }}>vs {data.biggestWin.biggestMarginOpponents}</div>
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>Badges Earned</div>
          {data.badges.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>None yet — keep playing.</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {data.badges.map(b => (
                <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 64 }}>
                  <BadgeMedallion badge={b} size={32} />
                  <span style={{ fontSize: 10, textAlign: 'center', color: 'var(--muted)' }}>{b.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Current Flight</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{flightForRating(data.eloRating)}</div>
        </div>
      </div>
    </main>
  );
}
