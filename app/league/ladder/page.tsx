'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchLadderStandings, enrollInLadder, unenrollFromLadder, resetLadder, type LadderStandingRow } from '@/lib/ladderStandings';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { shareToWhatsApp } from '@/lib/whatsapp';
import Avatar from '@/components/Avatar';

export default function LadderPage() {
  const [standings, setStandings] = useState<LadderStandingRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    const [st, pl] = await Promise.all([fetchLadderStandings(), listPlayers(), preloadPlayerPhotos()]);
    setStandings(st);
    setPlayers(pl);
  }

  useEffect(() => {
    async function init() {
      try {
        const [user] = await Promise.all([getCurrentUser(), load()]);
        if (user) setIsAdmin(await isCurrentUserAdmin());
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Failed to load ladder standings.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const enrolledNames = new Set(standings.map(s => s.player_name));
  const unenrolledPlayers = players.filter(p => !enrolledNames.has(p.name));

  async function handleEnroll(name: string) {
    setBusyName(name);
    setActionError(null);
    try {
      await enrollInLadder(name);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to enroll player.');
    } finally {
      setBusyName(null);
    }
  }

  async function handleUnenroll(name: string) {
    setBusyName(name);
    setActionError(null);
    try {
      await unenrollFromLadder(name);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove player.');
    } finally {
      setBusyName(null);
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset the ladder? Everyone enrolled will be reseeded by current ELO rating and win/loss history on the ladder is cleared. This can\'t be undone.')) return;
    setResetting(true);
    setActionError(null);
    try {
      await resetLadder();
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to reset ladder.');
    } finally {
      setResetting(false);
    }
  }

  function shareText(): string {
    const lines = ['🪜 Ladder League Standings', ''];
    standings.forEach((s, i) => lines.push(`${i + 1}. ${s.player_name}`));
    return lines.join('\n');
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league" className="text-link-btn">← League</Link>
        {isAdmin && standings.length > 0 && (
          <button className="icon-btn" aria-label="Share ladder standings on WhatsApp" onClick={() => shareToWhatsApp(shareText())}>
            📤
          </button>
        )}
      </div>

      <h1>🪜 Ladder League</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 8px', marginBottom: 12 }}>
        Rungs move when a session is flagged as Ladder League at Setup and the lower-ranked doubles side pulls off an
        upset — the two sides swap rungs. Matches more than 3 rungs apart don't count as challenges.
      </p>

      {actionError && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{actionError}</p>}

      {isAdmin && (
        <button className="btn-secondary" onClick={handleReset} disabled={resetting} style={{ marginBottom: 16 }}>
          {resetting ? 'Resetting…' : '🔄 Reset Ladder (reseed by ELO)'}
        </button>
      )}

      <div className="card">
        {standings.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No players enrolled on the ladder yet.</p>}
        {standings.map(s => (
          <div key={s.player_name} className="leaderboard-row">
            <span style={{ fontWeight: 800, width: 24 }}>{s.rung}</span>
            <Avatar name={s.player_name} size={28} />
            <span className="leaderboard-name">{s.player_name}</span>
            <span className="leaderboard-stats">{s.wins}W {s.losses}L</span>
            {isAdmin && (
              <button
                className="text-link-btn"
                disabled={busyName === s.player_name}
                onClick={() => handleUnenroll(s.player_name)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && unenrolledPlayers.length > 0 && (
        <>
          <h2>Add to Ladder</h2>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unenrolledPlayers.map(p => (
              <button
                key={p.id}
                type="button"
                className="btn-secondary"
                disabled={busyName === p.name}
                onClick={() => handleEnroll(p.name)}
                style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}
              >
                + {p.nickname || p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
