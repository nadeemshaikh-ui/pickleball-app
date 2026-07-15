'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { BADGE_CATALOG, computeBadges, buildBadgeInput, type Badge } from '@/lib/badges';
import { fetchCurrentBadgeHolders, fetchBadgeHoldCounts, type BadgeHolder } from '@/lib/badgeHolders';
import { getCurrentUser } from '@/lib/auth';
import { getOwnPlayer } from '@/lib/players';
import { useCurrentClub } from '@/lib/useCurrentClub';
import BadgeMedallion from '@/components/BadgeMedallion';

// Contestable badges — a single current club-wide holder, tracked in
// league_badge_holder_history (see lib/badgeHolders.ts) rather than a
// personal-quota unlock. Shown with who holds it now, not just earned/locked.
const CONTESTABLE_BADGE_IDS = new Set(['streak_king', 'wooden_spoon', 'ladder_champion', 'the_real_king', 'court_regular']);

const SECTIONS: { title: string; ids: string[] }[] = [
  { title: 'Crowns', ids: ['streak_king', 'wooden_spoon', 'ladder_champion', 'the_real_king', 'court_regular'] },
  { title: 'Volume', ids: ['the_regular', 'century_club', 'iron_paddle', 'living_legend'] },
  { title: 'Streaks', ids: ['on_a_roll', 'hot_streak_5', 'unstoppable'] },
  { title: 'MVP', ids: ['fan_favorite', 'crowd_pleaser', 'hall_of_famer'] },
  { title: 'Flight', ids: ['gold_flight', 'platinum_flight'] },
  { title: 'Partnership', ids: ['power_duo', 'golden_pair', 'chemistry_lab'] },
  { title: 'Game Log', ids: ['arch_rivals', 'format_explorer', 'squad_legend', 'blowout_artist', 'nail_biter_veteran', 'grinder', 'shutout_king', 'perfectionist', 'night_owl', 'rung_climber'] },
  { title: 'Head-to-Head', ids: ['nemesis', 'rivalry_slayer'] },
  {
    title: 'Dedication & Calendar',
    ids: [
      'anniversary',
      'comeback_kid',
      'scramble_specialist',
      'one_trick_pony',
      'early_bird',
      'weekend_warrior',
      'monsoon_regular',
      'full_house',
      'diwali_dink',
      'ipl_widows_revenge',
      'founding_five',
      'one_and_only',
    ],
  },
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
        const [badgeInput, currentHolders] = await Promise.all([
          buildBadgeInput(currentClubId!, own.name, own.games_played, own.elo_rating),
          fetchCurrentBadgeHolders(currentClubId!),
        ]);
        const badges = computeBadges(badgeInput);
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
        <div style={{ fontSize: 12, fontWeight: earned || isContestable ? 400 : 700, color: earned || isContestable ? 'var(--muted)' : 'var(--text-accent, inherit)', textAlign: 'center' }}>
          {earned || isContestable ? b.description : `Goal: ${b.description}`}
        </div>
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
      <Link href="/league" className="text-link-btn">← League</Link>
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
