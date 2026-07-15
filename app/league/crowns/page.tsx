'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown } from 'lucide-react';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { fetchCrownBoards, fetchCurrentBadgeHolders, type CrownBoard } from '@/lib/leagueStats';
import { BADGE_CATALOG } from '@/lib/badges';
import type { BadgeHolder } from '@/lib/badgeHolders';
import BadgeMedallion from '@/components/BadgeMedallion';
import Avatar from '@/components/Avatar';

function formatHeldDuration(heldFrom: string): string {
  const days = Math.floor((Date.now() - new Date(heldFrom).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'}`;
}

export default function CrownsPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [boards, setBoards] = useState<CrownBoard[]>([]);
  const [holders, setHolders] = useState<Map<string, BadgeHolder>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    Promise.all([fetchCrownBoards(currentClubId), fetchCurrentBadgeHolders(currentClubId)])
      .then(([b, h]) => {
        setBoards(b);
        setHolders(h);
      })
      .finally(() => setLoading(false));
  }, [currentClubId, clubLoading]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <Link href="/clubs">Clubs</Link>.</p></main>;

  return (
    <main className="page">
      <Link href="/league" className="text-link-btn">← League</Link>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Crown size={22} /> Exclusive Crowns
      </h1>

      <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderColor: 'var(--primary)', marginBottom: 16 }}>
        <Crown size={20} style={{ flexShrink: 0, marginTop: 2, color: 'var(--primary)' }} />
        <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Only one player in the club holds each crown at a time. Beat the current holder&apos;s number and it&apos;s yours — fall behind and it changes hands the moment stats refresh. Everyone can see exactly how far they are from taking one.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {boards.map(board => {
          const badge = BADGE_CATALOG.find(b => b.id === board.badgeId);
          const holder = holders.get(board.badgeId);
          const top = board.standings[0];
          const chasers = board.standings.slice(1, 4);
          if (!badge || !top) return null;
          return (
            <div key={board.badgeId} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <BadgeMedallion badge={badge} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {badge.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <Avatar name={top.name} size={26} />
                    <span style={{ fontWeight: 800, fontSize: 16 }}>{top.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {top.value} {board.unit}
                    </span>
                  </div>
                  {holder && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Held for {formatHeldDuration(holder.heldFrom)}</div>
                  )}
                </div>
              </div>

              {chasers.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                    Closing In
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {chasers.map((c, i) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', width: 16 }}>#{i + 2}</span>
                        <Avatar name={c.name} size={20} />
                        <span style={{ fontSize: 13, flex: 1 }}>{c.name}</span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--danger)',
                            background: 'rgba(214,69,69,0.1)',
                            padding: '2px 8px',
                            borderRadius: 999,
                          }}
                        >
                          -{top.value - c.value} {board.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
