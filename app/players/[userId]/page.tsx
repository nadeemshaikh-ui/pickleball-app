'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Trophy, Crown } from 'lucide-react';
import { fetchCombinedPlayerStats, type CombinedPlayerStats } from '@/lib/crossClubStats';
import { useCurrentClub } from '@/lib/useCurrentClub';
import BadgeMedallion from '@/components/BadgeMedallion';

export default function CrossClubPlayerProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { setCurrentClubId } = useCurrentClub();
  const [stats, setStats] = useState<CombinedPlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCombinedPlayerStats(userId)
      .then(setStats)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load stats.'))
      .finally(() => setLoading(false));
  }, [userId]);

  function viewMatchesIn(clubId: string, playerName: string) {
    setCurrentClubId(clubId);
    router.push(`/league/sessions?player=${encodeURIComponent(playerName)}`);
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!stats || stats.perClub.length === 0) {
    return <main className="page"><p style={{ color: 'var(--muted)' }}>No shared clubs with this player — you can only see combined stats for clubs you both belong to.</p></main>;
  }

  const winPct = stats.totalGames > 0 ? (stats.totalWins / stats.totalGames) * 100 : 0;

  return (
    <main className="page">
      <Link href="/league" className="text-link-btn">← Dashboard</Link>
      <h1>{stats.perClub[0].playerName}</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        Combined across {stats.perClub.length} shared club{stats.perClub.length === 1 ? '' : 's'} — ratings aren&apos;t shown here since elo isn&apos;t
        comparable across clubs&apos; different player pools.
      </p>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{stats.totalGames}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Games</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{stats.totalWins}W {stats.totalLosses}L</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Record</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{winPct.toFixed(0)}%</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Win Rate</div>
        </div>
      </div>

      {stats.perClub.map(c => (
        <div key={c.clubId} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>{c.clubName}</h2>
            <button className="text-link-btn" onClick={() => viewMatchesIn(c.clubId, c.playerName)}>
              See matches →
            </button>
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>
            {c.games} games — {c.wins}W {c.losses}L
          </div>

          {c.crownsHeld.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              <Crown size={15} /> Holds {c.crownsHeld.length} crown{c.crownsHeld.length === 1 ? '' : 's'} here
            </div>
          )}

          {(c.tournamentMatchesPlayed > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 8 }}>
              <Trophy size={15} /> {c.tournamentMatchesWon}/{c.tournamentMatchesPlayed} tournament matches won
            </div>
          )}

          {c.badges.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {c.badges.map(b => <BadgeMedallion key={b.id} badge={b} size={44} />)}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No badges earned here yet.</p>
          )}
        </div>
      ))}
    </main>
  );
}
