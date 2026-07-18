'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, type SessionRow } from '@/lib/db';
import { fetchRapidFireLog, recordRapidFirePoint } from '@/lib/rapidFire';
import { computeRapidFireState, computeRapidFireBonus } from '@/lib/teamChampionship';
import type { RapidFireLogEntry } from '@/lib/teamChampionship';

const POLL_INTERVAL_MS = 3000; // matches the rest of the app's poll-don't-subscribe convention

// Live rally-point scoreboard for the Rapid Fire finale — not round/match
// based like every other screen in this app, a running tally with the
// on-court foursome auto-rotating every N points (lib/teamChampionship.ts's
// computeRapidFireState, built in Phase 2). Polls rather than subscribes,
// same reasoning as every other live screen already in this app.
export default function RapidFirePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [log, setLog] = useState<RapidFireLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);

  async function load() {
    const [s, l] = await Promise.all([getSession(id), fetchRapidFireLog(id)]);
    setSession(s);
    setLog(l);
  }

  useEffect(() => {
    load().catch(e => setError(e instanceof Error ? e.message : 'Failed to load.'));
    const interval = setInterval(() => {
      fetchRapidFireLog(id).then(setLog).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [id]);

  async function handleScore(teamId: string, onCourtPlayers: string[]) {
    setScoring(true);
    setError(null);
    try {
      await recordRapidFirePoint(id, teamId, onCourtPlayers);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record point.');
    } finally {
      setScoring(false);
    }
  }

  if (error && !session) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Loading…</p></main>;
  if (session.format !== 'team_championship' || !session.squads_v2 || !session.rapid_fire_config) {
    return <main className="page"><p>This session has no Rapid Fire finale configured.</p></main>;
  }

  const teams = session.squads_v2;
  const config = session.rapid_fire_config;
  const state = computeRapidFireState(log, config, teams);
  const bonus = state.isComplete ? computeRapidFireBonus(state, config) : null;
  const winnerLabel = state.winnerTeamId ? (teams.find(t => t.id === state.winnerTeamId)?.label ?? state.winnerTeamId) : null;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
      </div>
      <h1>Rapid Fire</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        First to {config.targetPoints} · rotates every {config.rotateEveryNPoints} points · winner gets {config.bonusPoints} bonus points
      </p>

      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, marginBottom: 24 }}>
        {teams.map(team => (
          <div key={team.id} className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{team.label ?? team.id}</div>
            <div style={{ fontSize: 48, fontWeight: 900 }}>{state.totalsByTeam.get(team.id) ?? 0}</div>
          </div>
        ))}
      </div>

      {state.isComplete ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{winnerLabel} wins Rapid Fire!</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            Bonus points: {teams.map(t => `${t.label ?? t.id} +${bonus?.get(t.id) ?? 0}`).join(' · ')}
          </p>
        </div>
      ) : (
        <>
          <h2>On Court Now</h2>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>{state.onCourtPlayers.join(' & ')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {teams.map(team => (
              <button
                key={team.id}
                className="btn-primary"
                style={{ minHeight: 64, fontSize: 18, fontWeight: 800 }}
                disabled={scoring}
                onClick={() => handleScore(team.id, state.onCourtPlayers)}
              >
                +1 {team.label ?? team.id}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
