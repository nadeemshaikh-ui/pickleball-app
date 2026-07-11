'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchMvpCounts, fetchStreaks, fetchBestDuos } from '@/lib/leagueStats';
import { fetchStreakRecords } from '@/lib/streakRecords';
import { flightForRating } from '@/lib/flights';
import { BADGE_CATALOG, computeBadges } from '@/lib/badges';
import { getCurrentUser } from '@/lib/auth';
import { getOwnPlayer } from '@/lib/players';
import { useCurrentClub } from '@/lib/useCurrentClub';
import BadgeMedallion from '@/components/BadgeMedallion';

const POWER_DUO_MIN_GAMES = 10;
const POWER_DUO_MIN_WIN_RATE = 0.7;

export default function BadgesGalleryPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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
          setLoading(false);
          return;
        }
        const own = await getOwnPlayer(currentClubId!, user.id);
        if (!own) {
          setLoading(false);
          return;
        }
        const [mvpCounts, streaks, streakRecords, duos] = await Promise.all([
          fetchMvpCounts(currentClubId!),
          fetchStreaks(currentClubId!),
          fetchStreakRecords(currentClubId!),
          fetchBestDuos(currentClubId!),
        ]);
        const winStreakRecordHolder = streakRecords.find(r => r.streakType === 'win')?.holderName;
        const lossStreakRecordHolder = streakRecords.find(r => r.streakType === 'loss')?.holderName;
        const ownDuos = duos.filter(d => d.players.includes(own.name));
        const eligibleDuos = duos.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
        const topDuo = eligibleDuos.length > 0 ? [...eligibleDuos].sort((a, b) => b.winPct - a.winPct)[0] : null;

        const badges = computeBadges({
          gamesPlayed: own.games_played,
          currentStreak: streaks.get(own.name) ?? 0,
          mvpCount: mvpCounts.get(own.name) ?? 0,
          flight: flightForRating(own.elo_rating),
          isWinStreakRecordHolder: winStreakRecordHolder === own.name,
          isLossStreakRecordHolder: lossStreakRecordHolder === own.name,
          duoCount: ownDuos.length,
          hasPowerDuo: ownDuos.some(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES && d.winPct >= POWER_DUO_MIN_WIN_RATE),
          isClubTopDuo: topDuo !== null && topDuo.players.includes(own.name),
        });
        setEarnedIds(new Set(badges.map(b => b.id)));
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  return (
    <main className="page">
      <Link href="/league/stats" className="text-link-btn">← Stats</Link>
      <h1>🏅 Badge Gallery</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 8px', marginTop: 4, marginBottom: 16 }}>
        {earnedIds.size} of {BADGE_CATALOG.length} earned. Greyed out badges show what's still locked.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        {BADGE_CATALOG.map(b => {
          const earned = earnedIds.has(b.id);
          return (
            <div
              key={b.id}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, opacity: earned ? 1 : 0.4 }}
            >
              <BadgeMedallion badge={b} size={48} />
              <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{b.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{b.description}</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
