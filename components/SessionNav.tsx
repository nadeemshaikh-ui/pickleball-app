'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';

// format is optional so every existing call site (most formats don't need
// it) keeps working unchanged — only team_championship actually diverges.
// Without this, Leaderboard/Analytics/Results always pointed at the
// generic per-player pages (a "podium" of individual players) even for a
// Team Championship session, which has its own team-standings pages —
// real bug, found via live feedback: a captain scoring rounds through
// /play (which Team Championship reuses, no dedicated scoring screen)
// would tap "Results" here and land on the wrong page entirely.
export default function SessionNav({ sessionId, format }: { sessionId: string; format?: string }) {
  const pathname = usePathname();

  const isTeamChampionship = format === 'team_championship';
  const tabs = [
    { href: `/session/${sessionId}/schedule`, label: 'Schedule' },
    { href: `/session/${sessionId}/play`, label: 'Score' },
    { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/results' : 'leaderboard'}`, label: 'Leaderboard' },
    { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/analytics' : 'analytics'}`, label: 'Analytics' },
    { href: `/session/${sessionId}/${isTeamChampionship ? 'team-championship/results' : 'results'}`, label: 'Results' },
  ];

  return (
    <nav className="session-nav" aria-label="Session navigation">
      {/* Only exit from inside a session — GlobalNav is hidden on /session/* routes */}
      <Link href="/" aria-label="Home" title="Home">
        <Home size={16} />
      </Link>
      {tabs.map(tab => (
        <Link
          key={tab.href}
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
