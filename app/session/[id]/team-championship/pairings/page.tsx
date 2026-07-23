'use client';

import { use, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { getSession, getRounds, insertRounds, updateRoundTeams, updateRoundCourt, swapRoundOrder, clearRoundScore, addCourtToSession, removeLastCourtFromSession, type RoundRow, type SessionRow } from '@/lib/db';
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
  // A round that's already saved shows a read-only "✓ Saved" state with an
  // explicit Edit button, rather than always-interactive dropdowns —
  // real feedback: showing live-editable selects right after a save read
  // as "you just saved it on your own" with no clear way back in. Editing
  // any select naturally un-saves it (draft no longer matches the DB, see
  // isSaved below), so this only needs to gate the disabled state, not
  // track a full separate "editing" mode.
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, [string, string, string, string]>>({});
  const [addingCourt, setAddingCourt] = useState(false);
  const [removingCourt, setRemovingCourt] = useState(false);

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
      // generateSquadRivalryScheduleN (shared with Squad Rivalry, which
      // doesn't care which bucket is which) doesn't guarantee court.teamA
      // is always session.squads[0]'s players — a real bug found via live
      // testing: the pairings screen's dropdowns are scoped one-column-
      // per-team, so a swapped bucket put a Team 2 player where only Team
      // 1 names are offered, silently showing "Select…" instead of the
      // real value. Fixed at the source here (not by widening the
      // dropdowns) so each column only ever shows its own team's roster,
      // which is also what a captain actually wants — no risk of
      // accidentally assigning the wrong team's player into a slot.
      const team0Id = session.squads![0].id;
      const squadOfPlayer = new Map(session.squads!.flatMap(t => t.players.map(p => [p, t.id] as const)));
      const normalized = generated.map(r => ({
        ...r,
        courts: r.courts.map(c => (squadOfPlayer.get(c.teamA[0]) === team0Id ? c : { teamA: c.teamB, teamB: c.teamA })),
      }));
      await insertRounds(session.id, normalized);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate pairings.');
    } finally {
      setGenerating(false);
    }
  }

  // Pure manual entry, no algorithm — blank team_a/team_b slots for every
  // round/court, for a captain who wants to type in pre-agreed pairings
  // from scratch rather than start from (and un-learn) a suggestion.
  async function handleStartManual() {
    if (!session) return;
    if (!session.stage_config) {
      setError('This session is missing stage setup and cannot start pairings — go back to setup and recreate it.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const courtCount = session.court_labels.length || 1;
      const roundNumbers = session.stage_config.flatMap(s =>
        Array.from({ length: s.roundEnd - s.roundStart + 1 }, (_, i) => s.roundStart + i)
      );
      const blankRounds = roundNumbers.map(roundNumber => ({
        roundNumber,
        courts: Array.from({ length: courtCount }, () => ({ teamA: ['', ''] as [string, string], teamB: ['', ''] as [string, string] })),
        sittingOutPerCourt: Array.from({ length: courtCount }, () => []),
      }));
      await insertRounds(session.id, blankRounds);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start manual pairings.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveRound(round: RoundRow) {
    if (round.score_a !== null && round.score_b !== null) {
      setError('This round already has a score and is locked — pairings can\'t be changed after a result is recorded. Clear the score first if this was a mistake.');
      return;
    }
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

  const [changingCourtId, setChangingCourtId] = useState<string | null>(null);
  const [changingOrderId, setChangingOrderId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  async function handleUnlock(round: RoundRow) {
    if (!confirm(`This clears the recorded score (${round.score_a}-${round.score_b}) for this round so its pairing/court/order can be edited. Continue?`)) return;
    setUnlockingId(round.id);
    setError(null);
    try {
      await clearRoundScore(round.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock this round.');
    } finally {
      setUnlockingId(null);
    }
  }

  async function handleChangeCourt(round: RoundRow, court: number) {
    if (court === round.court) return;
    if (round.score_a !== null && round.score_b !== null) {
      setError('This round already has a score and is locked — clear the score first to reassign its court.');
      return;
    }
    setChangingCourtId(round.id);
    setError(null);
    try {
      await updateRoundCourt(round.id, court);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change court.');
    } finally {
      setChangingCourtId(null);
    }
  }

  async function handleChangeOrder(round: RoundRow, targetRoundNumber: number) {
    if (!session || targetRoundNumber === round.round_number) return;
    if (round.score_a !== null && round.score_b !== null) {
      setError('This round already has a score and is locked — reordering it would also move which stage its result counts toward. Clear the score first.');
      return;
    }
    const targetRound = rounds.find(r => r.court === round.court && r.round_number === targetRoundNumber);
    if (targetRound && targetRound.score_a !== null && targetRound.score_b !== null) {
      setError('The round you\'re swapping with already has a score — clear it first, reordering would move which stage its result counts toward.');
      return;
    }
    setChangingOrderId(round.id);
    setError(null);
    try {
      await swapRoundOrder(session.id, round.id, targetRoundNumber);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change round order.');
    } finally {
      setChangingOrderId(null);
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

  async function handleRemoveCourt() {
    if (!session) return;
    setRemovingCourt(true);
    setError(null);
    try {
      await removeLastCourtFromSession(session.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove court.');
    } finally {
      setRemovingCourt(false);
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--muted)', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span>{session.court_labels.length} court{session.court_labels.length === 1 ? '' : 's'} available</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={handleRemoveCourt}
            disabled={removingCourt || session.court_labels.length <= 1}
            style={{ fontSize: 13, padding: '8px 14px', minHeight: 40 }}
          >
            {removingCourt ? 'Removing…' : '− Remove Court'}
          </button>
          <button className="btn-secondary" onClick={handleAddCourt} disabled={addingCourt} style={{ fontSize: 13, padding: '8px 14px', minHeight: 40 }}>
            {addingCourt ? 'Adding…' : '+ Add Court'}
          </button>
        </div>
      </div>

      {rounds.length === 0 && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, margin: 0 }}>
            No pairings yet — generate a balanced starting point and hand-edit it, or start fully blank and enter every pairing yourself.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn-primary" onClick={handleGenerate} disabled={generating} style={{ minHeight: 48, fontSize: 15 }}>
              {generating ? 'Generating…' : 'Generate Suggested Pairings'}
            </button>
            <button className="btn-secondary" onClick={handleStartManual} disabled={generating} style={{ minHeight: 48, fontSize: 15 }}>
              {generating ? 'Starting…' : 'Start Manual Entry (blank)'}
            </button>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <details className="card" style={{ marginBottom: 16, borderColor: 'var(--warning, #b45309)' }}>
          <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ⚠️ {warnings.length} pairing warning{warnings.length === 1 ? '' : 's'} — not blocking, tap to review
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
            {(['repeat_partner', 'missing_partner', 'play_count'] as const).map(type => {
              const count = warnings.filter(w => w.type === type).length;
              if (count === 0) return null;
              const typeLabel = type === 'repeat_partner' ? 'Repeat partners' : type === 'missing_partner' ? 'Never partnered' : 'Uneven play count';
              return (
                <p key={type} style={{ margin: 0, fontWeight: 700 }}>
                  {typeLabel}: {count}
                </p>
              );
            })}
          </div>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--muted)', maxHeight: 300, overflowY: 'auto' }}>
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}

      {stages.map(stage => {
        const stageRounds = rounds.filter(r => r.round_number >= stage.roundStart && r.round_number <= stage.roundEnd);
        if (stageRounds.length === 0) return null;
        const stageRoundNumbers = Array.from({ length: stage.roundEnd - stage.roundStart + 1 }, (_, i) => stage.roundStart + i);
        const courtCount = session.court_labels.length || 1;
        // Grouped by round number, courts side by side within one box —
        // matches the same visual pattern the scoring screen
        // (app/session/[id]/play/page.tsx) already uses, so a captain
        // sees "Round 6" as one unit (all 3 courts) instead of 3 separate
        // unrelated-looking cards.
        const roundNumbersInStage = [...new Set(stageRounds.map(r => r.round_number))].sort((a, b) => a - b);
        return (
          <section key={stage.stageLabel} style={{ marginBottom: 20 }}>
            <h2>{stage.stageLabel} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>({stage.pointsPerWin} pt/win)</span></h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {roundNumbersInStage.map(roundNumber => {
                const courtsInRound = stageRounds.filter(r => r.round_number === roundNumber).sort((a, b) => a.court - b.court);
                return (
                  <div key={roundNumber} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>Round {roundNumber}</span>
                      <Link href={`/session/${id}/team-championship/round/${roundNumber}`} className="text-link-btn" style={{ fontSize: 12 }}>
                        Open Round {roundNumber} →
                      </Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {courtsInRound.map(round => {
                        const draft = drafts[round.id] ?? [round.team_a[0], round.team_a[1], round.team_b[0], round.team_b[1]];
                        const isScored = round.score_a !== null && round.score_b !== null;
                        // Persistent, not a timed flash — comparing the
                        // current draft against what's actually saved in
                        // the DB means "Saved" stays visible until the
                        // draft genuinely changes again, instead of
                        // vanishing the instant a DIFFERENT round is saved
                        // (a single shared justSavedId used to do exactly
                        // that — real feedback from testing this live).
                        const isSaved =
                          !isScored &&
                          draft[0] === round.team_a[0] &&
                          draft[1] === round.team_a[1] &&
                          draft[2] === round.team_b[0] &&
                          draft[3] === round.team_b[1] &&
                          draft.every(name => name !== '');
                        const selectStyle: CSSProperties = { minHeight: 48, fontSize: 16, padding: '10px 12px', width: '100%', boxSizing: 'border-box' };
                        return (
                          <div key={round.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)', flexWrap: 'wrap' }}>
                              <span>Court</span>
                              <select
                                value={round.court}
                                onChange={e => handleChangeCourt(round, Number(e.target.value))}
                                disabled={isScored || changingCourtId === round.id}
                                aria-label={`Change court for round ${round.round_number} court ${round.court}`}
                                style={{ fontSize: 14, fontWeight: 700, minHeight: 40, padding: '6px 10px' }}
                              >
                                {Array.from({ length: courtCount }, (_, i) => i + 1).map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <span>· Order</span>
                              <select
                                value={round.round_number}
                                onChange={e => handleChangeOrder(round, Number(e.target.value))}
                                disabled={isScored || changingOrderId === round.id}
                                aria-label={`Change round order for round ${round.round_number} court ${round.court}`}
                                style={{ fontSize: 14, fontWeight: 700, minHeight: 40, padding: '6px 10px' }}
                              >
                                {stageRoundNumbers.map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                              {(changingOrderId === round.id || changingCourtId === round.id) && <span>Saving…</span>}
                              {isScored && <span>🔒 Locked</span>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{rosterByTeam[0]?.label}</span>
                                {[0, 1].map(slot => (
                                  <select
                                    key={slot}
                                    value={draft[slot]}
                                    onChange={e => updateDraftSlot(round.id, slot, e.target.value)}
                                    disabled={isScored || (isSaved && editingRoundId !== round.id)}
                                    aria-label={`Round ${round.round_number} court ${round.court} ${rosterByTeam[0]?.label} player ${slot + 1}`}
                                    style={selectStyle}
                                  >
                                    <option value="">Select…</option>
                                    {rosterByTeam[0]?.players.map(p => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                ))}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{rosterByTeam[1]?.label}</span>
                                {[2, 3].map(slot => (
                                  <select
                                    key={slot}
                                    value={draft[slot]}
                                    onChange={e => updateDraftSlot(round.id, slot, e.target.value)}
                                    disabled={isScored || (isSaved && editingRoundId !== round.id)}
                                    aria-label={`Round ${round.round_number} court ${round.court} ${rosterByTeam[1]?.label} player ${slot - 1}`}
                                    style={selectStyle}
                                  >
                                    <option value="">Select…</option>
                                    {rosterByTeam[1]?.players.map(p => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                ))}
                              </div>
                            </div>
                            {isScored && (
                              <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
                                Scored {round.score_a}-{round.score_b} — locked. Unlock to correct a mistaken pairing/court/order (this clears the recorded score).
                              </p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              {isSaved ? (
                                <>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success, #16a34a)', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
                                    ✓ Saved
                                  </span>
                                  <button
                                    className="btn-secondary"
                                    style={{ minHeight: 44, fontSize: 14, padding: '10px 16px' }}
                                    onClick={() => setEditingRoundId(round.id)}
                                  >
                                    Edit
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn-secondary"
                                  style={{ alignSelf: 'flex-start', minHeight: 44, fontSize: 14, padding: '10px 16px' }}
                                  onClick={() => handleSaveRound(round)}
                                  disabled={isScored || savingRoundId === round.id}
                                >
                                  {savingRoundId === round.id ? 'Saving…' : isScored ? 'Locked' : 'Save Round'}
                                </button>
                              )}
                              {isScored && (
                                <button
                                  className="btn-secondary"
                                  style={{ alignSelf: 'flex-start', minHeight: 44, fontSize: 14, padding: '10px 16px' }}
                                  onClick={() => handleUnlock(round)}
                                  disabled={unlockingId === round.id}
                                >
                                  {unlockingId === round.id ? 'Unlocking…' : 'Unlock'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {allPlayers.length === 0 && <p style={{ color: 'var(--muted)' }}>No players found for this session.</p>}

      {rounds.length > 0 && (
        <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
          <Link href={`/session/${id}/schedule`} className="btn-primary" style={{ display: 'inline-block' }}>
            Continue to Schedule →
          </Link>
        </div>
      )}
    </main>
  );
}
