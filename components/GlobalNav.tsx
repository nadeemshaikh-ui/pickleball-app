'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Users, User, Plus } from 'lucide-react';
import { useCurrentClub } from '@/lib/useCurrentClub';
import NewActionSheet from './NewActionSheet';

// Session pages have their own bottom nav (SessionNav) — don't stack two
// fixed bars on top of each other while scoring a match.
const HIDDEN_PREFIXES = ['/session/', '/login', '/onboarding'];

// 5-tab bar with an elevated center action, same pattern Strava uses for its
// "Record" tab. The center button opens NewActionSheet — a distinct choice
// between "New Session" (club night) and "New Tournament" — rather than
// jumping straight to /setup, since Tournaments having its own permanent
// tab made this a cramped 6-tab bar. Clubs and You (profile + sign-out) are
// their own tabs, not hidden behind a "More" drawer — hidden nav is exactly
// what caused the "can't find club switching / sign-out" complaints.
export default function GlobalNav() {
  const pathname = usePathname();
  const { user, currentClubId, loading } = useCurrentClub();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading || !user) return null;
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

  const sideTabs = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/league', label: 'League', icon: Trophy },
  ];
  const rightTabs = [
    { href: '/register', label: 'You', icon: User },
  ];

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  return (
    <>
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

        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Start something new"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            flex: '0 0 auto',
            padding: '0 8px',
            transform: 'translateY(-10px)',
            background: 'none',
            border: 'none',
          }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--primary, #1a1a1a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          >
            <Plus size={26} color="white" />
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary, #1a1a1a)' }}>New</span>
        </button>

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

      {sheetOpen && <NewActionSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
