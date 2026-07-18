'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Medal, Users, User, Plus } from 'lucide-react';
import { useCurrentClub } from '@/lib/useCurrentClub';

// Session pages have their own bottom nav (SessionNav) — don't stack two
// fixed bars on top of each other while scoring a match.
const HIDDEN_PREFIXES = ['/session/', '/login', '/onboarding'];

// 5-tab bar with an elevated center action, same pattern Strava uses for its
// "Record" tab — the single most frequent action (starting a session) gets
// a permanently visible, physically distinct button instead of being one
// more link buried on Home. Clubs and You (profile + sign-out) are their
// own tabs too, not hidden behind a "More" drawer — hidden nav is exactly
// what caused the "can't find club switching / sign-out" complaints.
export default function GlobalNav() {
  const pathname = usePathname();
  const { user, currentClubId, loading } = useCurrentClub();

  if (loading || !user || !currentClubId) return null;
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

  const sideTabs = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/league', label: 'League', icon: Trophy },
    { href: '/tournaments', label: 'Tourneys', icon: Medal },
  ];
  const rightTabs = [
    { href: '/clubs', label: 'Clubs', icon: Users },
    { href: '/register', label: 'You', icon: User },
  ];

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        background: 'white',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
      }}
    >
      {sideTabs.map(tab => {
        const active = isActive(tab.href);
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
              padding: '10px 4px 6px',
              fontSize: 10,
              fontWeight: 700,
              color: active ? 'var(--primary, #1a1a1a)' : 'var(--muted)',
              flex: 1,
              minWidth: 0,
            }}
          >
            <Icon size={19} />
            {tab.label}
          </Link>
        );
      })}

      <Link
        href="/setup"
        aria-label="New Session"
        aria-current={isActive('/setup') ? 'page' : undefined}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          flex: '0 0 auto',
          padding: '0 4px',
          transform: 'translateY(-10px)',
        }}
      >
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: 'var(--primary, #1a1a1a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <Plus size={22} color="white" />
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--primary, #1a1a1a)', whiteSpace: 'nowrap' }}>New Session</span>
      </Link>

      {rightTabs.map(tab => {
        const active = isActive(tab.href);
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
              padding: '10px 4px 6px',
              fontSize: 10,
              fontWeight: 700,
              color: active ? 'var(--primary, #1a1a1a)' : 'var(--muted)',
              flex: 1,
              minWidth: 0,
            }}
          >
            <Icon size={19} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
