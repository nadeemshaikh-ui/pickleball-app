'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';

export default function SessionNav({ sessionId, format, clubId, stageCount }: { sessionId: string; format?: string; clubId?: string; stageCount?: number }) {
  const pathname = usePathname();

  const isMwMavericks = sessionId === 'mw_mavericks_season_2_2026';
  const isTeamChampionship = format === 'team_championship';

  // Blocks (stages) and Rapid Fire are unlocked for everyone — no gating on
  // prior blocks being scored — so give each its own directly-reachable tab
  // instead of forcing a single "next step" path through the results page.
  const blockTabs = isTeamChampionship && stageCount
    ? Array.from({ length: stageCount }, (_, i) => ({
        href: `/session/${sessionId}/team-championship/stage/${i + 1}`,
        label: `Block ${i + 1}`,
      }))
    : [];

  const tabs = isMwMavericks
    ? [
        { href: `/tournaments/mw-mavericks`, label: 'Master Hub' },
        { href: `/tournaments/mw-mavericks`, label: 'Live Scoring' },
        { href: `/tournaments/mw-mavericks`, label: 'Standings' },
        { href: `/tournaments/mw-mavericks`, label: 'Analytics' },
      ]
    : [
        { href: `/session/${sessionId}/schedule`, label: 'Schedule' },
        { href: `/session/${sessionId}/play`, label: 'Score' },
        ...blockTabs,
        { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/results' : 'leaderboard'}`, label: 'Leaderboard' },
        { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/analytics' : 'analytics'}`, label: 'Analytics' },
        ...(isTeamChampionship ? [{ href: `/session/${sessionId}/team-championship/rapid-fire`, label: '🔥 Rapid Fire' }] : []),
        { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/results' : 'results'}`, label: 'Results' },
      ];

  return (
    <nav className="session-nav" aria-label="Session navigation">
      <Link href={clubId ? `/clubs/${clubId}` : '/'} aria-label="Club Home" title="Club Home">
        <Home size={16} />
      </Link>
      {tabs.map(tab => (
        <Link
          key={tab.href + tab.label}
          href={tab.href}
          className={pathname === tab.href ? 'active' : ''}
          aria-current={pathname === tab.href ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
