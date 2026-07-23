'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getSession, getRounds, type SessionRow, type RoundRow } from '@/lib/db';
import { fetchRapidFireLog, recordRapidFirePoint } from '@/lib/rapidFire';
import { computeRapidFireState, computeRapidFireBonus, findFinalRoundPairs } from '@/lib/teamChampionship';
import type { RapidFireLogEntry } from '@/lib/teamChampionship';

const POLL_INTERVAL_MS = 3000; // matches the rest of the app's poll-don't-subscribe convention

// Live rally-point scoreboard for the Rapid Fire finale — not round/match
// based like every other screen in this app, a running tally. Resolved
// with the tournament committee: subbing the on-court foursome is a
// manual organizer action, not an automatic rotation on a point count —
// so `courtOverride` lets the organizer swap either on-court player for a
// bench player at any time; it takes effect on the next point scored.
// Polls rather than subscribes, same reasoning as every other live screen
// already in this app.
export default function RapidFirePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [log, setLog] = useState<RapidFireLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [courtOverride, setCourtOverride] = useState<string[] | null>(null);
  // Tap-tap sub flow, not dropdowns — real feedback: subbing needs to be
  // "easy... on the spot... with ease." Tap an on-court player (marks them
  // outgoing), then tap a bench player to complete the swap immediately.
  // Tapping the same on-court player again cancels the pick.
  const [outgoingPick, setOutgoingPick] = useState<string | null>(null);
  const scoringRef = useRef(false);

  async function load() {
    const [s, r, l] = await Promise.all([getSession(id), getRounds(id), fetchRapidFireLog(id)]);
    setSession(s);
    setRounds(r);
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
    if (scoringRef.current) return;
    scoringRef.current = true;
    setScoring(true);
    setError(null);
    try {
      await recordRapidFirePoint(id, teamId, onCourtPlayers);
      setCourtOverride(null);
      setOutgoingPick(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record point.');
    } finally {
      scoringRef.current = false;
      setScoring(false);
    }
  }

  function handleSub(currentPlayers: string[], outgoing: string, incoming: string) {
    setCourtOverride(currentPlayers.map(p => (p === outgoing ? incoming : p)));
    setOutgoingPick(null);
  }

  function handleTapOnCourt(player: string) {
    setOutgoingPick(prev => (prev === player ? null : player));
  }

  function handleTapBench(currentPlayers: string[], incoming: string) {
    if (!outgoingPick) return;
    handleSub(currentPlayers, outgoingPick, incoming);
  }

  // Captain still picks WHO rotates in, on the spot — this only makes the
  // WHEN (every 3 points) impossible to miss, a structural nudge rather
  // than an automatic swap. Counts backward through the log: how many
  // trailing points in a row were scored by the exact same on-court
  // foursome as right now. Any substitution naturally resets this to 0/1,
  // since the on-court set changes.
  function pointsSinceRotation(currentOnCourt: string[]): number {
    const currentKey = [...currentOnCourt].sort().join('|');
    let count = 0;
    for (let i = log.length - 1; i >= 0; i--) {
      if ([...log[i].onCourtPlayers].sort().join('|') === currentKey) count++;
      else break;
    }
    return count;
  }

  if (error && !session) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Loading…</p></main>;
  if (session.format !== 'team_championship' || !session.squads || !session.rapid_fire_config) {
    return <main className="page"><p>This session has no Rapid Fire finale configured.</p></main>;
  }

  const teams = session.squads;
  const config = session.rapid_fire_config;
  const finalRoundPairs = findFinalRoundPairs(
    rounds.map(r => ({ roundNumber: r.round_number, court: r.court, teamA: r.team_a, teamB: r.team_b, scoreA: r.score_a, scoreB: r.score_b })),
    teams
  );
  const state = computeRapidFireState(log, config, teams, finalRoundPairs);
  const onCourtPlayers = courtOverride ?? state.onCourtPlayers;
  const sinceRotation = pointsSinceRotation(onCourtPlayers);
  const bonus = state.isComplete ? computeRapidFireBonus(state, config) : null;
  const winnerLabel = state.winnerTeamId ? (teams.find(t => t.id === state.winnerTeamId)?.label ?? state.winnerTeamId) : null;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
      </div>
      <h1>Rapid Fire</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        First to {config.targetPoints} · winner gets {config.bonusPoints} bonus points
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
          <div
            className="card"
            style={{
              marginBottom: 16,
              borderColor: sinceRotation >= 3 ? 'var(--warning, #b45309)' : undefined,
              borderWidth: sinceRotation >= 3 ? 2 : undefined,
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', margin: 0 }}>{onCourtPlayers.join(' & ')}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: '4px 0 0' }}>
              {sinceRotation} point{sinceRotation === 1 ? '' : 's'} played by this pairing
            </p>
            {sinceRotation >= 3 && (
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning, #b45309)', textAlign: 'center', margin: '8px 0 0' }}>
                ⏱ Time to rotate — captain, pick who&apos;s coming on next.
              </p>
            )}
          </div>

          <h2>Sub (manual)</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
            {outgoingPick ? `Tap who's coming in for ${outgoingPick}.` : 'Tap an on-court player to sub them out.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {teams.map(team => {
              const onCourt = onCourtPlayers.filter(p => team.players.includes(p));
              const bench = team.players.filter(p => !onCourt.includes(p));
              return (
                <div key={team.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{team.label ?? team.id}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>On Court</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {onCourt.map(p => {
                        const isPicked = outgoingPick === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleTapOnCourt(p)}
                            style={{
                              minHeight: 44,
                              padding: '8px 14px',
                              borderRadius: 999,
                              border: isPicked ? '2px solid var(--warning, #b45309)' : '1px solid var(--border)',
                              background: isPicked ? 'var(--warning, #b45309)' : 'white',
                              color: isPicked ? 'white' : 'var(--foreground)',
                              fontSize: 14,
                              fontWeight: 700,
                            }}
                          >
                            {p}{isPicked ? ' ✕' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Bench</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {bench.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>No bench players</span>}
                      {bench.map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => handleTapBench(onCourtPlayers, b)}
                          disabled={!outgoingPick}
                          style={{
                            minHeight: 44,
                            padding: '8px 14px',
                            borderRadius: 999,
                            border: '1px solid var(--border)',
                            background: 'white',
                            color: 'var(--foreground)',
                            fontSize: 14,
                            fontWeight: 700,
                            opacity: outgoingPick ? 1 : 0.5,
                          }}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {teams.map(team => (
              <button
                key={team.id}
                className="btn-primary"
                style={{ minHeight: 64, fontSize: 18, fontWeight: 800 }}
                disabled={scoring}
                onClick={() => handleScore(team.id, onCourtPlayers)}
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
