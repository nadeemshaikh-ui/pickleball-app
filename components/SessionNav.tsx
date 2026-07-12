'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';

export default function SessionNav({ sessionId }: { sessionId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/session/${sessionId}/schedule`, label: 'Schedule' },
    { href: `/session/${sessionId}/play`, label: 'Score' },
    { href: `/session/${sessionId}/leaderboard`, label: 'Leaderboard' },
    { href: `/session/${sessionId}/analytics`, label: 'Analytics' },
    { href: `/session/${sessionId}/results`, label: 'Results' },
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
