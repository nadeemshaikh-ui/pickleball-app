'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';

export default function TopBarHomeButton() {
  const pathname = usePathname();

  // Don't show on home page itself
  if (pathname === '/') return null;

  return (
    <Link
      href="/"
      aria-label="Go to Home"
      title="Go to Home"
      style={{
        position: 'fixed',
        top: 14,
        left: 14,
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        background: '#0f172a',
        color: '#ffffff',
        borderRadius: 30,
        fontSize: 13,
        fontWeight: 800,
        textDecoration: 'none',
        boxShadow: '0 4px 14px rgba(15,23,42,0.25)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(8px)',
        transition: 'transform 0.15s ease, background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#1e293b';
        e.currentTarget.style.transform = 'scale(1.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#0f172a';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <Home size={16} color="#e5fa00" />
      <span style={{ color: '#ffffff', letterSpacing: 0.3 }}>Home</span>
    </Link>
  );
}
