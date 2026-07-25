'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getSession, getRounds, markSessionCompleted, type SessionRow, type RoundRow } from '@/lib/db';
import { fetchRapidFireLog, recordRapidFirePoint } from '@/lib/rapidFire';
import { computeRapidFireState, computeRapidFireBonus, findFinalRoundPairs } from '@/lib/teamChampionship';
import type { RapidFireLogEntry } from '@/lib/teamChampionship';
import SessionNav from '@/components/SessionNav';

const POLL_INTERVAL_MS = 3000; // matches the rest of the app's poll-don't-subscribe convention
const REQUEST_TIMEOUT_MS = 10000; // a hung request must surface an error, not freeze the Save buttons forever

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS)),
  ]);
}

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
  const scoringRef = useRef(false);
  const completedRef = useRef(false);

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

  // The tournament isn't actually done until Rapid Fire resolves — Play
  // page defers markSessionCompleted here specifically so it doesn't fire
  // the moment the last regular round is scored (see app/session/[id]/
  // play/page.tsx). Fires once, the instant a team crosses target points.
  useEffect(() => {
    if (!session || session.format !== 'team_championship' || !session.squads || !session.rapid_fire_config) return;
    if (completedRef.current) return;
    const state = computeRapidFireState(log, session.rapid_fire_config, session.squads);
    if (state.isComplete) {
      completedRef.current = true;
      markSessionCompleted(id).catch(() => {
        completedRef.current = false;
      });
    }
  }, [session, log, id]);

  // Real bug, found via live testing: this used to re-fetch session +
  // rounds + log (3 queries) after every single point, just to update a
  // number that only ever needs the log. That's unnecessary weight on
  // every tap, and if any one of those three queries stalled on a flaky
  // connection — exactly when this matters most, live at a real event —
  // the Save button stayed disabled forever with no error shown (a live
  // session's actual log showed 5 clean points, then nothing for 2+
  // hours). Now only the log is re-fetched after scoring, and everything
  // is wrapped in a hard timeout so a stalled request surfaces an error
  // and re-enables the buttons instead of freezing them.
  async function handleScore(teamId: string, onCourtPlayers: string[]) {
    if (scoringRef.current) return;
    // Belt-and-suspenders: a valid lineup is always exactly 4 distinct
    // players (2 per team). The select-per-slot UI shouldn't be able to
    // produce anything else, but a scored point with a duplicate/missing
    // player is a real-rules violation, not a cosmetic glitch — refuse it
    // outright rather than trust the caller.
    if (onCourtPlayers.length !== 4 || new Set(onCourtPlayers).size !== 4) {
      setError('On-court lineup is invalid — 4 different players are required (2 per team). Fix the subs before scoring.');
      return;
    }
    scoringRef.current = true;
    setScoring(true);
    setError(null);
    try {
      await withTimeout(recordRapidFirePoint(id, teamId, onCourtPlayers), 'Timed out saving that point — check the connection and try again.');
      setCourtOverride(null);
      const freshLog = await withTimeout(fetchRapidFireLog(id), 'Point saved, but the scoreboard refresh timed out — check the connection.');
      setLog(freshLog);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record point.');
    } finally {
      scoringRef.current = false;
      setScoring(false);
    }
  }

  // One tap, not two — real feedback: subbing needs to be "even more
  // simple." Each on-court slot is its own dropdown defaulting to the
  // current player; picking a bench name from it swaps immediately, no
  // separate "tap outgoing, then tap incoming" step.
  function handleSlotChange(currentPlayers: string[], outgoing: string, incoming: string) {
    if (incoming === outgoing || !incoming) return;
    setCourtOverride(currentPlayers.map(p => (p === outgoing ? incoming : p)));
  }

  // Real rule: every 3 points TOTAL, combined across both teams (not "3
  // in a row by one team"), both captains send a replacement. onCourtPlayers
  // only changes in the log when a sub actually happens, so counting
  // trailing log entries that match the current on-court set already IS
  // "combined points since the last sub" — team-scoring order never
  // resets it.
  function pointsSinceLastSub(currentOnCourt: string[]): number {
    const currentKey = [...currentOnCourt].sort().join('|');
    let count = 0;
    for (let i = log.length - 1; i >= 0; i--) {
      if ([...log[i].onCourtPlayers].sort().join('|') === currentKey) count++;
      else break;
    }
    return count;
  }

  // Real rule: a player who's already had a Rapid Fire turn can't repeat
  // until every one of their team's players has had a turn — only THEN
  // does a new rotation cycle open up and repeats become fair game, and
  // the SAME rule applies again for every cycle after that.
  //
  // Bug found via live testing: the old version tracked a single Set of
  // "everyone who's ever played" and a one-time `everyonePlayed` flag —
  // once every player had appeared ONCE, that flag stayed true forever,
  // silently disabling the repeat-turn rule for every cycle after the
  // first (any bench player became selectable again, including someone
  // who'd just come off court seconds earlier, multiple times over).
  // Play COUNTS fix this without any special-casing: a player is only
  // eligible once their count is tied for the lowest on their team —
  // once everyone's caught up to the same count, that count becomes the
  // new floor and repeats open up again, cycle after cycle.
  function teamPlayCounts(team: { players: string[] }): Map<string, number> {
    const counts = new Map(team.players.map(p => [p, 0]));
    for (const entry of log) {
      for (const p of entry.onCourtPlayers) {
        if (counts.has(p)) counts.set(p, counts.get(p)! + 1);
      }
    }
    return counts;
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
  // Checked against the STABLE logged lineup, not the in-progress override
  // — real bug found via live testing: checking the post-override combo
  // meant the instant ANY single player was subbed, that brand-new combo
  // had zero points logged against it, so `sinceLastSub` reset to 0 and
  // the rotation checkpoint (and its lock) vanished immediately — even
  // with only 1 of the required 4 players actually replaced.
  const sinceLastSub = pointsSinceLastSub(state.onCourtPlayers);
  const rotationDue = sinceLastSub >= 3;
  // Real rule, not advisory: at a checkpoint, BOTH on-court players per
  // team must be replaced — swapping only 1 of a team's 2 (or subbing one
  // team but not the other) still leaves scoring locked. Checked against
  // the last recorded (pre-override) lineup: a team only clears once
  // NEITHER of its current on-court players was there before.
  const beforeOnCourt = new Set(state.onCourtPlayers);
  const teamsStillNeedingSub = rotationDue
    ? teams.filter(t => onCourtPlayers.filter(p => t.players.includes(p)).some(p => beforeOnCourt.has(p)))
    : [];
  const scoringLocked = teamsStillNeedingSub.length > 0;
  const bonus = state.isComplete ? computeRapidFireBonus(state, config) : null;
  const winnerLabel = state.winnerTeamId ? (teams.find(t => t.id === state.winnerTeamId)?.label ?? state.winnerTeamId) : null;

  return (
    <>
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
          <Link href={`/session/${id}/team-championship/results`} className="btn-primary" style={{ display: 'inline-block', marginTop: 16 }}>
            View Final Results →
          </Link>
        </div>
      ) : (
        <>
          <h2>On Court Now</h2>
          <div
            className="card"
            style={{
              marginBottom: 16,
              borderColor: rotationDue ? 'var(--warning, #b45309)' : undefined,
              borderWidth: rotationDue ? 2 : undefined,
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', margin: 0 }}>{onCourtPlayers.join(' & ')}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: '4px 0 0' }}>
              {sinceLastSub} combined point{sinceLastSub === 1 ? '' : 's'} since the last sub
            </p>
            {rotationDue && (
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning, #b45309)', textAlign: 'center', margin: '8px 0 0' }}>
                🔁 Rotation checkpoint — scoring is locked until{' '}
                {teamsStillNeedingSub.length === teams.length
                  ? 'both captains replace BOTH their on-court players below.'
                  : `${teamsStillNeedingSub.map(t => t.label ?? t.id).join(' and ')} replace${teamsStillNeedingSub.length === 1 ? 's' : ''} both on-court players below.`}
              </p>
            )}
          </div>

          <h2>Sub</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
            Pick a bench name to swap them onto the court immediately. Someone who&apos;s already played can&apos;t repeat until every teammate has had a turn.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {teams.map(team => {
              const onCourt = onCourtPlayers.filter(p => team.players.includes(p));
              const counts = teamPlayCounts(team);
              const minCount = team.players.length === 0 ? 0 : Math.min(...team.players.map(p => counts.get(p) ?? 0));
              const bench = team.players.filter(p => !onCourt.includes(p) && (counts.get(p) ?? 0) === minCount);
              return (
                <div key={team.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{team.label ?? team.id}</div>
                  {onCourt.map((player, slot) => (
                    <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>On Court</span>
                      <select
                        value={player}
                        onChange={e => handleSlotChange(onCourtPlayers, player, e.target.value)}
                        disabled={bench.length === 0}
                        aria-label={`${team.label ?? team.id} on-court player ${slot + 1}`}
                        style={{ minHeight: 48, fontSize: 16, padding: '10px 12px', width: '100%', boxSizing: 'border-box', fontWeight: 700 }}
                      >
                        <option value={player}>{player}</option>
                        {bench.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {scoringLocked && (
            <p style={{ fontSize: 12, color: 'var(--warning, #b45309)', textAlign: 'center', fontWeight: 700, marginBottom: 8 }}>
              Scoring locked until the required subs are made above.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {teams.map(team => (
              <button
                key={team.id}
                className="btn-primary"
                style={{ minHeight: 64, fontSize: 18, fontWeight: 800 }}
                disabled={scoring || scoringLocked}
                onClick={() => handleScore(team.id, onCourtPlayers)}
              >
                {scoring ? 'Saving…' : `+1 ${team.label ?? team.id}`}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
    <SessionNav sessionId={id} format="team_championship" clubId={session.club_id} />
    </>
  );
}
