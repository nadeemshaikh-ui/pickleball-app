'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { fetchMvpCounts, fetchStreaks, fetchBestDuos, fetchClosestRivalries } from '@/lib/leagueStats';
import { fetchStreakRecords } from '@/lib/streakRecords';
import { flightForRating } from '@/lib/flights';
import { BADGE_CATALOG, computeBadges, type Badge } from '@/lib/badges';
import { fetchLifetimeGameStats } from '@/lib/lifetimeGameStats';
import { fetchLadderStandings } from '@/lib/ladderStandings';
import { fetchCurrentBadgeHolders, fetchBadgeHoldCounts, type BadgeHolder } from '@/lib/badgeHolders';
import { getCurrentUser } from '@/lib/auth';
import { getOwnPlayer } from '@/lib/players';
import { useCurrentClub } from '@/lib/useCurrentClub';
import BadgeMedallion from '@/components/BadgeMedallion';

const POWER_DUO_MIN_GAMES = 10;
const POWER_DUO_MIN_WIN_RATE = 0.7;

// Contestable badges — a single current club-wide holder, tracked in
// league_badge_holder_history (see lib/badgeHolders.ts) rather than a
// personal-quota unlock. Shown with who holds it now, not just earned/locked.
const CONTESTABLE_BADGE_IDS = new Set(['streak_king', 'wooden_spoon', 'ladder_champion', 'the_real_king']);

const SECTIONS: { title: string; ids: string[] }[] = [
  { title: 'Crowns', ids: ['streak_king', 'wooden_spoon', 'ladder_champion', 'the_real_king'] },
  { title: 'Volume', ids: ['kitchen_regular', 'dink_master', 'rally_beast', 'pickle_royalty', 'paddle_legend', 'ironwood'] },
  { title: 'Streaks', ids: ['hot_streak_5', 'unstoppable'] },
  { title: 'MVP', ids: ['fan_favorite', 'crowd_pleaser', 'mvp_regular', 'hall_of_famer'] },
  { title: 'Flight', ids: ['gold_flight', 'platinum_flight'] },
  { title: 'Partnership', ids: ['power_duo', 'golden_pair', 'chemistry_lab'] },
  { title: 'Game Log', ids: ['arch_rivals', 'format_explorer', 'squad_legend', 'blowout_artist', 'nail_biter_veteran', 'shutout_king', 'perfectionist', 'night_owl', 'rung_climber'] },
];

export default function BadgesGalleryPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [holders, setHolders] = useState<Map<string, BadgeHolder>>(new Map());
  const [holdCounts, setHoldCounts] = useState<Map<string, Map<string, number>>>(new Map());
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
        const [mvpCounts, streaks, streakRecords, duos, gameStats, rivalries, ladderStandings, currentHolders] = await Promise.all([
          fetchMvpCounts(currentClubId!),
          fetchStreaks(currentClubId!),
          fetchStreakRecords(currentClubId!),
          fetchBestDuos(currentClubId!),
          fetchLifetimeGameStats(currentClubId!),
          fetchClosestRivalries(currentClubId!),
          fetchLadderStandings(currentClubId!),
          fetchCurrentBadgeHolders(currentClubId!),
        ]);
        const winStreakRecordHolder = streakRecords.find(r => r.streakType === 'win')?.holderName;
        const lossStreakRecordHolder = streakRecords.find(r => r.streakType === 'loss')?.holderName;
        const ownDuos = duos.filter(d => d.players.includes(own.name));
        const eligibleDuos = duos.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
        const topDuo = eligibleDuos.length > 0 ? [...eligibleDuos].sort((a, b) => b.winPct - a.winPct)[0] : null;
        const gs = gameStats.get(own.name);
        const maxRivalryGames = rivalries
          .filter(r => r.players.includes(own.name))
          .reduce((max, r) => Math.max(max, r.gamesTogether), 0);

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
          maxRivalryGames,
          formatsPlayed: gs?.formats.size ?? 0,
          squadRivalryWins: gs?.squadRivalryWins ?? 0,
          maxWinMargin: gs?.maxMargin ?? 0,
          nailBiterGames: gs?.nailBiters ?? 0,
          hasShutout: (gs?.shutouts ?? 0) > 0,
          perfectSessions: gs?.perfectSessions ?? 0,
          nightSessions: gs?.nightSessions ?? 0,
          ladderWins: ladderStandings.find(s => s.player_name === own.name)?.wins ?? 0,
          isLadderChampion: currentHolders.get('ladder_champion')?.holderName === own.name,
          isTheRealKing: currentHolders.get('the_real_king')?.holderName === own.name,
        });
        setEarnedIds(new Set(badges.map(b => b.id)));
        setHolders(currentHolders);

        const counts = await Promise.all(
          [...CONTESTABLE_BADGE_IDS].map(async id => [id, await fetchBadgeHoldCounts(currentClubId!, id)] as const)
        );
        setHoldCounts(new Map(counts));
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  function renderBadge(b: Badge) {
    const earned = earnedIds.has(b.id);
    const isContestable = CONTESTABLE_BADGE_IDS.has(b.id);
    const holder = holders.get(b.id);
    const holdCount = holder ? holdCounts.get(b.id)?.get(holder.holderName) ?? 1 : 0;
    return (
      <div
        key={b.id}
        className="card"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, opacity: earned || isContestable ? 1 : 0.4 }}
      >
        <BadgeMedallion badge={b} size={48} />
        <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{b.label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{b.description}</div>
        {isContestable && (
          <div style={{ fontSize: 11, textAlign: 'center', color: holder ? 'var(--text-accent, inherit)' : 'var(--muted)', fontWeight: 700 }}>
            {holder ? `Held by ${holder.holderName} (${holdCount}x)` : 'Unclaimed'}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="page">
      <Link href="/league/stats" className="text-link-btn">← Stats</Link>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Award size={22} /> Badge Gallery</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 8px', marginTop: 4, marginBottom: 16 }}>
        {earnedIds.size} of {BADGE_CATALOG.length - CONTESTABLE_BADGE_IDS.size} personal badges earned. Crowns are club-wide and contested by performance.
      </p>

      {SECTIONS.map(section => {
        const badges = section.ids.map(id => BADGE_CATALOG.find(b => b.id === id)).filter((b): b is Badge => !!b);
        if (badges.length === 0) return null;
        return (
          <div key={section.title} style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>{section.title}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {badges.map(renderBadge)}
            </div>
          </div>
        );
      })}
    </main>
  );
}
