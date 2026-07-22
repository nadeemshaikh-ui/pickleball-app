'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, insertRounds, updateRoundTeams, addCourtToSession, type RoundRow, type SessionRow } from '@/lib/db';
import { generateSquadRivalryScheduleN } from '@/lib/squads';
import { validateManualPairings } from '@/lib/teamChampionship';

// Team Championship's round-pairing entry screen — the one thing every
// other format's Setup page handles automatically (who plays whom) is
// manual-first here, since real tournaments usually have pairings
// pre-agreed by team captains off-app. "Generate Suggested Pairings"
// gives a real, balanced starting point (reusing lib/squads.ts's N-squad
// algorithm at N=2 — Team Championship's 2 already-split teams ARE the
// N=2 case, so zero new scheduling code was needed for this), which the
// captain can then hand-edit round by round. Soft validation warnings
// (never blocking) surface live as pairings change.
export default function TeamChampionshipPairingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, [string, string, string, string]>>({});
  const [addingCourt, setAddingCourt] = useState(false);

  async function load() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
    const nextDrafts: Record<string, [string, string, string, string]> = {};
    for (const round of r) nextDrafts[round.id] = [round.team_a[0], round.team_a[1], round.team_b[0], round.team_b[1]];
    setDrafts(nextDrafts);
  }

  useEffect(() => {
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load session.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleGenerate() {
    if (!session) return;
    if (!session.squads || !session.stage_config) {
      setError('This session is missing squad or stage setup and cannot generate pairings — go back to setup and recreate it.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const totalRounds = session.stage_config.reduce((sum, s) => sum + (s.roundEnd - s.roundStart + 1), 0);
      const courtCount = session.court_labels.length || 1;
      const seed = `${session.id}-team-championship`;
      const { rounds: generated } = generateSquadRivalryScheduleN(session.players, 2, courtCount, totalRounds, seed, [], session.squads);
      await insertRounds(session.id, generated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate pairings.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveRound(round: RoundRow) {
    const draft = drafts[round.id];
    if (!draft || draft.some(name => !name)) {
      setError('Every slot needs a player before saving.');
      return;
    }
    if (new Set(draft).size !== 4) {
      setError('A round needs 4 different players — no one can play twice on the same court.');
      return;
    }
    setSavingRoundId(round.id);
    setError(null);
    try {
      await updateRoundTeams(round.id, [draft[0], draft[1]], [draft[2], draft[3]]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save this round.');
    } finally {
      setSavingRoundId(null);
    }
  }

  async function handleAddCourt() {
    if (!session) return;
    setAddingCourt(true);
    setError(null);
    try {
      const nextLabel = String(session.court_labels.length + 1);
      await addCourtToSession(session.id, nextLabel);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add court.');
    } finally {
      setAddingCourt(false);
    }
  }

  function updateDraftSlot(roundId: string, slot: number, value: string) {
    setDrafts(prev => {
      const current = prev[roundId] ?? ['', '', '', ''];
      const next = [...current] as [string, string, string, string];
      next[slot] = value;
      return { ...prev, [roundId]: next };
    });
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error && !session) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Session not found.</p></main>;
  if (session.format !== 'team_championship' || !session.squads || !session.stage_config) {
    return <main className="page"><p>This session isn&apos;t a Team Championship, or is missing its team/stage setup.</p></main>;
  }

  const teams = session.squads;
  const stages = session.stage_config;
  const rosterByTeam = teams.map(t => ({ id: t.id, label: t.label ?? t.id, players: t.players }));
  const allPlayers = teams.flatMap(t => t.players);

  const warnings =
    rounds.length > 0
      ? validateManualPairings(
          rounds.map(r => ({ roundNumber: r.round_number, teamA: r.team_a, teamB: r.team_b })),
          teams,
          stages,
          session.court_labels.length || 1
        )
      : [];

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
      </div>
      <h1>Round Pairings</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        {rosterByTeam[0]?.label} vs {rosterByTeam[1]?.label}
      </p>

      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        <span>{session.court_labels.length} court{session.court_labels.length === 1 ? '' : 's'} available</span>
        <button className="btn-secondary" onClick={handleAddCourt} disabled={addingCourt} style={{ fontSize: 12, padding: '4px 10px' }}>
          {addingCourt ? 'Adding…' : '+ Add Court'}
        </button>
      </div>

      {rounds.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, margin: '0 0 10px' }}>
            No pairings yet. Generate a balanced starting point, then edit any round by hand.
          </p>
          <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Suggested Pairings'}
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warning, #b45309)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px' }}>Heads up ({warnings.length}) — not blocking, just flagging:</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--muted)' }}>
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {stages.map(stage => {
        const stageRounds = rounds.filter(r => r.round_number >= stage.roundStart && r.round_number <= stage.roundEnd);
        if (stageRounds.length === 0) return null;
        return (
          <section key={stage.stageLabel} style={{ marginBottom: 20 }}>
            <h2>{stage.stageLabel} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>({stage.pointsPerWin} pt/win)</span></h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stageRounds.map(round => {
                const draft = drafts[round.id] ?? [round.team_a[0], round.team_a[1], round.team_b[0], round.team_b[1]];
                return (
                  <div key={round.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Round {round.round_number} · Court {round.court}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{rosterByTeam[0]?.label}</span>
                        {[0, 1].map(slot => (
                          <select
                            key={slot}
                            value={draft[slot]}
                            onChange={e => updateDraftSlot(round.id, slot, e.target.value)}
                            aria-label={`Round ${round.round_number} court ${round.court} ${rosterByTeam[0]?.label} player ${slot + 1}`}
                          >
                            <option value="">Select…</option>
                            {rosterByTeam[0]?.players.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{rosterByTeam[1]?.label}</span>
                        {[2, 3].map(slot => (
                          <select
                            key={slot}
                            value={draft[slot]}
                            onChange={e => updateDraftSlot(round.id, slot, e.target.value)}
                            aria-label={`Round ${round.round_number} court ${round.court} ${rosterByTeam[1]?.label} player ${slot - 1}`}
                          >
                            <option value="">Select…</option>
                            {rosterByTeam[1]?.players.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </div>
                    {round.score_a !== null && round.score_b !== null && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
                        Scored {round.score_a}-{round.score_b} — saving a pairing change here resets this round&apos;s score.
                      </p>
                    )}
                    <button
                      className="btn-secondary"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => handleSaveRound(round)}
                      disabled={savingRoundId === round.id}
                    >
                      {savingRoundId === round.id ? 'Saving…' : 'Save Round'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {allPlayers.length === 0 && <p style={{ color: 'var(--muted)' }}>No players found for this session.</p>}
    </main>
  );
}
