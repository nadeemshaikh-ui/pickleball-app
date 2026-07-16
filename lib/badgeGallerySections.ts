// Which gallery section each badge displays under (app/league/badges/page.tsx).
// Lives in lib/, not the page component, so it's testable without pulling
// in the page's browser-only deps (auth, useCurrentClub) — a badge missing
// from every section here can be earned but never shows up anywhere in the
// gallery, which happened for real this session (giant_slayer/
// regulars_regular were added to BADGE_CATALOG but never wired in here).
export interface BadgeGallerySection {
  title: string;
  ids: string[];
}

export const SECTIONS: BadgeGallerySection[] = [
  {
    title: 'Crowns',
    ids: [
      'streak_king',
      'wooden_spoon',
      'ladder_champion',
      'the_real_king',
      'court_regular',
      'iron_throne',
      'head_honcho',
      'undisputed',
      'the_gatekeeper',
      'the_untouchable',
    ],
  },
  { title: 'Volume', ids: ['the_regular', 'century_club', 'iron_paddle', 'living_legend'] },
  { title: 'Streaks', ids: ['on_a_roll', 'hot_streak_5', 'unstoppable'] },
  { title: 'MVP', ids: ['fan_favorite', 'crowd_pleaser', 'hall_of_famer'] },
  { title: 'Flight', ids: ['gold_flight', 'platinum_flight'] },
  { title: 'Partnership', ids: ['power_duo', 'golden_pair', 'chemistry_lab'] },
  { title: 'Game Log', ids: ['arch_rivals', 'format_explorer', 'squad_legend', 'blowout_artist', 'nail_biter_veteran', 'grinder', 'shutout_king', 'perfectionist', 'night_owl', 'rung_climber', 'giant_slayer'] },
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
      'regulars_regular',
    ],
  },
  { title: 'Trajectory', ids: ['glow_up', 'player_of_the_month', 'three_peat'] },
];
