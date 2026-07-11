'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User, Settings } from 'lucide-react';
import { useCurrentClub } from '@/lib/useCurrentClub';

// Session pages have their own bottom nav (SessionNav) — don't stack two
// fixed bars on top of each other while scoring a match.
const HIDDEN_PREFIXES = ['/session/', '/login', '/onboarding'];

export default function GlobalNav() {
  const pathname = usePathname();
  const { user, currentClubId, isCurrentClubAdmin, loading } = useCurrentClub();

  if (loading || !user || !currentClubId) return null;
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

  const tabs = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/league', label: 'League', icon: Trophy },
    { href: '/register', label: 'Profile', icon: User },
    ...(isCurrentClubAdmin ? [{ href: `/clubs/${currentClubId}/settings`, label: 'Admin', icon: Settings }] : []),
  ];

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        background: 'white',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
      }}
    >
      {tabs.map(tab => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '10px 12px 6px',
              fontSize: 11,
              fontWeight: 700,
              color: active ? 'var(--primary, #1a1a1a)' : 'var(--muted)',
              flex: 1,
            }}
          >
            <Icon size={22} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
