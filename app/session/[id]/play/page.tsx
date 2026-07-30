'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper, TrendingDown, Crown, Frown, Egg } from 'lucide-react';
import { getSession, getRounds, updateRoundScore, insertRounds, markSessionCompleted, updateDesignatedScorers, removeLastRound, addRoundRepeatingLast, type RoundRow, type SessionRow } from '@/lib/db';
import { computeRoundTimeRange } from '@/lib/roundTiming';
import { pickCourtScorer, newPlayersOnCourt } from '@/lib/nextMatch';
import {
  regenerateScrambleFromRound,
  regenerateSquadRivalryFromRound,
  regenerateFixedPartnersFromRound,
  regenerateCourtBlocksFromRound,
} from '@/lib/regenerate';
import { resolveChallengesForRound } from '@/lib/challenges';
import { computeCurrentStreaks, maybeSetStreakRecord } from '@/lib/streakRecords';
import { syncLadderChampion } from '@/lib/ladderStandings';
import { recordEloSnapshot } from '@/lib/leagueStats';
import { computeNextKingOfCourtRound } from '@/lib/kingOfCourt';
import SessionNav from '@/components/SessionNav';
import GroupHeader from '@/components/GroupHeader';
import { ChairIcon } from '@/components/icons';
import { formatLabel } from '@/lib/formatLabel';
import { detectUpset } from '@/lib/upset';
import { detectFlightChange } from '@/lib/flightChange';
import { listPlayers } from '@/lib/players';
import { getDisplayNamePref } from '@/lib/displayNamePref';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import ConfirmModal from '@/components/ConfirmModal';
import SquadVersusHero from '@/components/SquadVersusHero';
import SquadStandingsCard from '@/components/SquadStandingsCard';
import { computeSquadTotalsN } from '@/lib/analytics';
import { validateMatchScore } from '@/lib/matchScoring';
import { computeTeamChampionshipStandings, computeTeamMatchRecords } from '@/lib/teamChampionship';
import CourtQrModal from '@/components/CourtQrModal';
import ScorecardReviewModal from '@/components/ScorecardReviewModal';
import { type ScannedMatchResult } from '@/app/api/ai/scan-scorecard/route';

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, [string, string]>>({});
  const [savingCourtId, setSavingCourtId] = useState<string | null>(null);
  const [eloByName, setEloByName] = useState<Map<string, number>>(new Map());
  const [nicknameByName, setNicknameByName] = useState<Map<string, string>>(new Map());
  const [flightChanges, setFlightChanges] = useState<Record<string, RoundMessage[]>>({});
  const [kotcMovement, setKotcMovement] = useState<Record<number, string[]>>({});
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [scanningScorecard, setScanningScorecard] = useState(false);
  const [scannedModalOpen, setScannedModalOpen] = useState(false);
  const [scannedResults, setScannedResults] = useState<ScannedMatchResult[]>([]);

  async function handleScanScorecard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningScorecard(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionRounds', JSON.stringify(rounds));

      const res = await fetch('/api/ai/scan-scorecard', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.scannedResults) {
        setScannedResults(json.scannedResults);
        setScannedModalOpen(true);
      }
    } catch (err) {
      alert('Failed to scan scorecard image.');
    } finally {
      setScanningScorecard(false);
    }
  }

  async function handleConfirmScannedScores(confirmed: { roundNumber: number; court: string; scoreA: number; scoreB: number }[]) {
    for (const item of confirmed) {
      const targetRound = rounds.find(r => r.round_number === item.roundNumber && String(r.court) === String(item.court));
      if (targetRound) {
        await updateRoundScore(targetRound.id, item.scoreA, item.scoreB);
      }
    }
    const updatedRounds = await getRounds(id);
    setRounds(updatedRounds);
  }
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ownPlayerName, setOwnPlayerName] = useState<string | null>(null);
  const [scorerDraft, setScorerDraft] = useState<Set<string>>(new Set());
  const [showScorerPanel, setShowScorerPanel] = useState(false);
  const [savingScorers, setSavingScorers] = useState(false);
  // Team Championship only: captain sees one stage's matches at a time,
  // not all 15 rounds at once — real feedback: "the entire stage scoring
  // should be done in 1 page, after that stage is over, the next page
  // should be a page where scoring is shown and then the next stage
  // begins." Ephemeral (resets on reload) — acknowledging is a nudge, not
  // a gate; a reload just re-shows the interstitial for an already-done
  // stage, which is harmless.
  const [dismissedStages, setDismissedStages] = useState<Set<number>>(new Set());
  const [reviewStageIdx, setReviewStageIdx] = useState<number | null>(null);
  const [roundCountBusy, setRoundCountBusy] = useState(false);
  const [roundCountError, setRoundCountError] = useState<string | null>(null);
  const [showAttendancePanel, setShowAttendancePanel] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  function setScoreError(courtId: string, message: string) {
    setScoreErrors(prev => ({ ...prev, [courtId]: message }));
  }

  function firstIncompleteRound(r: RoundRow[]): number | undefined {
    return [...new Set(r.map(x => x.round_number))]
      .sort((a, b) => a - b)
      .find(rn => r.filter(x => x.round_number === rn).some(x => x.score_a === null));
  }

  async function reload() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
    setScorerDraft(new Set(s?.designated_scorers ?? []));
    if (s) {
      const user = await getCurrentUser();
      setCurrentUserId(user?.id ?? null);
      if (user) setIsAdmin(await isCurrentUserAdmin(s.club_id));
    }
  }

  useEffect(() => {
    reload();
  }, [id]);

  async function handleEndSessionEarly() {
    setShowEndConfirm(false);
    setEnding(true);
    try {
      await markSessionCompleted(id);
      router.push(session?.format === 'team_championship' ? `/session/${id}/team-championship/results` : `/session/${id}/results`);
    } finally {
      setEnding(false);
    }
  }

  async function handleRemoveLastRound() {
    setRoundCountError(null);
    setRoundCountBusy(true);
    try {
      await removeLastRound(id);
    } catch (err) {
      // removeLastRound can partially succeed (rows deleted, round_count
      // update fails) — always reload from the DB before the user can
      // retry, or a retry would recompute "last round" from the new
      // actual state and remove a SECOND round on top of the first.
      console.error(err);
      setRoundCountError(err instanceof Error ? err.message : 'Could not remove that round — reloading to show the current state.');
    } finally {
      await reload();
      setRoundCountBusy(false);
    }
  }

  async function handleAddRound() {
    setRoundCountError(null);
    setRoundCountBusy(true);
    try {
      await addRoundRepeatingLast(id);
    } catch (err) {
      // Same reasoning as handleRemoveLastRound: always reload so a retry
      // can't add a second round on top of a partially-succeeded first one.
      console.error(err);
      setRoundCountError(err instanceof Error ? err.message : 'Could not add a round — reloading to show the current state.');
    } finally {
      await reload();
      setRoundCountBusy(false);
    }
  }

  // Item 3 (regeneration) is only built for these 4 formats — this toggle
  // is only reachable for them for exactly that reason (per §2/§9 of the
  // plan: don't ship a control that silently does nothing). King of the
  // Court has no bench mechanism to regenerate against (see regenerate.ts's
  // header comment); Team Championship is out of scope for the whole plan.
  const REGENERATE_BY_FORMAT: Record<string, (sessionId: string, nextAbsent: string[]) => Promise<void>> = {
    scramble: regenerateScrambleFromRound,
    squad_rivalry: regenerateSquadRivalryFromRound,
    fixed_partners: regenerateFixedPartnersFromRound,
    court_blocks: regenerateCourtBlocksFromRound,
  };

  async function handleToggleAttendance(name: string, currentlyAbsent: boolean) {
    if (!session || attendanceBusy !== null) return;
    const regenerate = REGENERATE_BY_FORMAT[session.format];
    if (!regenerate) return;
    setAttendanceError(null);
    setAttendanceBusy(name);
    try {
      const nextAbsent = currentlyAbsent
        ? session.absent_players.filter(p => p !== name)
        : [...session.absent_players, name];
      // Attendance flag + schedule regeneration land as one atomic DB
      // commit (see regenerate_session_rounds migration) — no window
      // where the roster flag and the actual schedule can disagree.
      await regenerate(id, nextAbsent);
    } catch (err) {
      console.error(err);
      setAttendanceError(err instanceof Error ? err.message : 'Could not update attendance — reloading to show the current state.');
    } finally {
      await reload();
      setAttendanceBusy(null);
    }
  }

  // Scoped to the session's own club, not whatever club is "currently
  // active" in the switcher — a session's data always belongs to the club
  // it was created in, regardless of what the user has selected elsewhere.
  useEffect(() => {
    if (!session) return;
    listPlayers(session.club_id)
      .then(players => {
        setEloByName(new Map(players.map(p => [p.name, p.elo_rating])));
        setNicknameByName(new Map(players.filter(p => p.nickname).map(p => [p.name, p.nickname as string])));
        setOwnPlayerName(players.find(p => p.user_id === currentUserId)?.name ?? null);
      })
      .catch(() => setEloByName(new Map()));
  }, [session?.club_id, currentUserId]);

  async function handleSaveScorers() {
    setSavingScorers(true);
    try {
      await updateDesignatedScorers(id, [...scorerDraft]);
      setSession(prev => (prev ? { ...prev, designated_scorers: scorerDraft.size > 0 ? [...scorerDraft] : null } : prev));
      setShowScorerPanel(false);
    } finally {
      setSavingScorers(false);
    }
  }

  // Today's default (empty designated_scorers) keeps the existing behavior
  // — anyone signed in with session access can score. Once an admin picks
  // specific names, scoring narrows to just them (plus admins, who can
  // always fix a mis-entered score regardless of the list).
  const canScore =
    isAdmin ||
    !session?.designated_scorers?.length ||
    (ownPlayerName !== null &&
      session.designated_scorers.some(s => {
        const sNorm = s.trim().toLowerCase();
        const ownNorm = ownPlayerName.trim().toLowerCase();
        const sFirst = sNorm.split(' ')[0];
        const ownFirst = ownNorm.split(' ')[0];
        return sNorm === ownNorm || sFirst === ownFirst || sNorm === ownFirst || sFirst === ownNorm;
      }));

  // On-court display name — the full registered name (often first + last)
  // overflows the score box, and nobody needs the surname mid-match.
  function displayName(fullName: string): string {
    const firstName = fullName.split(' ')[0];
    if (getDisplayNamePref() === 'firstName') return firstName;
    return nicknameByName.get(fullName) ?? firstName;
  }

  type RoundMessage = { kind: 'promoted' | 'relegated' | 'record-win' | 'record-loss'; text: string };
  const MESSAGE_ICONS = { promoted: PartyPopper, relegated: TrendingDown, 'record-win': Crown, 'record-loss': Frown } as const;

  // Flight-mismatch upset badge — only shown when all 4 players are
  // registered (unrated players would make the flight comparison meaningless).
  function upsetLabel(court: RoundRow): string | null {
    if (court.score_a === null || court.score_b === null) return null;
    const [a1, a2] = court.team_a;
    const [b1, b2] = court.team_b;
    const ratings = [a1, a2, b1, b2].map(n => eloByName.get(n));
    if (ratings.some(r => r === undefined)) return null;
    const [ra1, ra2, rb1, rb2] = ratings as number[];
    const aWon = court.score_a > court.score_b;
    const upset = aWon ? detectUpset([ra1, ra2], [rb1, rb2]) : detectUpset([rb1, rb2], [ra1, ra2]);
    return upset ? `${upset.winnerFlight} slays ${upset.loserFlight}` : null;
  }

  const roundNumbers = [...new Set(rounds.map(r => r.round_number))].sort((a, b) => a - b);
  const currentRoundNumber = firstIncompleteRound(rounds);

  const tcStages = session?.format === 'team_championship' ? session.stage_config ?? [] : [];
  // Real bug: pairings are now generated lazily, per stage (see
  // team-championship/stage/[stageIndex]/page.tsx) — a later stage can
  // have ZERO rows in `rounds` until its own page generates them. The old
  // "first stage with an unscored round" check treated an ungenerated
  // stage as vacuously finished (no rows = nothing unscored), skipped
  // straight past it, and landed on whichever stage happened to be last —
  // which is exactly why Stage 1 finishing jumped straight to Rapid Fire
  // instead of Stage 2. A stage with no rows yet must count as NOT
  // finished, same as one with unscored rows.
  const currentStageIdx =
    tcStages.length === 0
      ? -1
      : (() => {
          const firstUnfinished = tcStages.findIndex(s => {
            const stageRoundNumbers = Array.from({ length: s.roundEnd - s.roundStart + 1 }, (_, i) => s.roundStart + i);
            const stageRows = rounds.filter(r => r.round_number >= s.roundStart && r.round_number <= s.roundEnd);
            return stageRows.length < stageRoundNumbers.length * (session?.court_labels.length || 1) || stageRows.some(r => r.score_a === null);
          });
          return firstUnfinished === -1 ? tcStages.length - 1 : firstUnfinished;
        })();
  const currentStage = currentStageIdx >= 0 ? tcStages[currentStageIdx] : null;
  const currentStageRounds = currentStage
    ? rounds.filter(r => r.round_number >= currentStage.roundStart && r.round_number <= currentStage.roundEnd)
    : [];
  const currentStageNotGenerated = !!currentStage && currentStageRounds.length === 0;
  const currentStageFullyScored = currentStage && currentStageRounds.length > 0 && currentStageRounds.every(r => r.score_a !== null);
  const showStageComplete = !!currentStage && !!currentStageFullyScored && !dismissedStages.has(currentStageIdx);
  const isLastStage = currentStageIdx === tcStages.length - 1;

  // "No back button to check if scoring was done correctly" — real gap:
  // once the active stage moves on, its rounds vanished from this page
  // entirely (visibleRoundNumbers was scoped to ONLY the current stage),
  // so a mis-entered score in an earlier stage had nowhere left to be
  // fixed from here. reviewStageIdx lets the captain step back into any
  // already-reached stage's rounds — still the same editable cards, this
  // doesn't add new UI, just un-hides what was always meant to be
  // reachable. null means "not reviewing, show the active stage."
  const displayStageIdx = reviewStageIdx ?? currentStageIdx;
  const displayStage = displayStageIdx >= 0 ? tcStages[displayStageIdx] : null;
  const isReviewing = reviewStageIdx !== null;

  // Non-team-championship formats keep seeing every round on one page,
  // unchanged. Team Championship shows only the displayed stage's rounds
  // — hidden entirely once acknowledged-complete (unless reviewing),
  // revealed for the next stage instead of accumulating all 15 rounds on
  // one endless scroll.
  const visibleRoundNumbers =
    tcStages.length === 0
      ? roundNumbers
      : showStageComplete && !isReviewing
      ? []
      : roundNumbers.filter(rn => rn >= (displayStage?.roundStart ?? 0) && rn <= (displayStage?.roundEnd ?? 0));

  function draftFor(court: RoundRow): [string, string] {
    return drafts[court.id] ?? [court.score_a?.toString() ?? '', court.score_b?.toString() ?? ''];
  }

  // Scores cap at 99 — 3+ digits is always a mis-tap, not a real pickleball score.
  function clampScore(raw: string): string {
    if (raw === '') return raw;
    const n = Number(raw);
    if (Number.isNaN(n)) return raw;
    return String(Math.min(99, Math.max(0, n)));
  }

  async function saveScore(court: RoundRow, a: string, b: string) {
    if (a === '' || b === '' || !session) return;
    if (!canScore) {
      setScoreError(court.id, 'Only the players assigned to score this session (or an admin) can enter results.');
      return;
    }
    if (Number(a) === Number(b)) {
      setScoreError(court.id, "Pickleball games can't end in a tie — check the score.");
      return;
    }
    // Team Championship's match-ending rule is chosen once at setup (see
    // lib/matchScoring.ts) — one of 3 real tournament conventions, not the
    // single hardcoded "always to 15" rule this used to be. Scoped to
    // team_championship only: other formats play to different targets and
    // must not be constrained here.
    if (session.format === 'team_championship') {
      const rule = session.match_scoring_rule ?? 'golden_14';
      const result = validateMatchScore(Number(a), Number(b), rule);
      if (!result.valid) {
        setScoreError(court.id, result.error ?? 'Invalid score for this tournament\'s match-ending rule.');
        return;
      }
    }
    setSavingCourtId(court.id);
    const beforeElo = eloByName;
    await updateRoundScore(court.id, Number(a), Number(b));
    resolveChallengesForRound(session.club_id, court.team_a, court.team_b, Number(a) > Number(b)).catch(err =>
      console.error('Failed to resolve challenges for round:', err)
    );
    const [updatedRounds, players] = await Promise.all([getRounds(id), listPlayers(session.club_id)]);
    setRounds(updatedRounds);
    // Refreshed after every save, not just once on page load — otherwise
    // both this and the upset badge below would compare against
    // increasingly stale ratings across a multi-round session.
    const freshElo = new Map(players.map(p => [p.name, p.elo_rating]));
    setEloByName(freshElo);

    const participants = [...court.team_a, ...court.team_b];
    for (const name of participants) {
      const rating = freshElo.get(name);
      if (rating !== undefined) recordEloSnapshot(session.club_id, name, rating).catch(err => console.error('Failed to record elo snapshot:', err));
    }
    const messages: RoundMessage[] = [];
    for (const name of participants) {
      const before = beforeElo.get(name);
      const after = freshElo.get(name);
      if (before === undefined || after === undefined) continue;
      const change = detectFlightChange(before, after);
      if (change) {
        messages.push(
          change.direction === 'promoted'
            ? { kind: 'promoted', text: `${name} promoted to ${change.flight}!` }
            : { kind: 'relegated', text: `${name} relegated to ${change.flight}` }
        );
      }
    }
    try {
      const streaks = await computeCurrentStreaks(session.club_id);
      for (const name of participants) {
        const streak = streaks.get(name);
        if (!streak) continue;
        const broken = await maybeSetStreakRecord(session.club_id, streak.type, name, streak.length);
        if (broken) {
          messages.push(
            broken.streakType === 'win'
              ? { kind: 'record-win', text: `NEW CLUB RECORD! ${name} just set a ${broken.recordLength}-game win streak.` }
              : { kind: 'record-loss', text: `${name} just set the club's longest losing streak (${broken.recordLength}).` }
          );
        }
      }
    } catch (err) {
      console.error('Failed to check streak records:', err);
    }

    // Rung movement itself is owned by the apply_ladder_after_score Postgres
    // trigger (fires on the updateRoundScore() UPDATE above, same
    // transaction) — this just picks up whatever it did to crown the
    // Ladder Champion badge holder. See lib/ladderStandings.ts for why this
    // isn't duplicated client-side.
    if (session.is_ladder) {
      syncLadderChampion(session.club_id).catch(err => console.error('Failed to sync ladder champion badge:', err));
    }

    if (messages.length > 0) setFlightChanges(prev => ({ ...prev, [court.id]: messages }));

    // King of the Court only ever has the rounds played so far in the DB —
    // round N+1 doesn't exist until round N is fully scored, so the generic
    // firstIncompleteRound() check below (which would see "no incomplete
    // rounds exist yet" and wrongly mark the session complete after round 1)
    // doesn't apply here. Generate the next round live instead, or complete
    // the session once round_count is reached.
    if (session?.format === 'king_of_court') {
      const roundJustCompleted = updatedRounds
        .filter(r => r.round_number === court.round_number)
        .every(c => c.score_a !== null && c.score_b !== null);
      if (roundJustCompleted) {
        if (court.round_number < session.round_count) {
          const scoredCourts = updatedRounds
            .filter(r => r.round_number === court.round_number)
            .sort((x, y) => x.court - y.court)
            .map(r => ({ court: r.court, teamA: r.team_a, teamB: r.team_b, scoreA: r.score_a as number, scoreB: r.score_b as number }));
          const labels = session.court_labels;
          const winnerOf = (c: (typeof scoredCourts)[number]) => (c.scoreA > c.scoreB ? c.teamA : c.teamB);
          const loserOf = (c: (typeof scoredCourts)[number]) => (c.scoreA > c.scoreB ? c.teamB : c.teamA);
          const movement: string[] = [];
          if (scoredCourts.length > 1) {
            movement.push(`Defending Court ${labels[0]}: ${winnerOf(scoredCourts[0]).join(' & ')}`);
            for (let i = 0; i < scoredCourts.length - 1; i++) {
              movement.push(`Moving up to Court ${labels[i]}: ${winnerOf(scoredCourts[i + 1]).join(' & ')}`);
              movement.push(`Moving down to Court ${labels[i + 1]}: ${loserOf(scoredCourts[i]).join(' & ')}`);
            }
          }
          setKotcMovement(prev => ({ ...prev, [court.round_number]: movement }));

          const nextCourts = computeNextKingOfCourtRound(
            scoredCourts,
            session.king_of_court_fixed_pairs ?? true,
            `${id}-r${court.round_number + 1}`
          );
          await insertRounds(id, [{ roundNumber: court.round_number + 1, courts: nextCourts, sittingOutPerCourt: nextCourts.map(() => []) }]);
          setRounds(await getRounds(id));
        } else {
          await markSessionCompleted(id);
          setTimeout(() => router.push(`/session/${id}/results`), 1800);
        }
      }
      setSavingCourtId(null);
      return;
    }

    setSavingCourtId(null);
    // Team Championship: no auto-navigation at all here — real feedback,
    // moving on has to be a deliberate click, not something that happens
    // "as soon as scores are done." The stage-complete interstitial
    // (rendered from state below) handles every transition, including the
    // final one, via handleFinishTournament.
    if (session?.format === 'team_championship') return;
    if (firstIncompleteRound(updatedRounds) === undefined) {
      await markSessionCompleted(id);
      setTimeout(() => router.push(`/session/${id}/results`), 1800);
    }
  }

  const [finishing, setFinishing] = useState(false);

  // Team Championship's manual "wrap up" step — was an automatic
  // setTimeout redirect that fired the instant the last round was scored,
  // with no confirmation. Rapid Fire (if configured) still defers
  // markSessionCompleted to its own page once it actually resolves — see
  // rapid-fire/page.tsx — this only marks complete for the no-Rapid-Fire
  // case.
  async function handleFinishTournament() {
    if (!session) return;
    setFinishing(true);
    try {
      if (session.rapid_fire_config) {
        router.push(`/session/${id}/team-championship/rapid-fire`);
        return;
      }
      await markSessionCompleted(id);
      router.push(`/session/${id}/team-championship/results`);
    } finally {
      setFinishing(false);
    }
  }

  async function handleSaveCourt(court: RoundRow) {
    const [a, b] = draftFor(court);
    await saveScore(court, a, b);
  }

  return (
    <>
      <main className="page">
        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        {session && session.format === 'squad_rivalry' && session.squads && session.squads.length === 2 && (
          <SquadVersusHero
            goldLabel={session.squads[0].label || 'Gold'}
            blackLabel={session.squads[1].label || 'Black'}
            goldLogoUrl={session.squads[0].logoUrl ?? null}
            blackLogoUrl={session.squads[1].logoUrl ?? null}
            goldScore={computeSquadTotalsN(rounds, session.squads).get(session.squads[0].id) ?? 0}
            blackScore={computeSquadTotalsN(rounds, session.squads).get(session.squads[1].id) ?? 0}
          />
        )}
        {session && session.format === 'squad_rivalry' && session.squads && session.squads.length > 2 && (
          <SquadStandingsCard squads={session.squads} totalsByTeam={computeSquadTotalsN(rounds, session.squads)} />
        )}
        {session && session.format === 'team_championship' && session.squads && session.squads.length === 2 && session.stage_config && (
          <>
            <SquadVersusHero
              goldLabel={session.squads[0].label || 'Team 1'}
              blackLabel={session.squads[1].label || 'Team 2'}
              goldLogoUrl={session.squads[0].logoUrl ?? null}
              blackLogoUrl={session.squads[1].logoUrl ?? null}
              goldScore={computeTeamChampionshipStandings(rounds, session.squads, session.stage_config).totalsByTeam.get(session.squads[0].id) ?? 0}
              blackScore={computeTeamChampionshipStandings(rounds, session.squads, session.stage_config).totalsByTeam.get(session.squads[1].id) ?? 0}
            />
            <p style={{ textAlign: 'center', fontSize: 12, marginTop: -8, marginBottom: 8 }}>
              <a href={`/session/${id}/team-championship/results`}>View full stage-by-stage standings →</a>
            </p>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Live Scoring</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              📷 {scanningScorecard ? 'Scanning Photo...' : 'Scan Scorecard Photo'}
              <input type="file" accept="image/*,application/pdf" onChange={handleScanScorecard} style={{ display: 'none' }} disabled={scanningScorecard} />
            </label>
            <CourtQrModal sessionId={id} courtLabel={session?.court_labels[0] || '1'} />
          </div>
        </div>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          {displayStage
            ? `${displayStage.stageLabel} — Rounds ${displayStage.roundStart}–${displayStage.roundEnd} · ${displayStage.pointsPerWin} pt/win`
            : `Round ${currentRoundNumber ?? session?.round_count ?? '—'} of ${session?.round_count ?? '…'}`}
          {' '}— tap a score box to enter, it saves automatically
        </p>
        {session && session.format !== 'team_championship' && session.start_time && session.round_duration_minutes && (() => {
          const finishRange = computeRoundTimeRange(session.start_time, session.round_duration_minutes, session.round_count);
          const finishClock = finishRange?.split('–')[1];
          return finishClock ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8, marginBottom: 8 }}>
              Projected finish: {finishClock} ({session.round_count} round{session.round_count === 1 ? '' : 's'} × {session.round_duration_minutes} min from {session.start_time})
            </p>
          ) : null;
        })()}

        {tcStages.length > 0 && currentStageIdx > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>Review:</span>
            {tcStages.slice(0, currentStageIdx + 1).map((s, i) => (
              <button
                key={s.stageLabel}
                type="button"
                className={displayStageIdx === i ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setReviewStageIdx(i === currentStageIdx ? null : i)}
              >
                {s.stageLabel}
              </button>
            ))}
          </div>
        )}
        {isReviewing && (
          <p style={{ fontSize: 12, color: 'var(--warning, #b45309)', fontWeight: 700, marginBottom: 12 }}>
            Reviewing a completed stage — scores here are still editable if something was entered wrong.
          </p>
        )}

        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {currentRoundNumber !== undefined && (
              <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowEndConfirm(true)} disabled={ending}>
                {ending ? 'Ending…' : 'End Session Early'}
              </button>
            )}
            <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowScorerPanel(v => !v)}>
              {session?.designated_scorers?.length ? `Scorers (${session.designated_scorers.length})` : 'Assign Scorers'}
            </button>
            {session && session.format in REGENERATE_BY_FORMAT && (
              <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowAttendancePanel(v => !v)}>
                {session.absent_players.length > 0 ? `Attendance (${session.absent_players.length} absent)` : 'Attendance'}
              </button>
            )}
            {session &&
              session.format !== 'team_championship' &&
              session.format !== 'king_of_court' &&
              session.format !== 'court_blocks' /* one-round add/remove would break block alignment */ && (
              <>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 13 }}
                  onClick={handleAddRound}
                  disabled={roundCountBusy}
                >
                  {roundCountBusy ? 'Working…' : '+ Add a Round'}
                </button>
                {session.round_count > 0 &&
                  !rounds.some(r => r.round_number === session.round_count && (r.score_a !== null || r.score_b !== null)) && (
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 13 }}
                      onClick={handleRemoveLastRound}
                      disabled={roundCountBusy}
                    >
                      {roundCountBusy ? 'Working…' : '− Remove Last Round'}
                    </button>
                  )}
              </>
            )}
          </div>
        )}
        {roundCountError && (
          <p style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginTop: -8, marginBottom: 12 }}>{roundCountError}</p>
        )}

        {showScorerPanel && session && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>Who can log scores?</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
              Leave everyone unchecked to let any signed-in club member with access to this session score matches (today's default).
              Check one or more names to lock scoring down to just them (plus admins).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
              {session.players.map(name => (
                <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={scorerDraft.has(name)}
                    onChange={e =>
                      setScorerDraft(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(name);
                        else next.delete(name);
                        return next;
                      })
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveScorers} disabled={savingScorers}>
                {savingScorers ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowScorerPanel(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showAttendancePanel && session && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>Who&apos;s here right now?</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
              Untick someone if they&apos;re not here — the schedule for rounds that haven&apos;t started yet updates right away.
              Rounds already played or on court now are never touched.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
              {session.players.map(name => {
                const isAbsent = session.absent_players.includes(name);
                return (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={!isAbsent}
                      disabled={attendanceBusy !== null}
                      onChange={() => handleToggleAttendance(name, isAbsent)}
                    />
                    {name}
                    {attendanceBusy === name && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Updating…</span>}
                  </label>
                );
              })}
            </div>
            {attendanceError && (
              <p style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{attendanceError}</p>
            )}
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowAttendancePanel(false)}>
              Close
            </button>
          </div>
        )}

        {!canScore && (
          <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, marginBottom: 12 }}>
            Scoring for this session is limited to specific players — you&apos;re not on that list, so entries here won&apos;t save.
          </p>
        )}

        {showEndConfirm && (
          <ConfirmModal
            title="End session early?"
            message="Rounds that haven't been scored yet stay unscored — everything played so far still counts toward stats, badges, and streaks. This isn't the same as Void Session, which erases a session's results entirely."
            confirmLabel="End Session"
            onConfirm={handleEndSessionEarly}
            onCancel={() => setShowEndConfirm(false)}
          />
        )}

        {showStageComplete && currentStage && !isReviewing && (
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <p style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px', textAlign: 'center' }}>✓ {currentStage.stageLabel} complete</p>
            {session?.format === 'team_championship' && session.squads && (
              (() => {
                const stageTotals = computeTeamChampionshipStandings(rounds, session.squads, tcStages).stageBreakdown.find(
                  s => s.stageLabel === currentStage.stageLabel
                );
                const grandTotals = computeTeamChampionshipStandings(rounds, session.squads, tcStages).totalsByTeam;
                const stageRecords = computeTeamMatchRecords(currentStageRounds, session.squads, [currentStage]);
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Team</th>
                          <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Record</th>
                          <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>{currentStage.stageLabel} Pts</th>
                          <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Total Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.squads!.map(t => {
                          const record = stageRecords.get(t.id) ?? { wins: 0, losses: 0 };
                          return (
                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 6px', fontWeight: 800 }}>{t.label ?? t.id}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'right' }}>{record.wins}W – {record.losses}L</td>
                              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>{stageTotals?.totalsByTeam.get(t.id) ?? 0}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 900, fontSize: 16 }}>{grandTotals.get(t.id) ?? 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
            <div style={{ textAlign: 'center' }}>
              {isLastStage ? (
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleFinishTournament} disabled={finishing}>
                  {finishing ? 'Finishing…' : session?.rapid_fire_config ? 'Continue to Rapid Fire →' : 'View Final Results →'}
                </button>
              ) : (
                <button
                  className="btn-primary"
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setDismissedStages(prev => new Set(prev).add(currentStageIdx));
                    // Real flow: results here, THEN the next stage's teams
                    // get set (pairings), THEN its scoring — not straight
                    // back into more score boxes on this same page.
                    router.push(`/session/${id}/team-championship/stage/${currentStageIdx + 2}`);
                  }}
                >
                  Continue to {tcStages[currentStageIdx + 1]?.stageLabel} →
                </button>
              )}
            </div>
          </div>
        )}

        {currentStageNotGenerated && currentStage && !isReviewing && (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ margin: '0 0 12px' }}>{currentStage.stageLabel}&apos;s pairings haven&apos;t been set yet.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => router.push(`/session/${id}/team-championship/stage/${currentStageIdx + 1}`)}>
                Set Up {currentStage.stageLabel} →
              </button>
              <button className="btn-secondary" onClick={() => router.push(`/session/${id}/team-championship/results`)}>
                Standings
              </button>
            </div>
          </div>
        )}

        {visibleRoundNumbers.map(roundNumber => {
          const courts = rounds.filter(r => r.round_number === roundNumber).sort((a, b) => a.court - b.court);
          const isDone = courts.every(c => c.score_a !== null && c.score_b !== null);
          const isCurrent = roundNumber === currentRoundNumber;
          const sameSitOut =
            courts.length === 2 &&
            JSON.stringify([...courts[0].sitting_out].sort()) === JSON.stringify([...courts[1].sitting_out].sort());

          const tcStage =
            session?.format === 'team_championship' && session.stage_config
              ? session.stage_config.find(s => roundNumber >= s.roundStart && roundNumber <= s.roundEnd)
              : null;

          return (
            <div key={roundNumber} className={`round-card ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}>
              <div className="round-card-header">
                <span className="round-label">
                  Round {roundNumber}
                  {tcStage && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}> · {tcStage.stageLabel} · {tcStage.pointsPerWin} pt/win</span>}
                </span>
                <span className={`round-status-badge ${isDone ? '' : 'pending'}`}>
                  {isDone ? 'Done' : 'Pending'}
                </span>
              </div>

              {session?.format === 'king_of_court' && isDone && (kotcMovement[roundNumber] ?? []).length > 0 && (
                <div className="resting-badge" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 12 }}>Next round movement</strong>
                  {kotcMovement[roundNumber].map(m => (
                    <span key={m} style={{ fontSize: 12 }}>{m}</span>
                  ))}
                </div>
              )}

              {courts.map(court => {
                const [scoreA, scoreB] = draftFor(court);
                const aWins = court.score_a !== null && court.score_b !== null && court.score_a > court.score_b;
                const bWins = court.score_a !== null && court.score_b !== null && court.score_b > court.score_a;
                return (
                  <div key={court.id} className="match-box" style={scoreErrors[court.id] ? { outline: '2px solid var(--danger)', outlineOffset: 2 } : undefined}>
                    <span className="court-label-big">COURT {session?.court_labels?.[court.court - 1] ?? court.court}</span>
                    <div className="match-teams-row">
                      <div className={`team-box ${aWins ? 'winner' : ''}`}>
                        <div className="team-names">{court.team_a.map(displayName).join(' & ')}</div>
                        <input
                          className="score-input"
                          type="number"
                          inputMode="numeric"
                          max={99}
                          aria-label={`${court.team_a.join(' & ')} score, court ${court.court}, round ${roundNumber}`}
                          aria-invalid={!!scoreErrors[court.id]}
                          value={scoreA}
                          style={scoreErrors[court.id] ? { borderColor: 'var(--danger)', borderWidth: 2 } : undefined}
                          onChange={e => {
                            setDrafts(prev => ({ ...prev, [court.id]: [clampScore(e.target.value), draftFor(court)[1]] }));
                            setScoreErrors(prev => ({ ...prev, [court.id]: '' }));
                          }}
                          onBlur={() => handleSaveCourt(court)}
                        />
                      </div>
                      <span className="vs-pill">VS</span>
                      <div className={`team-box ${bWins ? 'winner' : ''}`}>
                        <div className="team-names">{court.team_b.map(displayName).join(' & ')}</div>
                        <input
                          className="score-input"
                          type="number"
                          inputMode="numeric"
                          max={99}
                          aria-label={`${court.team_b.join(' & ')} score, court ${court.court}, round ${roundNumber}`}
                          aria-invalid={!!scoreErrors[court.id]}
                          value={scoreB}
                          style={scoreErrors[court.id] ? { borderColor: 'var(--danger)', borderWidth: 2 } : undefined}
                          onChange={e => {
                            setDrafts(prev => ({ ...prev, [court.id]: [draftFor(court)[0], clampScore(e.target.value)] }));
                            setScoreErrors(prev => ({ ...prev, [court.id]: '' }));
                          }}
                          onBlur={() => handleSaveCourt(court)}
                        />
                      </div>
                      {savingCourtId === court.id && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Saving…</span>}
                    </div>
                    {scoreErrors[court.id] && (
                      <p style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{scoreErrors[court.id]}</p>
                    )}
                    {upsetLabel(court) && (
                      <div className="resting-badge">
                        <Egg size={14} /> {upsetLabel(court)}
                      </div>
                    )}
                    {(flightChanges[court.id] ?? []).map(msg => {
                      const MsgIcon = MESSAGE_ICONS[msg.kind];
                      return (
                        <div key={msg.text} className="resting-badge">
                          <MsgIcon size={14} /> {msg.text}
                        </div>
                      );
                    })}
                    {!sameSitOut && court.sitting_out.length > 0 && (
                      <div className="resting-badge">
                        <span className="stat-icon"><ChairIcon size={20} /></span>
                        Resting: {court.sitting_out.join(', ')}
                      </div>
                    )}
                    {session &&
                      session.format !== 'team_championship' &&
                      session.format !== 'king_of_court' &&
                      roundNumber === currentRoundNumber &&
                      court.score_a !== null &&
                      court.score_b !== null &&
                      (() => {
                        const allCourtsDone = courts.every(c => c.score_a !== null && c.score_b !== null);
                        if (!allCourtsDone) {
                          const pending = courts.filter(c => c.score_a === null || c.score_b === null);
                          return (
                            <div className="resting-badge" style={{ fontSize: 13 }}>
                              Waiting on Court {pending.map(c => session.court_labels?.[c.court - 1] ?? c.court).join(', ')}…
                            </div>
                          );
                        }
                        const nextRound = rounds.find(r => r.round_number === roundNumber + 1 && r.court === court.court);
                        if (!nextRound) return null;
                        const scorer = pickCourtScorer(nextRound.team_a, nextRound.team_b, roundNumber + 1, session.designated_scorers);
                        const newPlayers = newPlayersOnCourt(
                          [...nextRound.team_a, ...nextRound.team_b],
                          roundNumber === 1 ? null : [...court.team_a, ...court.team_b]
                        );
                        return (
                          <div className="card" style={{ marginTop: 8, padding: 12 }}>
                            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px', fontWeight: 700 }}>
                              NEXT ON THIS COURT · {displayName(scorer)} scores
                            </p>
                            <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>
                              {nextRound.team_a.map(p => `${displayName(p)}${newPlayers.has(p) ? ' ← joins' : ''}`).join(' + ')}
                            </p>
                            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 0' }}>vs</p>
                            <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                              {nextRound.team_b.map(p => `${displayName(p)}${newPlayers.has(p) ? ' ← joins' : ''}`).join(' + ')}
                            </p>
                            {nextRound.sitting_out.length > 0 && (
                              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                                Sitting out: {nextRound.sitting_out.map(displayName).join(', ')}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                );
              })}

              {sameSitOut && courts[0]?.sitting_out.length > 0 && (
                <div className="resting-badge">
                  <span className="stat-icon"><ChairIcon size={20} /></span>
                  Resting: {courts[0].sitting_out.join(', ')}
                </div>
              )}
              {session && (
                <div className="meta-bar">
                  <span>ROUND {roundNumber}</span>
                  <span>COURT {session.court_labels.join('/')}</span>
                  <span>
                    {session.round_duration_minutes
                      ? `${session.round_duration_minutes} MIN`
                      : new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
                  </span>
                  <span>{formatLabel(session.format).toUpperCase()}</span>
                </div>
              )}
            </div>
          );
        })}
        <ScorecardReviewModal
          isOpen={scannedModalOpen}
          onClose={() => setScannedModalOpen(false)}
          scannedResults={scannedResults}
          onConfirm={handleConfirmScannedScores}
        />
      </main>
      <SessionNav sessionId={id} format={session?.format} clubId={session?.club_id} />
    </>
  );
}
