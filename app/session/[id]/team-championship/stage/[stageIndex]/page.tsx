'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getSession,
  getRounds,
  insertRounds,
  updateRoundTeams,
  updateRoundCourt,
  clearRoundScore,
  markSessionCompleted,
  type RoundRow,
  type SessionRow,
} from '@/lib/db';
import { generateSquadRivalryScheduleN } from '@/lib/squads';
import { computePlayerStats, computeTeamChampionshipStandings } from '@/lib/teamChampionship';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { WhatsAppIcon } from '@/components/icons';
import StageImageTemplate from '@/components/StageImageTemplate';
import SessionNav from '@/components/SessionNav';
import ConfirmModal from '@/components/ConfirmModal';

import React, { ErrorInfo } from 'react';

class StageErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, errorInfo: ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("StageErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="page" style={{ padding: 20 }}>
          <h2 style={{ color: 'red' }}>Stage Page Crash Detected</h2>
          <pre style={{ color: 'red', overflowX: 'auto' }}>{this.state.error?.toString()}</pre>
          <details>
            <summary>Stack Trace</summary>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 10 }}>{this.state.errorInfo?.componentStack}</pre>
          </details>
          <button className="btn-primary" onClick={() => window.location.reload()} style={{ marginTop: 20 }}>Reload Page</button>
        </main>
      );
    }
    return this.props.children;
  }
}

