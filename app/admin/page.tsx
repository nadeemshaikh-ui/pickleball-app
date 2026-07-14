'use client';

import { useEffect, useState } from 'react';
import { isSuperAdmin, listAllClubsForSuperAdmin, resetClubData, type SuperAdminClubRow } from '@/lib/clubs';
import { listPlayers, type PlayerRow } from '@/lib/players';
import ConfirmModal from '@/components/ConfirmModal';

export default function SuperAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [clubs, setClubs] = useState<SuperAdminClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState<SuperAdminClubRow | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await isSuperAdmin();
      setAllowed(ok);
      if (ok) setClubs(await listAllClubsForSuperAdmin());
      setLoading(false);
    })();
  }, []);

  async function toggleExpand(clubId: string) {
    if (expandedClubId === clubId) {
      setExpandedClubId(null);
      return;
    }
    setExpandedClubId(clubId);
    setPlayersLoading(true);
    try {
      setPlayers(await listPlayers(clubId));
    } finally {
      setPlayersLoading(false);
    }
  }

  async function handleReset() {
    if (!resetTarget) return;
    setResetting(true);
    setResetMsg(null);
    try {
      await resetClubData(resetTarget.id);
      setResetMsg(`"${resetTarget.name}" reset — all sessions and stats cleared.`);
      if (expandedClubId === resetTarget.id) setPlayers(await listPlayers(resetTarget.id));
    } catch (e) {
      setResetMsg(e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setResetting(false);
      setResetTarget(null);
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (!allowed) return <main className="page"><p>Not authorized.</p></main>;

  return (
    <main className="page">
      <h1>All Clubs ({clubs.length})</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Super admin view — every club on the platform, regardless of your own membership. Tap a club to see its roster and reset its data.
      </p>
      {resetMsg && <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{resetMsg}</p>}

      <div className="card" style={{ padding: 0 }}>
        {clubs.map(c => (
          <div key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}
              onClick={() => toggleExpand(c.id)}
            >
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.member_count} member{c.member_count === 1 ? '' : 's'}</span>
              <button
                className="btn-secondary"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)', fontSize: 12, padding: '4px 10px' }}
                onClick={e => {
                  e.stopPropagation();
                  setResetTarget(c);
                }}
              >
                Reset
              </button>
            </div>

            {expandedClubId === c.id && (
              <div style={{ padding: '4px 12px 12px', background: 'var(--muted-bg, rgba(0,0,0,0.02))' }}>
                {playersLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading roster…</p>
                ) : players.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>No players registered yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                        <th style={{ padding: '4px 6px', fontWeight: 700 }}>Player</th>
                        <th style={{ padding: '4px 6px', fontWeight: 700 }}>Games</th>
                        <th style={{ padding: '4px 6px', fontWeight: 700 }}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map(p => (
                        <tr key={p.id}>
                          <td style={{ padding: '4px 6px' }}>{p.nickname || p.name}</td>
                          <td style={{ padding: '4px 6px' }}>{p.games_played}</td>
                          <td style={{ padding: '4px 6px' }}>{Math.round(p.elo_rating)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {resetTarget && (
        <ConfirmModal
          title="Reset all club data?"
          message={`This permanently deletes every session, match, badge, and streak record for "${resetTarget.name}". Player names/photos are kept, stats reset to zero. This cannot be undone.`}
          confirmLabel={resetting ? 'Resetting…' : 'Reset Club Data'}
          danger
          requireText={resetTarget.name}
          onConfirm={handleReset}
          onCancel={() => setResetTarget(null)}
        />
      )}
    </main>
  );
}
