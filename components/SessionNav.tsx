'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';

export default function SessionNav({ sessionId, format, clubId }: { sessionId: string; format?: string; clubId?: string }) {
  const pathname = usePathname();

  const isMwMavericks = sessionId === 'mw_mavericks_season_2_2026';
  const isTeamChampionship = format === 'team_championship';

  const tabs = isMwMavericks
    ? [
        { href: `/tournaments/mw-mavericks`, label: 'Master Hub' },
        { href: `/tournaments/mw-mavericks`, label: 'Live Scoring' },
        { href: `/tournaments/mw-mavericks`, label: 'Standings' },
        { href: `/tournaments/mw-mavericks`, label: 'Analytics' },
      ]
    : [
        { href: `/session/${sessionId}/schedule`, label: 'Schedule' },
        { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/stage/1' : 'play'}`, label: 'Score' },
        { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/results' : 'leaderboard'}`, label: 'Leaderboard' },
        { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/analytics' : 'analytics'}`, label: 'Analytics' },
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