// Real tournament flow, not round-1-through-15 all thrown on one screen:
// captains work stage by stage (Foundation/Momentum/Championship), fill in
// that stage's pairings, share ONE WhatsApp message covering the whole
// stage, play it out, and only then does the next stage open up — mirrors
// assertStageFullyScored's same "can't advance past an unscored stage"
// rule already used by the separate tournament-bracket engine
// (lib/tournamentStages.ts), applied here to Team Championship's stages.
// stageIndex is 1-based, matching session.stage_config's array order.
function TeamChampionshipStagePageContent({ params }: { params: Promise<{ id: string; stageIndex: string }> }) {
  const { id, stageIndex: stageIndexParam } = use(params);
  const stageIndex = Number(stageIndexParam) || 1;
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
  const [generating, setGenerating] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const [stageImageFile, setStageImageFile] = useState<File | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const imageCaptureRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
    const user = await getCurrentUser();
    if (user) setIsAdmin(await isCurrentUserAdmin(s.club_id));
    const nextDrafts: Record<string, [string, string, string, string]> = {};
    for (const round of r) {
      nextDrafts[round.id] = [
        round.team_a?.[0] || '',
        round.team_a?.[1] || '',
        round.team_b?.[0] || '',
        round.team_b?.[1] || ''
      ];
    }
    setDrafts(nextDrafts);
  }

  useEffect(() => {
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load session.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Pre-render the stage image as soon as its pairings exist, well before
  // the user clicks share — see lib/shareImage.ts: rendering inside the
  // click handler burns the browser's user-gesture window on some mobile
  // browsers, so navigator.share() gets silently rejected even though
  // canShare() said yes. This is the same fix already applied on the
  // session results recap (app/session/[id]/results/page.tsx).
  useEffect(() => {
    if (!session?.stage_config || !imageCaptureRef.current) return;
    const stageForImage = session.stage_config[stageIndex - 1];
    if (!stageForImage) return;
    const roundNumbers = new Set(
      Array.from({ length: stageForImage.roundEnd - stageForImage.roundStart + 1 }, (_, i) => stageForImage.roundStart + i)
    );
    const stageRoundsForImage = rounds.filter(r => roundNumbers.has(r.round_number));
    if (!stageRoundsForImage.some(r => r.team_a?.[0] && r.team_b?.[0])) {
      setStageImageFile(null);
      return;
    }
    renderElementToImage(imageCaptureRef.current, `${(stageForImage.stageLabel ?? 'stage').toLowerCase()}-${id}.png`)
      .then(file => {
        setStageImageFile(file);
        setImageShareError(null);
      })
      .catch(e => {
        // Real bug found via live testing: this used to swallow the error
        // and just set the file to null, so a genuine html2canvas failure
        // looked identical to "still preparing" — the Share button stayed
        // stuck forever with no visible reason why. Surface it instead.
        setStageImageFile(null);
        setImageShareError(e instanceof Error ? `Couldn't prepare the image: ${e.message}` : "Couldn't prepare the image.");
      });
  }, [session, rounds, stageIndex, id]);

  // Nothing is generated for a stage until that stage is actually opened —
  // real feedback: pre-filling all 15 rounds up front (the old behavior)
  // meant Momentum/Championship's matchups existed in the DB (and were
  // technically viewable) before Foundation was even played. The seed and
  // algorithm are unchanged from the old all-at-once generator — same
  // deterministic output — this just computes the FULL tournament schedule
  // as before but only inserts the slice belonging to the CURRENT stage,
  // so stage 2 opening later still produces the identical rounds 6-10 it
  // always would have, just deferred until that stage begins.
  async function handleGenerateStage(stageToGenerate: { roundStart: number; roundEnd: number }) {
    if (!isAdmin) {
      setError('Only club admins can generate this stage\'s pairings.');
      return;
    }
    if (!session || !session.squads || !session.stage_config) return;
    setGenerating(true);
    setError(null);
    try {
      const isFinalsStage = stageToGenerate.roundStart === 9; // Rounds 9-11 (Gold & Bronze Finals)
      const courtCount = session.court_labels?.length || 1;
      
      let normalized = [];
      
      if (isFinalsStage) {
        // Calculate player stats and team standings from the previous 8 rounds
        const previousRounds = rounds.filter(r => r.round_number >= 1 && r.round_number <= 8);
        const playerStats = computePlayerStats(previousRounds, session.squads);
        const standings = computeTeamChampionshipStandings(previousRounds, session.squads, session.stage_config);
        
        // Sort teams based on accumulated points to determine Gold and Bronze qualifiers
        const sortedTeams = [...session.squads].sort((a, b) => {
          const pointsA = standings.totalsByTeam.get(a.id) ?? 0;
          const pointsB = standings.totalsByTeam.get(b.id) ?? 0;
          return pointsB - pointsA;
        });

        // Top 2 play Gold; Bottom 2 play Bronze
        const goldTeam1 = sortedTeams[0] || { id: '', players: [] };
        const goldTeam2 = sortedTeams[1] || { id: '', players: [] };
        const bronzeTeam1 = sortedTeams[2] || { id: '', players: [] };
        const bronzeTeam2 = sortedTeams[3] || { id: '', players: [] };

        // Helper to sort players inside a specific team based on their individual wins and point diffs
        const getSortedPlayers = (team: { id: string; players: string[] }) => {
          const members = playerStats.filter(ps => ps.teamId === team.id);
          members.sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || b.pointDiff - a.pointDiff);
          return members.map(m => m.name);
        };

        const gold1Players = getSortedPlayers(goldTeam1);
        const gold2Players = getSortedPlayers(goldTeam2);
        const bronze1Players = getSortedPlayers(bronzeTeam1);
        const bronze2Players = getSortedPlayers(bronzeTeam2);

        // Generate the 3 finals rounds dynamically
        // Gold Final (Court 1 & 2): Top 2 qualifying teams play.
        // Bronze Final (Court 3): Bottom 2 qualifying teams play.
        const roundsToCreate = Array.from({ length: 3 }, (_, rIdx) => {
          const roundNumber = stageToGenerate.roundStart + rIdx;
          const courts = [];
          
          if (roundNumber === 9) {
            // R1 Gold Match 1 (Court 1): Team A Rank 1 & 2 vs Team B Rank 1 & 2
            // R1 Gold Match 2 (Court 2): Team A Rank 3 & 4 vs Team B Rank 3 & 4
            // R1 Bronze Match 1 (Court 3): Team A Rank 1 & 2 vs Team B Rank 1 & 2
            courts.push({
              teamA: [gold1Players[0] || '', gold1Players[1] || ''] as [string, string],
              teamB: [gold2Players[0] || '', gold2Players[1] || ''] as [string, string]
            });
            courts.push({
              teamA: [gold1Players[2] || '', gold1Players[3] || ''] as [string, string],
              teamB: [gold2Players[2] || gold2Players[0] || '', gold2Players[3] || gold2Players[1] || ''] as [string, string]
            });
            courts.push({
              teamA: [bronze1Players[0] || '', bronze1Players[1] || ''] as [string, string],
              teamB: [bronze2Players[0] || '', bronze2Players[1] || ''] as [string, string]
            });
          } else if (roundNumber === 10) {
            // R2 Gold Match 1 (Court 1): Shuffle partners (e.g. 1 & 3 vs 1 & 3)
            // R2 Gold Match 2 (Court 2): Shuffle partners (e.g. 2 & 4 vs 2 & 4)
            // R2 Bronze Match 1 (Court 3): Shuffle partners (e.g. 1 & 3 vs 1 & 3)
            courts.push({
              teamA: [gold1Players[0] || '', gold1Players[2] || ''] as [string, string],
              teamB: [gold2Players[0] || '', gold2Players[2] || ''] as [string, string]
            });
            courts.push({
              teamA: [gold1Players[1] || '', gold1Players[3] || ''] as [string, string],
              teamB: [gold2Players[1] || '', gold2Players[3] || ''] as [string, string]
            });
            courts.push({
              teamA: [bronze1Players[0] || '', bronze1Players[2] || bronze1Players[1] || ''] as [string, string],
              teamB: [bronze2Players[0] || '', bronze2Players[2] || bronze2Players[1] || ''] as [string, string]
            });
          } else {
            // Decider R3 (Captains choice default start)
            courts.push({
              teamA: [gold1Players[0] || '', gold1Players[1] || ''] as [string, string],
              teamB: [gold2Players[0] || '', gold2Players[1] || ''] as [string, string]
            });
            courts.push({
              teamA: [gold1Players[2] || '', gold1Players[3] || ''] as [string, string],
              teamB: [gold2Players[2] || '', gold2Players[3] || ''] as [string, string]
            });
            courts.push({
              teamA: [bronze1Players[0] || '', bronze1Players[1] || ''] as [string, string],
              teamB: [bronze2Players[0] || '', bronze2Players[1] || ''] as [string, string]
            });
          }
          
          return {
            roundNumber,
            courts,
            sittingOutPerCourt: courts.map(() => [])
          };
        });
        
        // Normalize generated stage finals with correct squad alignment (Team A is Squad 0, Team B is Squad 1)
        const team0Id = session.squads[0]?.id;
        const squadOfPlayer = new Map((session.squads || []).flatMap(t => (t.players || []).map(p => [p, t.id] as const)));
        normalized = roundsToCreate.map(r => ({
          ...r,
          courts: r.courts.map(c => {
            const firstPlayer = c.teamA[0] || '';
            const squadId = squadOfPlayer.get(firstPlayer) || team0Id;
            return squadId === team0Id ? c : { teamA: c.teamB, teamB: c.teamA };
          }),
        }));
      } else {
        const totalRounds = session.stage_config.reduce((sum, s) => sum + (s.roundEnd - s.roundStart + 1), 0);
        const seed = `${session.id}-team-championship`;
        const { rounds: generated } = generateSquadRivalryScheduleN(session.players, 2, courtCount, totalRounds, seed, [], session.squads);
        const team0Id = session.squads[0]?.id;
        const squadOfPlayer = new Map((session.squads || []).flatMap(t => (t.players || []).map(p => [p, t.id] as const)));
        normalized = generated
          .filter(r => r.roundNumber >= stageToGenerate.roundStart && r.roundNumber <= stageToGenerate.roundEnd)
          .map(r => ({
            ...r,
            courts: r.courts.map(c => (squadOfPlayer.get(c.teamA?.[0]) === team0Id ? c : { teamA: c.teamB, teamB: c.teamA })),
          }));
      }
      
      await insertRounds(session.id, normalized);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate this stage\'s pairings.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleStartManualStage(stageToStart: { roundStart: number; roundEnd: number }) {
    if (!isAdmin) {
      setError('Only club admins can start manual pairings for this stage.');
      return;
    }
    if (!session) return;
    setGenerating(true);
    setError(null);
    try {
      const courtCount = session.court_labels?.length || 1;
      const roundNumbers = Array.from({ length: stageToStart.roundEnd - stageToStart.roundStart + 1 }, (_, i) => stageToStart.roundStart + i);
      const blankRounds = roundNumbers.map(roundNumber => ({
        roundNumber,
        courts: Array.from({ length: courtCount }, () => ({ teamA: ['', ''] as [string, string], teamB: ['', ''] as [string, string] })),
        sittingOutPerCourt: Array.from({ length: courtCount }, () => []),
      }));
      await insertRounds(session.id, blankRounds);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start manual pairings for this stage.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveRound(round: RoundRow) {
    if (!isAdmin) {
      setError('Only club admins can edit pairings.');
      return;
    }
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
    if (!isAdmin) {
      setError('Only club admins can unlock a scored round.');
      return;
    }
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
    if (!isAdmin) {
      setError('Only club admins can change a round\'s court.');
      return;
    }
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

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error && !session) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Session not found.</p></main>;
  if (session.format !== 'team_championship' || !session.squads || !session.stage_config) {
    return <main className="page"><p>This session isn&apos;t a Team Championship, or is missing its team/stage setup.</p></main>;
  }
  if (id === 'mw_mavericks_season_2_2026') {
    router.push('/tournaments/mw-mavericks');
    return <main className="page"><p>Redirecting to MW Mavericks Master Hub…</p></main>;
  }
  const parsedStageIndex = Math.floor(stageIndex);
  if (!Number.isFinite(parsedStageIndex) || parsedStageIndex < 1 || parsedStageIndex > session.stage_config.length) {
    // Only redirect if it's not a valid stage index
    if (typeof window !== 'undefined') {
      router.push(`/session/${id}/team-championship/stage/1`);
    }
    return <main className="page"><p>Redirecting to Stage 1…</p></main>;
  }

  const teams = session.squads;
  const stages = session.stage_config;
  const rosterByTeam = (teams || []).map(t => ({ id: t.id, label: t.label ?? t.id, players: t.players || [] }));
  const courtCount = session.court_labels?.length || 1;
  const stage = stages[parsedStageIndex - 1];
  
  if (!stage) {
     return <main className="page"><p>Stage definition missing or corrupted.</p></main>;
  }
  
  const stageRoundNumbers = Array.from({ length: Math.max(0, stage.roundEnd - stage.roundStart + 1) }, (_, i) => stage.roundStart + i);
  const stageRounds = rounds.filter(r => stageRoundNumbers.includes(r.round_number)).sort((a, b) => (a.round_number - b.round_number) || (a.court - b.court));

  // Stage lock removed — every block (and Rapid Fire) is open to everyone
  // regardless of whether prior blocks are fully scored. Previously this
  // gated stage N behind stage N-1 being fully scored, which is no longer
  // wanted: all blocks + Rapid Fire should be freely browsable at any time.

  const stageFullyScored = stageRounds.length > 0 && stageRounds.every(r => r.score_a !== null && r.score_b !== null);

  async function handleShareWhatsApp() {
    if (!stageRounds.some(r => r.team_a?.[0] && r.team_b?.[0])) {
      setError('Fill in at least one court before sharing.');
      return;
    }
    setImageShareError(null);
    setSharingImage(true);
    try {
      // Normally stageImageFile is already rendered ahead of time by the
      // effect above, so sharing is the first await in this handler and
      // still lands inside the click's user-gesture window (see
      // lib/shareImage.ts). If the background pre-render hasn't produced a
      // file yet (still in flight, or it failed silently before the error
      // was surfaced), fall back to rendering right here rather than just
      // refusing — a slightly worse gesture-window risk beats a dead end.
      const file = stageImageFile ?? (imageCaptureRef.current ? await renderElementToImage(imageCaptureRef.current, `stage-${id}.png`) : null);
      if (!file) {
        setImageShareError("Couldn't prepare the image — try again.");
        return;
      }
      const result = await shareCachedImage(file);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      console.error('Stage WhatsApp image share failed:', e);
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    } finally {
      setSharingImage(false);
    }
  }

  // No-Rapid-Fire tournaments have nowhere else that marks the session
  // completed — play/page.tsx's handleFinishTournament only fires if the
  // organizer happens to be on that page when the last round is scored,
  // and this button used to just sit disabled reading "Tournament End"
  // with no action behind it. That's why fully-scored, no-Rapid-Fire
  // tournaments kept showing up as "Unfinished" on the setup screen forever.
  async function handleTournamentEnd() {
    setFinishing(true);
    setError(null);
    try {
      await markSessionCompleted(id);
      router.push(`/session/${id}/team-championship/results`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finish the tournament.');
    } finally {
      setFinishing(false);
    }
  }

  // Ending early from wherever the organizer happens to be — not just
  // /play — since that's the actual reported gap: someone stuck mid-stage
  // had no way to wrap up the tournament without hunting down a different
  // page first. Same action as play/page.tsx's "End Session Early", same
  // warning before it fires (this is a real "lock the rest of the
  // tournament" decision, not a reversible one).
  async function handleEndSessionEarly() {
    setShowEndConfirm(false);
    setEnding(true);
    try {
      await markSessionCompleted(id);
      router.push(`/session/${id}/team-championship/results`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to end the session.');
    } finally {
      setEnding(false);
    }
  }

  const selectStyle = { minHeight: 48, fontSize: 16, padding: '10px 12px', width: '100%', boxSizing: 'border-box' as const };

  return (
    <>
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/team-championship/pairings`} className="text-link-btn">← All Rounds</Link>
        {isAdmin && session.status !== 'completed' && (
          <button className="text-link-btn" style={{ color: 'var(--danger)' }} onClick={() => setShowEndConfirm(true)}>
            End Session Early
          </button>
        )}
      </div>
      <h1>{stage.stageLabel}</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Rounds {stage.roundStart}–{stage.roundEnd} · {stage.pointsPerWin} pt/win · {rosterByTeam[0]?.label} vs {rosterByTeam[1]?.label}
      </p>

      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <button
          className="btn-secondary"
          style={{ minHeight: 44, flex: 1 }}
          disabled={stageIndex <= 1}
          onClick={() => router.push(`/session/${id}/team-championship/stage/${stageIndex - 1}`)}
        >
          ← {stages?.[stageIndex - 2]?.stageLabel ?? 'Prev'}
        </button>
        {stageIndex >= (stages?.length || 0) ? (
          // Last stage — "Next" isn't a dead end, the real flow continues
          // into Rapid Fire (if configured). Real feedback: this button
          // just sat disabled here with nowhere to go, which read as
          // broken rather than "you've reached the end."
          <button
            className="btn-secondary"
            style={{ minHeight: 44, flex: 1 }}
            disabled={session?.rapid_fire_config ? false : !stageFullyScored || finishing}
            onClick={() =>
              session?.rapid_fire_config
                ? router.push(`/session/${id}/team-championship/rapid-fire`)
                : handleTournamentEnd()
            }
          >
            {session?.rapid_fire_config ? 'Rapid Fire →' : finishing ? 'Finishing…' : 'Tournament End'}
          </button>
        ) : (
          <button
            className="btn-secondary"
            style={{ minHeight: 44, flex: 1 }}
            onClick={() => router.push(`/session/${id}/team-championship/stage/${stageIndex + 1}`)}
          >
            {stages?.[stageIndex]?.stageLabel ?? 'Next'} →
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Link href={`/session/${id}/play`} className="btn-primary" style={{ flex: 1, textAlign: 'center' }}>
          Score Matches
        </Link>
        <Link href={`/session/${id}/team-championship/results`} className="btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
          Standings
        </Link>
      </div>

      {stageRounds.length === 0 ? (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isAdmin ? (
            <>
              <p style={{ fontSize: 13, margin: 0 }}>
                No pairings yet for {stage.stageLabel} — generate a balanced starting point and hand-edit it, or start fully blank and enter every pairing yourself.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => handleGenerateStage(stage)}
                  disabled={generating}
                  style={{ minHeight: 48, fontSize: 15 }}
                >
                  {generating ? 'Generating…' : `Generate ${stage.stageLabel} Pairings`}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleStartManualStage(stage)}
                  disabled={generating}
                  style={{ minHeight: 48, fontSize: 15 }}
                >
                  {generating ? 'Starting…' : 'Start Manual Entry (blank)'}
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, margin: 0, color: 'var(--muted)' }}>
              Waiting for a club admin to set up {stage.stageLabel}&apos;s pairings.
            </p>
          )}
        </div>
      ) : (
        <>
          <button
            className="btn-primary"
            style={{ width: '100%', minHeight: 48, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={handleShareWhatsApp}
            disabled={sharingImage}
          >
            <WhatsAppIcon size={20} />
            {sharingImage ? 'Preparing image…' : `Share ${stage.stageLabel} on WhatsApp`}
          </button>
          {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12, marginBottom: 16 }}>{imageShareError}</p>}

          {stageFullyScored && stageIndex < stages.length && (
            <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
              <p style={{ margin: '0 0 10px', fontWeight: 700 }}>✓ {stage.stageLabel} complete — every round scored.</p>
              <Link href={`/session/${id}/team-championship/stage/${stageIndex + 1}`} className="btn-primary" style={{ display: 'inline-block' }}>
                Start {stages?.[stageIndex]?.stageLabel ?? 'Next Stage'} →
              </Link>
            </div>
          )}
        </>
      )}

      {stageRounds.length > 0 && stageRoundNumbers.map(roundNumber => {
        const courtsInRound = stageRounds.filter(r => r.round_number === roundNumber);
        return (
          <div key={roundNumber} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>Round {roundNumber}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {courtsInRound.map(round => {
                const draft = drafts[round.id] ?? [
                  round.team_a?.[0] || '',
                  round.team_a?.[1] || '',
                  round.team_b?.[0] || '',
                  round.team_b?.[1] || ''
                ];
                const isScored = round.score_a !== null && round.score_b !== null;
                const isSaved =
                  !isScored &&
                  draft[0] === (round.team_a?.[0] || '') &&
                  draft[1] === (round.team_a?.[1] || '') &&
                  draft[2] === (round.team_b?.[0] || '') &&
                  draft[3] === (round.team_b?.[1] || '') &&
                  draft.every(name => name !== '');
                return (
                  <div key={round.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)', flexWrap: 'wrap' }}>
                      <span>Court</span>
                      <select
                        value={round.court}
                        onChange={e => handleChangeCourt(round, Number(e.target.value))}
                        disabled={!isAdmin || isScored || changingCourtId === round.id}
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
                        {roundNumber <= 8 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ minHeight: 40, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc', fontWeight: 700, fontSize: 14 }}>
                              {draft[0] || '—'}
                            </div>
                            <div style={{ minHeight: 40, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc', fontWeight: 700, fontSize: 14 }}>
                              {draft[1] || '—'}
                            </div>
                          </div>
                        ) : (
                          [0, 1].map(slot => (
                            <select
                              key={slot}
                              value={draft[slot]}
                              onChange={e => updateDraftSlot(round.id, slot, e.target.value)}
                              disabled={!isAdmin || isScored || (isSaved && editingRoundId !== round.id)}
                              aria-label={`Round ${roundNumber} court ${round.court} ${rosterByTeam[0]?.label} player ${slot + 1}`}
                              style={selectStyle}
                            >
                              <option value="">Select…</option>
                              {(rosterByTeam[0]?.players || []).map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          ))
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{rosterByTeam[1]?.label}</span>
                        {roundNumber <= 8 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ minHeight: 40, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc', fontWeight: 700, fontSize: 14 }}>
                              {draft[2] || '—'}
                            </div>
                            <div style={{ minHeight: 40, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc', fontWeight: 700, fontSize: 14 }}>
                              {draft[3] || '—'}
                            </div>
                          </div>
                        ) : (
                          [2, 3].map(slot => (
                            <select
                              key={slot}
                              value={draft[slot]}
                              onChange={e => updateDraftSlot(round.id, slot, e.target.value)}
                              disabled={!isAdmin || isScored || (isSaved && editingRoundId !== round.id)}
                              aria-label={`Round ${roundNumber} court ${round.court} ${rosterByTeam[1]?.label} player ${slot - 1}`}
                              style={selectStyle}
                            >
                              <option value="">Select…</option>
                              {(rosterByTeam[1]?.players || []).map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          ))
                        )}
                      </div>
                    </div>
                    {isScored && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
                        Scored {round.score_a}-{round.score_b} — locked. Unlock to correct a mistaken pairing/court (this clears the recorded score).
                      </p>
                    )}
                    {isAdmin && (
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
                    )}
                  </div>
                );
              })}
              {courtsInRound.length === 0 && (
                <div className="card">
                  <p style={{ color: 'var(--muted)', margin: 0 }}>No courts set up for round {roundNumber} yet — generate or start manual pairings from the all-rounds view.</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <Link href={`/session/${id}/play`} className="btn-primary" style={{ flex: 1, textAlign: 'center' }}>
          Score Matches
        </Link>
        <Link href={`/session/${id}/team-championship/results`} className="btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
          Standings
        </Link>
      </div>

      {/* Off-screen — captured for the WhatsApp image share, never shown on screen. */}
      <div style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden="true">
        <div ref={imageCaptureRef}>
          <StageImageTemplate session={session} rounds={stageRounds} stage={stage} />
        </div>
      </div>
    </main>
    {showEndConfirm && (
      <ConfirmModal
        title="End this session early?"
        message="Any stage that isn't fully scored stays that way — those rounds won't count toward standings. This unlocks every later stage for viewing but can't be undone."
        confirmLabel={ending ? 'Ending…' : 'End Session'}
        danger
        onConfirm={handleEndSessionEarly}
        onCancel={() => setShowEndConfirm(false)}
      />
    )}
    <SessionNav sessionId={id} format="team_championship" clubId={session.club_id} stageCount={session.stage_config?.length} />
    </>
  );
}

export default function TeamChampionshipStagePage(props: any) {
  return (
    <StageErrorBoundary>
      <TeamChampionshipStagePageContent {...props} />
    </StageErrorBoundary>
  );
}
