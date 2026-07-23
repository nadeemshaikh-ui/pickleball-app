'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getSession,
  getRounds,
  updateRoundTeams,
  updateRoundCourt,
  clearRoundScore,
  type RoundRow,
  type SessionRow,
} from '@/lib/db';
import { shareToWhatsApp } from '@/lib/whatsapp';

// One round at a time, not all 15 on one page — real feedback: "Round 1
// page should have option to add pairings of round one, then schedule
// generation should happen where round 1 schedule is generated and shared
// on WhatsApp. Same for round 2 and 3." The all-rounds overview page
// (team-championship/pairings) still exists for the warnings/validation
// view across the whole tournament; this is the primary entry point for
// actually filling in and sharing pairings round by round.
export default function TeamChampionshipRoundPage({ params }: { params: Promise<{ id: string; roundNumber: string }> }) {
  const { id, roundNumber: roundNumberParam } = use(params);
  const roundNumber = Number(roundNumberParam);
  const router = useRouter();

  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [changingCourtId, setChangingCourtId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, [string, string, string, string]>>({});

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

  async function handleSaveRound(round: RoundRow) {
    if (round.score_a !== null && round.score_b !== null) {
      setError('This round already has a score and is locked — clear the score first if this was a mistake.');
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

  async function handleUnlock(round: RoundRow) {
    if (!confirm(`This clears the recorded score (${round.score_a}-${round.score_b}) so its pairing/court can be edited. Continue?`)) return;
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

  function updateDraftSlot(roundId: string, slot: number, value: string) {
    setDrafts(prev => {
      const current = prev[roundId] ?? ['', '', '', ''];
      const next = [...current] as [string, string, string, string];
      next[slot] = value;
      return { ...prev, [roundId]: next };
    });
  }

  function handleShareWhatsApp(stageLabel: string, courtsInRound: RoundRow[]) {
    if (!session) return;
    const title = session.group_name || 'Team Championship';
    const lines = courtsInRound
      .filter(r => r.team_a[0] && r.team_b[0])
      .sort((a, b) => a.court - b.court)
      .map(r => `Court ${r.court}: ${r.team_a.join(' & ')} vs ${r.team_b.join(' & ')}`);
    if (lines.length === 0) {
      setError('Fill in at least one court before sharing.');
      return;
    }
    const text = `🏆 ${title}\nRound ${roundNumber} — ${stageLabel}\n\n${lines.join('\n')}`;
    shareToWhatsApp(text);
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error && !session) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Session not found.</p></main>;
  if (session.format !== 'team_championship' || !session.squads || !session.stage_config) {
    return <main className="page"><p>This session isn&apos;t a Team Championship, or is missing its team/stage setup.</p></main>;
  }
  if (!Number.isFinite(roundNumber) || roundNumber < 1) {
    return <main className="page"><p>Invalid round number.</p></main>;
  }

  const teams = session.squads;
  const stages = session.stage_config;
  const rosterByTeam = teams.map(t => ({ id: t.id, label: t.label ?? t.id, players: t.players }));
  const courtCount = session.court_labels.length || 1;
  const stage = stages.find(s => roundNumber >= s.roundStart && roundNumber <= s.roundEnd);
  const allRoundNumbers = stages.flatMap(s => Array.from({ length: s.roundEnd - s.roundStart + 1 }, (_, i) => s.roundStart + i));
  const maxRound = Math.max(...allRoundNumbers, 1);
  const courtsInRound = rounds.filter(r => r.round_number === roundNumber).sort((a, b) => a.court - b.court);

  if (!stage) {
    return (
      <main className="page">
        <p>Round {roundNumber} isn&apos;t part of this tournament&apos;s configured stages (1-{maxRound}).</p>
        <Link href={`/session/${id}/team-championship/round/1`} className="btn-primary" style={{ display: 'inline-block', marginTop: 12 }}>
          Go to Round 1
        </Link>
      </main>
    );
  }

  const selectStyle = { minHeight: 48, fontSize: 16, padding: '10px 12px', width: '100%', boxSizing: 'border-box' as const };

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/team-championship/pairings`} className="text-link-btn">← All Rounds</Link>
      </div>
      <h1>Round {roundNumber}</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        {stage.stageLabel} · {stage.pointsPerWin} pt/win · {rosterByTeam[0]?.label} vs {rosterByTeam[1]?.label}
      </p>

      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <button
          className="btn-secondary"
          style={{ minHeight: 44, flex: 1 }}
          disabled={roundNumber <= 1}
          onClick={() => router.push(`/session/${id}/team-championship/round/${roundNumber - 1}`)}
        >
          ← Round {roundNumber - 1}
        </button>
        <button
          className="btn-secondary"
          style={{ minHeight: 44, flex: 1 }}
          disabled={roundNumber >= maxRound}
          onClick={() => router.push(`/session/${id}/team-championship/round/${roundNumber + 1}`)}
        >
          Round {roundNumber + 1} →
        </button>
      </div>

      <button
        className="btn-primary"
        style={{ width: '100%', minHeight: 48, marginBottom: 16 }}
        onClick={() => handleShareWhatsApp(stage.stageLabel, courtsInRound)}
      >
        Share Round {roundNumber} on WhatsApp
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {courtsInRound.map(round => {
          const draft = drafts[round.id] ?? [round.team_a[0], round.team_a[1], round.team_b[0], round.team_b[1]];
          const isScored = round.score_a !== null && round.score_b !== null;
          const isSaved =
            !isScored &&
            draft[0] === round.team_a[0] &&
            draft[1] === round.team_a[1] &&
            draft[2] === round.team_b[0] &&
            draft[3] === round.team_b[1] &&
            draft.every(name => name !== '');
          return (
            <div key={round.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)', flexWrap: 'wrap' }}>
                <span>Court</span>
                <select
                  value={round.court}
                  onChange={e => handleChangeCourt(round, Number(e.target.value))}
                  disabled={isScored || changingCourtId === round.id}
                  aria-label={`Change court for round ${roundNumber}`}
                  style={{ fontSize: 14, fontWeight: 700, minHeight: 40, padding: '6px 10px' }}
                >
                  {Array.from({ length: courtCount }, (_, i) => i + 1).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {changingCourtId === round.id && <span>Saving…</span>}
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
                      aria-label={`Round ${roundNumber} court ${round.court} ${rosterByTeam[0]?.label} player ${slot + 1}`}
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
                      aria-label={`Round ${roundNumber} court ${round.court} ${rosterByTeam[1]?.label} player ${slot - 1}`}
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
                  Scored {round.score_a}-{round.score_b} — locked. Unlock to correct a mistaken pairing/court (this clears the recorded score).
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {isSaved ? (
                  <>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success, #16a34a)', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
                      ✓ Saved
                    </span>
                    <button className="btn-secondary" style={{ minHeight: 44, fontSize: 14, padding: '10px 16px' }} onClick={() => setEditingRoundId(round.id)}>
                      Edit
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-secondary"
                    style={{ minHeight: 44, fontSize: 14, padding: '10px 16px' }}
                    onClick={() => handleSaveRound(round)}
                    disabled={isScored || savingRoundId === round.id}
                  >
                    {savingRoundId === round.id ? 'Saving…' : isScored ? 'Locked' : 'Save Court'}
                  </button>
                )}
                {isScored && (
                  <button
                    className="btn-secondary"
                    style={{ minHeight: 44, fontSize: 14, padding: '10px 16px' }}
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
        {courtsInRound.length === 0 && (
          <div className="card">
            <p style={{ color: 'var(--muted)' }}>No courts set up for this round yet — generate or start manual pairings from the all-rounds view.</p>
            <Link href={`/session/${id}/team-championship/pairings`} className="btn-primary" style={{ display: 'inline-block', marginTop: 10 }}>
              Go to All Rounds
            </Link>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <Link href={`/session/${id}/schedule`} className="btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
          Session Schedule
        </Link>
        <Link href={`/session/${id}/team-championship/results`} className="btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
          Standings
        </Link>
      </div>
    </main>
  );
}
