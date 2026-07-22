'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, RotateCcw, Camera, Flame, ListOrdered, Scale, Lock } from 'lucide-react';
import {
  generateScrambleSchedule,
  generateSquadRivalrySchedule,
  generateCourtBlocksSchedule,
  generateFixedPartnersSchedule,
  buildRivalryHeatMap,
  type CourtBlockAssignment,
  type LockedPair,
  type Squads,
} from '@/lib/shuffle';
import { generateInitialKingOfCourtRound } from '@/lib/kingOfCourt';
import { generateSquadRivalryScheduleN, squadIdFor, type SquadSet } from '@/lib/squads';
import type { StageConfig } from '@/lib/teamChampionship';
import { createSession, insertRounds, uploadPlayerPhoto, uploadSquadLogo, getMostRecentSession } from '@/lib/db';
import { saveRoster, loadRoster } from '@/lib/savedRoster';
import { getPlayerPhoto, savePlayerPhoto, preloadPlayerPhotos } from '@/lib/playerPhotos';
import { listPlayers, getSkillRatingsForNames, getOwnPlayer, type PlayerRow } from '@/lib/players';
import { createSessionDues } from '@/lib/dues';
import { getCurrentUser } from '@/lib/auth';
import { fetchRivalriesForPlayer, fetchRivalriesAmongRoster, fetchStreaks, type Rivalry } from '@/lib/leagueStats';
import { buildStorylines } from '@/lib/storylines';
import { polishStorylines } from '@/lib/storylinesLLM';
import { useCurrentClub } from '@/lib/useCurrentClub';
import StatusChip from '@/components/StatusChip';
import SignInGate from '@/components/SignInGate';
import InfoModal from '@/components/InfoModal';
import { displayName } from '@/lib/displayNamePref';

const MIN_GAMES_FOR_NEMESIS_ALERT = 3;
const SQUAD_CHIP_COLORS = ['#d4af37', '#1a1a1a', '#2563eb', '#dc2626', '#059669', '#7c3aed'];

type Format = 'scramble' | 'squad_rivalry' | 'court_blocks' | 'fixed_partners' | 'king_of_court' | 'team_championship';

const FORMAT_INFO: Record<Format, { label: string; summary: string; example: string }> = {
  scramble: {
    label: 'Scramble — random partners every round',
    summary: 'Every round, the app reshuffles who partners with whom and which court they play on. Over the night, it balances things so everyone partners with different people roughly equally, and everyone sits out roughly the same number of times.',
    example: 'Example: Round 1 you play with Alice against Bob & Carl. Round 2 you might play with Dave against Eve & Alice. Nobody has a fixed partner — it changes every round.',
  },
  squad_rivalry: {
    label: 'Squad Rivalry — 2 fixed squads all night',
    summary: 'At the start, players are split into 2 squads (Gold vs Black) for the whole session. Every round is Gold vs Black — your partner rotates within your own squad, but you always face the other squad. A running squad score tracks who\'s winning overall.',
    example: 'Example: You\'re on Gold. Round 1 you partner with a Gold teammate against 2 Black players. Round 2 you get a different Gold partner, still facing Black. Your squad total builds up round by round.',
  },
  court_blocks: {
    label: 'Court Swap — same group on your court, swap groups every hour',
    summary: 'Players are split into groups — one group per court — for a fixed number of rounds (a "block"). Within a block you only play against/with people in your own group, rotating partners inside it. When the block ends, groups reshuffle and everyone swaps to a different court.',
    example: 'Example: Block 1 (rounds 1-6) you\'re grouped with 4 others on Court 1, rotating partners among just those 5. Block 2 (rounds 7-12), the groups reshuffle and you might end up on Court 2 with a different set of people.',
  },
  fixed_partners: {
    label: 'Fixed Partners — same partner all night',
    summary: 'Everyone gets one partner for the entire session — that never changes. Only who you\'re facing on the other side of the net rotates each round, balanced so you play against different teams roughly evenly.',
    example: 'Example: You\'re paired with Sam for the whole night. Round 1 you and Sam face Priya & Tom. Round 2 you and Sam face a different team. Your partner is always Sam.',
  },
  king_of_court: {
    label: 'King of the Court — winners climb, losers drop',
    summary: 'Courts are ranked, Court 1 is the top. Win your court and you rise a court next round; lose and you drop a court. The winner on Court 1 defends their spot, the loser on the bottom court stays put. Needs exactly enough players to fill every court (4 per court) — no bench in this format yet. Round 2 onward is generated live as scores come in, not pre-made.',
    example: "Example: 2 courts, 8 players. Win Court 2 and you rise to Court 1 next round; lose Court 1 and you drop to Court 2. Whoever's on Court 1 at the end is the night's king.",
  },
  team_championship: {
    label: 'Team Championship — 2 teams, captain-picked pairings, tiered scoring',
    summary: 'Two fixed teams face off across multiple stages of rounds — you (the captain/organizer) enter each round\'s pairings by hand instead of the app shuffling them, since real tournaments usually have pairings pre-agreed. Each stage can be worth a different number of points per win, and an optional live Rapid Fire finale (first to a target rally-point score) adds a bonus at the end.',
    example: 'Example: Home vs Challengers, 15 rounds split into 3 stages worth 1/2/3 points per win. You enter round 1\'s pairings as agreed, then round 2\'s, and so on — the app tallies stage-weighted standings and (optionally) runs a live Rapid Fire scoreboard after the last round.',
  },
};

// The 5 club-night formats shown in the visible picker below. Team
// Championship is a tournament format (2 fixed teams, multi-stage,
// manual pairings) — it lives in FORMAT_INFO for its label/summary/example
// text and every existing format-branch below still handles it, but it's
// only reachable via /tournaments' "New Team Championship" entry point
// (?format=team_championship), not this picker, per explicit product
// decision that tournament formats don't belong alongside single-night
// club formats.
const NORMAL_FORMATS: Format[] = ['scramble', 'squad_rivalry', 'court_blocks', 'fixed_partners', 'king_of_court'];

export default function SetupPage() {
  return (
    <Suspense fallback={<main className="page"><p>Loading…</p></main>}>
      <SetupPageInner />
    </Suspense>
  );
}

function SetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentClubId, currentClub, user, loading: clubLoading } = useCurrentClub();
  const presetFormat = searchParams.get('format') === 'team_championship';

  // Restores in-progress setup form state after a back-navigation or
  // accidental reload — without this, leaving /setup mid-fill (even via the
  // in-app "Change Players" back link's parent navigation) loses everything
  // typed so far since it's plain component state with nowhere else to live.
  const SETUP_DRAFT_KEY = 'pickleball-setup-draft';
  function readDraft(): {
    playerCount?: number;
    courtCount?: number;
    namesEntered?: boolean;
    names?: string[];
    format?: Format;
    venue?: string;
    manualSquadAssignment?: (number | null)[];
    manualPartnerAssignment?: (number | null)[];
    manualBlocks?: (number | null)[][];
    lockedPairs?: LockedPair[];
  } {
    if (typeof window === 'undefined') return {};
    try {
      const raw = sessionStorage.getItem(SETUP_DRAFT_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          names: Array.isArray(parsed.names) ? parsed.names : undefined,
          manualSquadAssignment: Array.isArray(parsed.manualSquadAssignment) ? parsed.manualSquadAssignment : undefined,
          manualPartnerAssignment: Array.isArray(parsed.manualPartnerAssignment) ? parsed.manualPartnerAssignment : undefined,
          manualBlocks: Array.isArray(parsed.manualBlocks) ? parsed.manualBlocks : undefined,
          lockedPairs: Array.isArray(parsed.lockedPairs) ? parsed.lockedPairs : undefined,
        };
      }
      return {};
    } catch {
      return {};
    }
  }
  const draft = readDraft();

  const [playerCount, setPlayerCount] = useState(draft.playerCount ?? 10);
  const [courtCount, setCourtCount] = useState(draft.courtCount ?? 2);
  const [namesEntered, setNamesEntered] = useState(draft.namesEntered ?? false);
  const [names, setNames] = useState<string[]>(draft.names ?? Array(10).fill(''));
  const [rosterNotice, setRosterNotice] = useState<string | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<Record<number, string>>({});
  const [photoVersion, setPhotoVersion] = useState(0);

  async function handlePhotoSelect(i: number, file: File | null) {
    if (!file) return;
    const trimmedName = names[i].trim();
    if (!trimmedName) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreviews(prev => ({ ...prev, [i]: previewUrl }));
    try {
      const publicUrl = await uploadPlayerPhoto(file);
      savePlayerPhoto(trimmedName, publicUrl);
      setPhotoVersion(v => v + 1);
    } catch {
      // Upload failed — clear local preview so fake preview isn't shown
      setPhotoPreviews(prev => {
        const copy = { ...prev };
        delete copy[i];
        return copy;
      });
    }
  }

  const [format, setFormat] = useState<Format>(presetFormat ? 'team_championship' : draft.format ?? 'scramble');
  const [openFormatInfo, setOpenFormatInfo] = useState<Format | null>(null);
  const [roundCount, setRoundCount] = useState(12);
  const [courtLabels, setCourtLabels] = useState<string[]>(['1', '2']);
  const [roundDurationMinutes, setRoundDurationMinutes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [venue, setVenue] = useState(draft.venue ?? '');

  const [roundsPerBlock, setRoundsPerBlock] = useState(6);
  const [swapCount, setSwapCount] = useState(2);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  // Per block: court index (0-based) assigned to each player, or null if unassigned.
  const [manualBlocks, setManualBlocks] = useState<(number | null)[][]>(draft.manualBlocks ?? []);

  const [squadMode, setSquadMode] = useState<'auto' | 'manual'>('auto');
  const [squadGoldLabel, setSquadGoldLabel] = useState('');
  const [squadBlackLabel, setSquadBlackLabel] = useState('');
  const [squadGoldLogoFile, setSquadGoldLogoFile] = useState<File | null>(null);
  const [squadBlackLogoFile, setSquadBlackLogoFile] = useState<File | null>(null);
  // 0 = gold, 1 = black, null = unassigned, indexed by player.
  // Widened from (0|1|null)[] to (number|null)[] to support N squads —
  // team_championship's own usage (always exactly 2 teams) is unaffected,
  // it just always passes squadCount=2 to cycleSquadPlayer below.
  const [manualSquadAssignment, setManualSquadAssignment] = useState<(number | null)[]>(draft.manualSquadAssignment ?? []);
  const [squadCount, setSquadCount] = useState(2);
  const [squadLabels, setSquadLabels] = useState<string[]>([]);

  const [partnerMode, setPartnerMode] = useState<'auto' | 'manual'>('auto');
  // Team index (0-based), null = unassigned, indexed by player.
  const [manualPartnerAssignment, setManualPartnerAssignment] = useState<(number | null)[]>(draft.manualPartnerAssignment ?? []);

  // Team Championship — reuses manualSquadAssignment/cycleSquadPlayer (the
  // exact same 2-way split infra squad_rivalry's manual mode already uses)
  // for the Home/Challengers roster split, since it's structurally
  // identical. squadGoldLabel/squadBlackLabel double as the team names for
  // this format too, to avoid duplicating the same 2-label-input UI.
  const [stageRows, setStageRows] = useState<{ label: string; rounds: number; pointsPerWin: number }[]>([
    { label: 'Stage 1', rounds: 5, pointsPerWin: 1 },
  ]);
  const [enableRapidFire, setEnableRapidFire] = useState(false);
  const [rapidFireTarget, setRapidFireTarget] = useState(31);
  const [rapidFireBonus, setRapidFireBonus] = useState(10);

  const [lockedPairs, setLockedPairs] = useState<LockedPair[]>(draft.lockedPairs ?? []);
  const [skillBalanced, setSkillBalanced] = useState(false);
  const [rivalryAware, setRivalryAware] = useState(false);
  const [lockPickerA, setLockPickerA] = useState('');
  const [lockPickerB, setLockPickerB] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(
      SETUP_DRAFT_KEY,
      JSON.stringify({
        playerCount,
        courtCount,
        namesEntered,
        names,
        format,
        venue,
        manualSquadAssignment,
        manualPartnerAssignment,
        manualBlocks,
        lockedPairs,
      })
    );
  }, [playerCount, courtCount, namesEntered, names, format, venue, manualSquadAssignment, manualPartnerAssignment, manualBlocks, lockedPairs]);

  const trimmedNamesForLocks = names.map(n => n.trim()).filter(Boolean);
  const lockedPlayers = new Set(lockedPairs.flatMap(p => p));

  function handleAddLock() {
    if (!lockPickerA || !lockPickerB || lockPickerA === lockPickerB) return;
    setLockedPairs(prev => [...prev, [lockPickerA, lockPickerB]]);
    setLockPickerA('');
    setLockPickerB('');
    setSkillBalanced(false);
  }

  function handleRemoveLock(index: number) {
    setLockedPairs(prev => prev.filter((_, i) => i !== index));
  }


  const [courtCost, setCourtCost] = useState('');
  const [ballCost, setBallCost] = useState('200');
  const [bookerUpiVpa, setBookerUpiVpa] = useState('');
  const [isLadder, setIsLadder] = useState(false);
  const [kingOfCourtFixedPairs, setKingOfCourtFixedPairs] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Splits the long form into 3 screens instead of one continuous scroll —
  // pure display gating, no change to validation/generation logic below.
  const [subStep, setSubStep] = useState<'players' | 'format' | 'cost'>('players');

  const minPlayers = courtCount * 4;
  const [savedRoster, setSavedRoster] = useState<string[] | null>(null);

  const [registeredPlayers, setRegisteredPlayers] = useState<PlayerRow[]>([]);

  const [myName, setMyName] = useState<string | null>(null);
  const [nemesis, setNemesis] = useState<Rivalry | null>(null);
  const [storylines, setStorylines] = useState<string[]>([]);

  useEffect(() => {
    if (clubLoading || !currentClubId) return;
    loadRoster(currentClubId).then(setSavedRoster);
    preloadPlayerPhotos().then(() => setPhotoVersion(v => v + 1));
    listPlayers(currentClubId).then(setRegisteredPlayers).catch(() => setRegisteredPlayers([]));
    getCurrentUser()
      .then(user => (user ? getOwnPlayer(currentClubId, user.id) : null))
      .then(player => setMyName(player?.name ?? null))
      .catch(() => setMyName(null));
  }, [currentClubId, clubLoading]);

  // Closest rival tonight: among tonight's roster, whoever you've got the
  // tightest head-to-head record against — a fun pregame teaser, not a
  // ranked stat, so the games threshold is deliberately lower than the
  // official MIN_GAMES_FOR_RIVALRY used on the League page.
  useEffect(() => {
    if (!myName || !currentClubId || !names.some(n => n.trim() === myName)) {
      setNemesis(null);
      return;
    }
    // Debounced — `names` changes on every keystroke while editing the
    // roster inline on this screen, and this would otherwise re-fetch on
    // every single character typed.
    const timer = setTimeout(() => {
      const roster = new Set(names.map(n => n.trim()).filter(Boolean));
      fetchRivalriesForPlayer(currentClubId, myName)
        .then(rivalries => {
          const inRoster = rivalries.filter(r => roster.has(r.players[1]) && r.gamesTogether >= MIN_GAMES_FOR_NEMESIS_ALERT);
          const closest = [...inRoster].sort((a, b) => {
            const gapA = Math.abs(a.record[0] - a.record[1]);
            const gapB = Math.abs(b.record[0] - b.record[1]);
            if (gapA !== gapB) return gapA - gapB;
            return b.gamesTogether - a.gamesTogether;
          })[0];
          setNemesis(closest ?? null);
        })
        .catch(() => setNemesis(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [myName, names, currentClubId]);

  // Template-based pregame brief (no LLM) — same debounce reasoning as Nemesis Alert above.
  useEffect(() => {
    const roster = names.map(n => n.trim()).filter(Boolean);
    if (roster.length < 2 || !currentClubId) {
      setStorylines([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([fetchStreaks(currentClubId), fetchRivalriesAmongRoster(currentClubId, roster)])
        .then(([streaks, rivalries]) => {
          if (cancelled) return;
          const templateLines = buildStorylines(roster, streaks, rivalries);
          setStorylines(templateLines);
          // Progressive enhancement — show template lines immediately, swap
          // in the LLM-polished version if it arrives before the roster
          // changes again (guarded by `cancelled` so a slow response from an
          // earlier roster can't clobber newer template lines).
          if (templateLines.length > 0) {
            polishStorylines(templateLines).then(polished => {
              if (polished && !cancelled) setStorylines(polished);
            });
          }
        })
        .catch(() => {
          if (!cancelled) setStorylines([]);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [names, currentClubId]);

  function handleAddRegisteredPlayer(playerName: string) {
    if (names.some(n => n.trim() === playerName)) return; // already added
    const emptyIndex = names.findIndex(n => n.trim() === '');
    if (emptyIndex === -1) return; // no empty slot — roster full at current player count
    updateName(emptyIndex, playerName);
  }

  function resizeKeepingExisting<T>(current: T[], newLength: number, blank: T): T[] {
    const resized = Array(newLength).fill(blank) as T[];
    for (let i = 0; i < Math.min(current.length, newLength); i++) resized[i] = current[i];
    return resized;
  }

  function handlePlayerCountConfirm() {
    if (courtCount < 1) {
      setError('You need at least 1 court.');
      return;
    }
    if (playerCount < minPlayers) {
      setError(`With ${courtCount} court(s) you need at least ${minPlayers} players (4 per court).`);
      return;
    }
    setError(null);
    // Resize rather than replace — changing court/player count used to wipe
    // every name you'd already typed, which made it look like court count
    // "couldn't" be changed after the fact.
    setNames(prev => resizeKeepingExisting(prev, playerCount, ''));
    setCourtLabels(prev => resizeKeepingExisting(prev.length ? prev : ['1', '2'], courtCount, '').map((v, i) => v || `${i + 1}`));
    setNamesEntered(true);
    setSubStep('players');
  }

  async function handleRepeatLastSession() {
    if (!currentClubId) return;
    setError(null);
    let last;
    try {
      last = await getMostRecentSession(currentClubId);
    } catch {
      setError('Failed to load your last session.');
      return;
    }
    if (!last) {
      setError('No previous session found.');
      return;
    }
    const courts = last.court_labels.length;
    setCourtCount(courts);
    setPlayerCount(last.players.length);
    setNames(last.players);
    setCourtLabels(last.court_labels);
    setFormat(last.format);
    setRoundCount(last.round_count);
    if (last.format === 'court_blocks' && last.rounds_per_block) {
      setRoundsPerBlock(last.rounds_per_block);
      setSwapCount(Math.round(last.round_count / last.rounds_per_block));
    }
    setCourtCost(last.court_cost !== null ? String(last.court_cost) : '');
    setBallCost(String(last.ball_cost));
    setBookerUpiVpa(last.booker_upi_vpa ?? '');
    setIsLadder(last.is_ladder);
    if (last.king_of_court_fixed_pairs !== null) setKingOfCourtFixedPairs(last.king_of_court_fixed_pairs);
    setStartTime(last.start_time ?? '');
    setRoundDurationMinutes(last.round_duration_minutes !== null ? String(last.round_duration_minutes) : '');
    setNamesEntered(true);
    setSubStep('players');
    setRosterNotice(
      "Loaded your last session's setup — edit anything below. Locked partners and skill-balancing don't carry over."
    );
  }

  function handleUseSavedRoster() {
    if (!savedRoster) return;
    if (savedRoster.length < minPlayers) {
      setError(`Saved roster has ${savedRoster.length} players — need at least ${minPlayers} for ${courtCount} court(s).`);
      return;
    }
    setError(null);
    setPlayerCount(savedRoster.length);
    setNames(savedRoster);
    setCourtLabels(prev => resizeKeepingExisting(prev.length ? prev : ['1', '2'], courtCount, '').map((v, i) => v || `${i + 1}`));
    setNamesEntered(true);
    setSubStep('players');
    setRosterNotice('Loaded your saved roster — edit any name below, or add new players.');
  }

  function cycleSquadPlayer(playerIndex: number, squadCountForCycle: number) {
    setManualSquadAssignment(prev => {
      const copy = [...prev];
      while (copy.length <= playerIndex) copy.push(null);
      const current = copy[playerIndex];
      copy[playerIndex] = current === null ? 0 : current + 1 < squadCountForCycle ? current + 1 : null;
      return copy;
    });
  }

  // Tap player A (highlights, pending), tap player B to lock them in as a
  // pair — not a per-player numeric cycle, which let you assign everyone the
  // same team number by accident. Tapping an already-paired player unpairs
  // both members of that pair. Tapping the pending player again cancels it.
  const [pendingPartnerIndex, setPendingPartnerIndex] = useState<number | null>(null);

  function handlePartnerTap(playerIndex: number) {
    setManualPartnerAssignment(prev => {
      const copy = [...prev];
      while (copy.length <= playerIndex) copy.push(null);
      const currentTeam = copy[playerIndex];

      if (currentTeam !== null) {
        // Already paired — tapping unpairs both members of that pair.
        for (let i = 0; i < copy.length; i++) if (copy[i] === currentTeam) copy[i] = null;
        return copy;
      }

      if (pendingPartnerIndex === null) {
        setPendingPartnerIndex(playerIndex);
        return copy;
      }
      if (pendingPartnerIndex === playerIndex) {
        setPendingPartnerIndex(null);
        return copy;
      }

      while (copy.length <= pendingPartnerIndex) copy.push(null);
      const usedTeams = new Set(copy.filter((t): t is number => t !== null));
      let nextTeam = 0;
      while (usedTeams.has(nextTeam)) nextTeam++;
      copy[pendingPartnerIndex] = nextTeam;
      copy[playerIndex] = nextTeam;
      setPendingPartnerIndex(null);
      return copy;
    });
  }

  function removeName(index: number) {
    const copy = names.filter((_, i) => i !== index);
    setNames(copy);
    setPlayerCount(copy.length);
  }

  function updateName(index: number, value: string) {
    const copy = [...names];
    copy[index] = value;
    setNames(copy);
  }

  // Typing "amit" when the club already has a registered "Amit" silently
  // creates a second, permanently-distinct identity for every stat system
  // (exact string matching everywhere) — auto-correct casing against the
  // registered roster on blur so this can't happen from manual typing.
  function normalizeNameCasing(index: number) {
    const trimmed = names[index].trim();
    if (!trimmed) return;
    const match = registeredPlayers.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (match && match.name !== trimmed) updateName(index, match.name);
  }

  function updateCourtLabel(index: number, value: string) {
    setCourtLabels(prev => prev.map((v, i) => (i === index ? value : v)));
  }

  const blockCount = format === 'court_blocks' ? swapCount : 0;

  function cycleManualBlockPlayer(blockIndex: number, playerIndex: number) {
    setManualBlocks(prev => {
      const copy = prev.map(b => [...b]);
      while (copy.length <= blockIndex) copy.push(Array(playerCount).fill(null));
      const block = copy[blockIndex];
      const current = block[playerIndex];
      block[playerIndex] = current === null ? 0 : current + 1 >= courtCount ? null : current + 1;
      return copy;
    });
  }

  async function handleGenerate() {
    setError(null);
    if (!currentClubId) {
      setError('Join or create a club before starting a session.');
      return;
    }
    const trimmed = names.map(n => n.trim());
    if (trimmed.some(n => n.length === 0)) {
      setError('All player names are required.');
      return;
    }
    if (new Set(trimmed).size !== trimmed.length) {
      setError('Player names must be unique.');
      return;
    }
    if (format === 'king_of_court' && trimmed.length !== courtCount * 4) {
      setError(`King of the Court needs exactly ${courtCount * 4} players for ${courtCount} court(s) — no bench in this format yet.`);
      return;
    }
    const trimmedCourtLabels = courtLabels.map(l => l.trim());
    if (trimmedCourtLabels.some(l => l === '')) {
      setError('Every court needs a number or name.');
      return;
    }
    const parsedDuration = roundDurationMinutes.trim() === '' ? null : Number(roundDurationMinutes);
    if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
      setError('Minutes per round must be a positive number, or left blank.');
      return;
    }

    let manualAssignments: CourtBlockAssignment[] | undefined;
    if (format === 'court_blocks' && assignmentMode === 'manual') {
      manualAssignments = [];
      for (let b = 0; b < blockCount; b++) {
        const assignment = manualBlocks[b] ?? Array(playerCount).fill(null);
        if (assignment.some(c => c === null)) {
          setError(`Swap ${b + 1}: assign every player to a court.`);
          return;
        }
        const groups: string[][] = Array.from({ length: courtCount }, () => []);
        assignment.forEach((courtIndex, playerIndex) => {
          groups[courtIndex as number].push(trimmed[playerIndex]);
        });
        if (groups.some(g => g.length < 4)) {
          setError(`Swap ${b + 1}: every court needs at least 4 players.`);
          return;
        }
        manualAssignments.push({ groups });
      }
    }

    let manualSquads: Squads | undefined;
    let manualSquadsN: SquadSet | undefined;
    if (format === 'squad_rivalry' && squadMode === 'manual') {
      const assignment = manualSquadAssignment.length ? manualSquadAssignment : Array(playerCount).fill(null);
      if (trimmed.some((_, i) => assignment[i] === undefined || assignment[i] === null)) {
        setError('Assign every player to a squad.');
        return;
      }
      const buckets: string[][] = Array.from({ length: squadCount }, () => []);
      trimmed.forEach((name, i) => buckets[assignment[i] as number].push(name));
      const sizes = buckets.map(b => b.length);
      if (Math.max(...sizes) - Math.min(...sizes) > 1) {
        setError('Squads must be balanced within 1 player of each other.');
        return;
      }
      if (squadCount === 2) {
        manualSquads = { gold: buckets[0], black: buckets[1] };
      } else {
        manualSquadsN = buckets.map((players, i) => ({ id: squadIdFor(i), label: squadLabels[i]?.trim() || undefined, players }));
      }
    }

    let manualTeams: [string, string][] | undefined;
    if (format === 'fixed_partners' && partnerMode === 'manual') {
      const teamCount = playerCount / 2;
      const assignment = manualPartnerAssignment.length ? manualPartnerAssignment : Array(playerCount).fill(null);
      if (trimmed.some((_, i) => assignment[i] === undefined || assignment[i] === null)) {
        setError('Assign every player to a partnership.');
        return;
      }
      const teams: (string | undefined)[][] = Array.from({ length: teamCount }, () => []);
      trimmed.forEach((name, i) => teams[assignment[i] as number].push(name));
      if (teams.some(t => t.length !== 2)) {
        setError('Every partnership needs exactly 2 players.');
        return;
      }
      manualTeams = teams.map(t => [t[0]!, t[1]!] as [string, string]);
    }

    let teamChampionshipTeams: SquadSet | undefined;
    let teamChampionshipStages: StageConfig[] | undefined;
    if (format === 'team_championship') {
      const assignment = manualSquadAssignment.length ? manualSquadAssignment : Array(playerCount).fill(null);
      if (trimmed.some((_, i) => assignment[i] === undefined || assignment[i] === null)) {
        setError('Assign every player to a team.');
        return;
      }
      const teamOne: string[] = [];
      const teamTwo: string[] = [];
      trimmed.forEach((name, i) => (assignment[i] === 0 ? teamOne : teamTwo).push(name));
      if (teamOne.length !== teamTwo.length) {
        setError('Teams must be evenly split — Team 1 and Team 2 need the same number of players.');
        return;
      }
      teamChampionshipTeams = [
        { id: 'team1', label: squadGoldLabel.trim() || 'Team 1', logoUrl: null, players: teamOne },
        { id: 'team2', label: squadBlackLabel.trim() || 'Team 2', logoUrl: null, players: teamTwo },
      ];
      if (stageRows.length === 0 || stageRows.some(r => !Number.isFinite(r.rounds) || r.rounds < 1 || !Number.isFinite(r.pointsPerWin) || r.pointsPerWin < 1)) {
        setError('Every stage needs at least 1 round and a points-per-win of at least 1.');
        return;
      }
      let cursor = 1;
      teamChampionshipStages = stageRows.map(r => {
        const stage = { stageLabel: r.label.trim() || 'Stage', roundStart: cursor, roundEnd: cursor + r.rounds - 1, pointsPerWin: r.pointsPerWin };
        cursor += r.rounds;
        return stage;
      });
      if (enableRapidFire && (!Number.isFinite(rapidFireTarget) || rapidFireTarget < 1 || !Number.isFinite(rapidFireBonus) || rapidFireBonus < 1)) {
        setError('Rapid Fire target points and bonus must both be positive numbers.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const seed = `${Date.now()}`;
      // Branding now comes from the club (Club Settings), not entered per
      // session — this is just what gets stamped onto this session's row so
      // GroupHeader keeps working unchanged for historical sessions too.
      const logoUrl1: string | null = currentClub?.logo_url ?? null;
      const logoUrl2: string | null = currentClub?.logo_url_2 ?? null;

      const parsedCourtCost = courtCost.trim() === '' ? null : Number(courtCost);
      const parsedBallCost = ballCost.trim() === '' ? 200 : Number(ballCost);

      const [squadGoldLogoUrl, squadBlackLogoUrl] =
        format === 'squad_rivalry'
          ? await Promise.all([
              squadGoldLogoFile ? uploadSquadLogo(squadGoldLogoFile) : Promise.resolve(null),
              squadBlackLogoFile ? uploadSquadLogo(squadBlackLogoFile) : Promise.resolve(null),
            ])
          : [null, null];
      const squadRivalryLabel1 = format === 'squad_rivalry' ? squadLabels[0]?.trim() || null : null;
      const squadRivalryLabel2 = format === 'squad_rivalry' ? squadLabels[1]?.trim() || null : null;

      const baseOptions = {
        clubId: currentClubId,
        players: trimmed,
        courtLabels: trimmedCourtLabels,
        roundDurationMinutes: parsedDuration,
        groupName: currentClub?.name ?? null,
        logoUrl1,
        logoUrl2,
        startTime: startTime.trim() || null,
        courtCost: parsedCourtCost,
        ballCost: parsedBallCost,
        isLadder,
        kingOfCourtFixedPairs: format === 'king_of_court' ? kingOfCourtFixedPairs : null,
        venue: venue.trim() || null,
        storylines,
        bookerUpiVpa: bookerUpiVpa.trim() || null,
      };

      let sessionId: string;
      if (format === 'scramble') {
        const skillRatings =
          skillBalanced && lockedPairs.length === 0 ? (await getSkillRatingsForNames(currentClubId, trimmed)) ?? undefined : undefined;
        const rivalryHeatMap = rivalryAware
          ? buildRivalryHeatMap(await fetchRivalriesAmongRoster(currentClubId, trimmed))
          : undefined;
        const rounds = generateScrambleSchedule(trimmed, courtCount, roundCount, seed, lockedPairs, skillRatings, rivalryHeatMap);
        sessionId = await createSession({
          ...baseOptions,
          format: 'scramble',
          roundCount,
          squads: null,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else if (format === 'squad_rivalry' && squadCount === 2) {
        const { squads, rounds } = generateSquadRivalrySchedule(trimmed, courtCount, roundCount, seed, lockedPairs, manualSquads);
        const squadSet: SquadSet = [
          { id: 'gold', label: squadRivalryLabel1 ?? undefined, logoUrl: squadGoldLogoUrl, players: squads.gold },
          { id: 'black', label: squadRivalryLabel2 ?? undefined, logoUrl: squadBlackLogoUrl, players: squads.black },
        ];
        sessionId = await createSession({
          ...baseOptions,
          format: 'squad_rivalry',
          roundCount,
          squads: squadSet,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else if (format === 'squad_rivalry') {
        const { squads: squadSet, rounds } = generateSquadRivalryScheduleN(trimmed, squadCount, courtCount, roundCount, seed, lockedPairs, manualSquadsN);
        sessionId = await createSession({
          ...baseOptions,
          format: 'squad_rivalry',
          roundCount,
          squads: squadSet,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else if (format === 'fixed_partners') {
        const { rounds } = generateFixedPartnersSchedule(trimmed, courtCount, roundCount, seed, manualTeams);
        sessionId = await createSession({
          ...baseOptions,
          format: 'fixed_partners',
          roundCount,
          squads: null,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else if (format === 'king_of_court') {
        const courts = generateInitialKingOfCourtRound(trimmed, courtCount, seed, kingOfCourtFixedPairs);
        sessionId = await createSession({
          ...baseOptions,
          format: 'king_of_court',
          roundCount,
          squads: null,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, [{ roundNumber: 1, courts, sittingOutPerCourt: courts.map(() => []) }]);
      } else if (format === 'team_championship') {
        const totalRounds = teamChampionshipStages!.reduce((sum, s) => sum + (s.roundEnd - s.roundStart + 1), 0);
        sessionId = await createSession({
          ...baseOptions,
          format: 'team_championship',
          roundCount: totalRounds,
          squads: teamChampionshipTeams ?? null,
          roundsPerBlock: null,
          stageConfig: teamChampionshipStages,
          rapidFireConfig: enableRapidFire
            ? { targetPoints: rapidFireTarget, bonusPoints: rapidFireBonus }
            : null,
        });
        // No insertRounds call — pairings are entered by hand, round by
        // round, on a screen that doesn't exist yet (Phase 4 of the locked
        // plan). The session is created with zero rounds until then.
      } else {
        const { rounds } = generateCourtBlocksSchedule(trimmed, courtCount, roundsPerBlock, blockCount, seed, manualAssignments);
        sessionId = await createSession({
          ...baseOptions,
          format: 'court_blocks',
          roundCount: roundsPerBlock * blockCount,
          squads: null,
          roundsPerBlock,
        });
        await insertRounds(sessionId, rounds);
      }
      await saveRoster(currentClubId, trimmed);
      if (parsedCourtCost !== null) {
        await createSessionDues(sessionId, parsedCourtCost, parsedBallCost, trimmed);
      }
      sessionStorage.removeItem(SETUP_DRAFT_KEY);
      router.push(
        format === 'king_of_court'
          ? `/session/${sessionId}/play`
          : format === 'team_championship'
          ? `/session/${sessionId}/team-championship/pairings`
          : `/session/${sessionId}/schedule`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session.');
      setSubmitting(false);
    }
  }

  if (clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!user) return <SignInGate message="Sign in to start a session." />;
  if (!currentClubId) {
    return (
      <main className="page">
        <p>Join or create a club before starting a session.</p>
        <a href="/clubs" className="btn-primary" style={{ display: 'inline-block', marginTop: 12 }}>
          Go to Clubs
        </a>
      </main>
    );
  }

  if (!namesEntered) {
    return (
      <main className="page">
        <StatusChip />
        <h1>Session Setup</h1>
        <h2>How Many Courts?</h2>
        <div className="card">
          <input
            type="number"
            value={courtCount || ''}
            onChange={e => setCourtCount(Number(e.target.value) || 0)}
            min={1}
            aria-label="Number of courts"
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        <h2>How Many Players?</h2>
        <div className="card">
          <input
            type="number"
            value={playerCount || ''}
            onChange={e => setPlayerCount(Number(e.target.value) || 0)}
            min={minPlayers}
            aria-label="Number of players"
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            At least {minPlayers} for {courtCount} court{courtCount === 1 ? '' : 's'} (4 per court). No upper limit.
          </p>
        </div>
        {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}
        <button className="btn-primary" onClick={handlePlayerCountConfirm} style={{ width: '100%', marginTop: 20 }}>
          Next: Enter Names
        </button>
        {savedRoster && savedRoster.length > 0 && (
          <button className="btn-secondary" onClick={handleUseSavedRoster} style={{ width: '100%', marginTop: 10 }}>
            Use Saved Roster ({savedRoster.length} players)
          </button>
        )}
        <button className="btn-secondary" onClick={handleRepeatLastSession} style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <RotateCcw size={16} /> Repeat Last Session
        </button>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Session Setup</h1>

      {subStep === 'players' && (
      <>
      <h2>Players ({playerCount})</h2>
      {rosterNotice && (
        <p style={{ color: 'var(--dark)', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{rosterNotice}</p>
      )}
      {registeredPlayers.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            Tap a registered player to add them — anyone not registered can still be typed in manually below.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {registeredPlayers.map(p => {
              const alreadyAdded = names.some(n => n.trim() === p.name);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAddRegisteredPlayer(p.name)}
                  disabled={alreadyAdded}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: alreadyAdded ? 'var(--background)' : 'white',
                    opacity: alreadyAdded ? 0.5 : 1,
                    fontSize: 13,
                  }}
                >
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" width={20} height={20} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#ddd', display: 'inline-block' }} />
                  )}
                  {displayName(p)}
                  {alreadyAdded && ' ✓'}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {names.map((name, i) => {
          const existingPhoto = name.trim() ? getPlayerPhoto(name.trim()) : null;
          const photoSrc = photoPreviews[i] ?? existingPhoto;
          void photoVersion; // re-render trigger after upload completes
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  flex: '0 0 auto',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  background: photoSrc ? 'transparent' : '#eee',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  cursor: 'pointer',
                }}
                aria-label={`Add photo for player ${i + 1}`}
                title="Add player photo"
              >
                {photoSrc ? (
                  <img src={photoSrc} alt="" width={36} height={36} style={{ objectFit: 'cover' }} />
                ) : (
                  <Camera size={16} />
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handlePhotoSelect(i, e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                value={name}
                onChange={e => updateName(i, e.target.value)}
                onBlur={() => normalizeNameCasing(i)}
                placeholder={`Player ${i + 1}`}
                style={{ flex: 1, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <button
                type="button"
                aria-label={`Remove player ${i + 1}`}
                onClick={() => removeName(i)}
                className="icon-btn"
                style={{ flex: '0 0 auto' }}
              >
                <X size={18} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="btn-secondary"
        onClick={() => setNamesEntered(false)}
        style={{ marginTop: 8, marginBottom: 4 }}
      >
        ← Change Players / Courts
      </button>

      {nemesis && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--background)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Flame size={16} /> <strong>Nemesis Alert:</strong> You vs {nemesis.players[1]} tonight — {nemesis.record[0]}-{nemesis.record[1]} all-time.
        </div>
      )}

      {storylines.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--background)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong>Tonight's Storylines</strong>
          {storylines.map(line => <span key={line}>{line}</span>)}
        </div>
      )}

      <button
        className="btn-primary"
        onClick={() => setSubStep('format')}
        style={{ width: '100%', marginTop: 8 }}
      >
        Next: Format & Options
      </button>
      </>
      )}

      {subStep === 'format' && (
      <>
      <h2>Ladder League (optional)</h2>
      <div className="card">
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <input type="checkbox" checked={isLadder} onChange={e => setIsLadder(e.target.checked)} />
          <span>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ListOrdered size={15} /> Count this as a Ladder League session</strong>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
              Rounds where all 4 players are enrolled on the ladder (see /league/ladder) count toward rung movement.
              Everyone else still plays normally — this doesn't change matchmaking or the format above.
            </p>
          </span>
        </label>
      </div>

      {presetFormat ? (
        <div className="card" style={{ marginBottom: 4 }}>
          <strong>{FORMAT_INFO.team_championship.label}</strong>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>
            Started from Tournaments — {FORMAT_INFO.team_championship.summary}
          </p>
        </div>
      ) : (
        <>
          <h2>Format</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {NORMAL_FORMATS.map(f => (
              <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="radio" checked={format === f} onChange={() => setFormat(f)} />
                <span style={{ flex: 1 }}>{FORMAT_INFO[f].label}</span>
                <button
                  type="button"
                  onClick={() => setOpenFormatInfo(f)}
                  className="btn-secondary"
                  style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                >
                  What is this?
                </button>
              </label>
            ))}
          </div>
        </>
      )}
      {openFormatInfo && (
        <InfoModal title={FORMAT_INFO[openFormatInfo].label} onClose={() => setOpenFormatInfo(null)}>
          <p>{FORMAT_INFO[openFormatInfo].summary}</p>
          <p style={{ marginTop: 8, fontStyle: 'italic', color: 'var(--muted)' }}>{FORMAT_INFO[openFormatInfo].example}</p>
        </InfoModal>
      )}

      {format === 'king_of_court' && (
        <>
          <h2>Partner Mode</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={kingOfCourtFixedPairs} onChange={() => setKingOfCourtFixedPairs(true)} />
              <span>Fixed pairs — same partner climbs/falls with you all night</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={!kingOfCourtFixedPairs} onChange={() => setKingOfCourtFixedPairs(false)} />
              <span>Rotating — partner reshuffles every round you move courts</span>
            </label>
          </div>
        </>
      )}

      {format === 'scramble' && (
        <>
          <h2>Skill-Balanced Matchmaking (optional)</h2>
          <div className="card">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input
                type="checkbox"
                checked={skillBalanced}
                onChange={e => {
                  setSkillBalanced(e.target.checked);
                  if (e.target.checked) {
                    setLockedPairs([]);
                    setRivalryAware(false);
                  }
                }}
              />
              <span>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Scale size={15} /> Balance courts by skill</strong>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                  Pairs players so opposing teams are evenly matched, based on results from past sessions. Needs at
                  least 2 registered players with 20+ games logged — falls back to normal random pairing otherwise.
                  Can't be combined with locked partners.
                </p>
              </span>
            </label>
          </div>

          <h2>Rivalry-Aware Matchmaking (optional)</h2>
          <div className="card">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input
                type="checkbox"
                checked={rivalryAware}
                onChange={e => {
                  setRivalryAware(e.target.checked);
                  if (e.target.checked) setSkillBalanced(false);
                }}
              />
              <span>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flame size={15} /> Seek out rivalries</strong>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                  When forming courts, tries to put tonight's closest head-to-head rivalries (5+ games together,
                  tight record) against each other. Partner pairing and sit-out balancing are unaffected — only who
                  you face changes. Falls back to normal random matchups when nobody in the roster has enough shared
                  history yet. Can't be combined with skill-balanced.
                </p>
              </span>
            </label>
          </div>
        </>
      )}

      {format === 'squad_rivalry' && (
        <>
          <h2>How Many Squads?</h2>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="icon-btn"
              aria-label="Decrease squad count"
              disabled={squadCount <= 2}
              onClick={() => setSquadCount(n => Math.max(2, n - 1))}
            >
              −
            </button>
            <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{squadCount}</span>
            <button type="button" className="icon-btn" aria-label="Increase squad count" onClick={() => setSquadCount(n => n + 1)}>
              +
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>squads — 2 is the classic Gold vs Black setup</span>
          </div>

          <h2>Name Your Squads (optional)</h2>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {Array.from({ length: squadCount }, (_, i) => i).map(i => (
              <div key={i} style={{ flex: '1 1 200px', minWidth: 0 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>Squad {i + 1}</label>
                <input
                  value={squadLabels[i] ?? ''}
                  onChange={e => setSquadLabels(prev => {
                    const copy = [...prev];
                    while (copy.length <= i) copy.push('');
                    copy[i] = e.target.value;
                    return copy;
                  })}
                  placeholder={i === 0 ? 'Gold' : i === 1 ? 'Black' : `Squad ${i + 1}`}
                  aria-label={`Squad ${i + 1} name`}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
                />
                {i === 0 && (
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Squad 1 logo"
                    onChange={e => setSquadGoldLogoFile(e.target.files?.[0] ?? null)}
                    style={{ width: '100%', boxSizing: 'border-box', maxWidth: '100%', marginTop: 6, fontSize: 12 }}
                  />
                )}
                {i === 1 && (
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Squad 2 logo"
                    onChange={e => setSquadBlackLogoFile(e.target.files?.[0] ?? null)}
                    style={{ width: '100%', boxSizing: 'border-box', maxWidth: '100%', marginTop: 6, fontSize: 12 }}
                  />
                )}
              </div>
            ))}
          </div>

          <h2>Who Picks the Squads?</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={squadMode === 'auto'} onChange={() => setSquadMode('auto')} />
              <span>App decides (recommended)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={squadMode === 'manual'} onChange={() => setSquadMode('manual')} />
              <span>I&apos;ll pick manually</span>
            </label>
          </div>

          {squadMode === 'manual' && (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>Tap a player to cycle through squads, then Unassigned</strong>
              {(() => {
                const trimmedNames = names.map(n => n.trim());
                const indexed = trimmedNames.map((name, playerIndex) => ({ name, playerIndex })).filter(p => p.name);
                const unassigned = indexed.filter(p => (manualSquadAssignment[p.playerIndex] ?? null) === null);
                const squadLabelFor = (i: number) => squadLabels[i]?.trim() || (i === 0 ? 'Gold' : i === 1 ? 'Black' : `Squad ${i + 1}`);
                const chip = (p: { name: string; playerIndex: number }, bg: string, color: string) => (
                  <button
                    key={p.playerIndex}
                    type="button"
                    onClick={() => cycleSquadPlayer(p.playerIndex, squadCount)}
                    style={{ minHeight: 40, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)', background: bg, color, fontSize: 13, fontWeight: 700 }}
                  >
                    {p.name}
                  </button>
                );
                return (
                  <>
                    {unassigned.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                          Unassigned
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{unassigned.map(p => chip(p, 'white', 'var(--foreground)'))}</div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(squadCount, 4)}, 1fr)`, gap: 12, marginTop: 14 }}>
                      {Array.from({ length: squadCount }, (_, i) => i).map(i => {
                        const squadPlayers = indexed.filter(p => manualSquadAssignment[p.playerIndex] === i);
                        const color = SQUAD_CHIP_COLORS[i % SQUAD_CHIP_COLORS.length];
                        return (
                          <div key={i}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, borderBottom: `2px solid ${color}`, paddingBottom: 4 }}>
                              {squadLabelFor(i)} ({squadPlayers.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{squadPlayers.map(p => chip(p, color, 'white'))}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Every player needs a squad, balanced within 1 of each other.</p>
            </div>
          )}
        </>
      )}

      {format === 'team_championship' && (
        <>
          <h2>Name Your Teams</h2>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>Team 1</label>
              <input
                value={squadGoldLabel}
                onChange={e => setSquadGoldLabel(e.target.value)}
                placeholder="Home Team"
                aria-label="Team 1 name"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>Team 2</label>
              <input
                value={squadBlackLabel}
                onChange={e => setSquadBlackLabel(e.target.value)}
                placeholder="Challengers"
                aria-label="Team 2 name"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            </div>
          </div>

          <h2>Split Players Into Teams</h2>
          <div className="card">
            <strong>Tap a player to cycle Unassigned → {squadGoldLabel.trim() || 'Team 1'} → {squadBlackLabel.trim() || 'Team 2'}</strong>
            {(() => {
              const trimmedNames = names.map(n => n.trim());
              const indexed = trimmedNames.map((name, playerIndex) => ({ name, playerIndex })).filter(p => p.name);
              const unassigned = indexed.filter(p => (manualSquadAssignment[p.playerIndex] ?? null) === null);
              const teamOne = indexed.filter(p => manualSquadAssignment[p.playerIndex] === 0);
              const teamTwo = indexed.filter(p => manualSquadAssignment[p.playerIndex] === 1);
              const chip = (p: { name: string; playerIndex: number }, bg: string, color: string) => (
                <button
                  key={p.playerIndex}
                  type="button"
                  onClick={() => cycleSquadPlayer(p.playerIndex, 2)}
                  style={{ minHeight: 40, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--border)', background: bg, color, fontSize: 13, fontWeight: 700 }}
                >
                  {p.name}
                </button>
              );
              return (
                <>
                  {unassigned.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                        Unassigned
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{unassigned.map(p => chip(p, 'white', 'var(--foreground)'))}</div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, borderBottom: '2px solid var(--primary, #1a1a1a)', paddingBottom: 4 }}>
                        {squadGoldLabel.trim() || 'Team 1'} ({teamOne.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{teamOne.map(p => chip(p, 'var(--primary, #1a1a1a)', 'white'))}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, borderBottom: '2px solid var(--muted)', paddingBottom: 4 }}>
                        {squadBlackLabel.trim() || 'Team 2'} ({teamTwo.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{teamTwo.map(p => chip(p, 'var(--muted)', 'white'))}</div>
                    </div>
                  </div>
                </>
              );
            })()}
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Every player needs a team, split evenly.</p>
          </div>

          <h2>Stages</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              Each stage is a block of rounds worth its own points-per-win — e.g. 5 rounds at 1pt, then 5 at 2pt, then 5 at 3pt.
            </p>
            {stageRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={row.label}
                  onChange={e => setStageRows(prev => prev.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))}
                  placeholder={`Stage ${i + 1}`}
                  aria-label={`Stage ${i + 1} name`}
                  style={{ flex: '1 1 140px', minHeight: 40 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  Rounds
                  <input
                    type="number"
                    min={1}
                    value={row.rounds}
                    onChange={e => setStageRows(prev => prev.map((r, idx) => (idx === i ? { ...r, rounds: Number(e.target.value) } : r)))}
                    style={{ width: 64 }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  Points/win
                  <input
                    type="number"
                    min={1}
                    value={row.pointsPerWin}
                    onChange={e => setStageRows(prev => prev.map((r, idx) => (idx === i ? { ...r, pointsPerWin: Number(e.target.value) } : r)))}
                    style={{ width: 64 }}
                  />
                </label>
                {stageRows.length > 1 && (
                  <button type="button" className="icon-btn" aria-label={`Remove ${row.label}`} onClick={() => setStageRows(prev => prev.filter((_, idx) => idx !== i))}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setStageRows(prev => [...prev, { label: `Stage ${prev.length + 1}`, rounds: 5, pointsPerWin: prev.length + 1 }])}
            >
              + Add Stage
            </button>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              Total rounds: {stageRows.reduce((sum, r) => sum + (Number.isFinite(r.rounds) ? r.rounds : 0), 0)}
            </p>
          </div>

          <h2>Rapid Fire Finale (optional)</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={enableRapidFire} onChange={e => setEnableRapidFire(e.target.checked)} />
              <span>Add a live Rapid Fire finale after the last round</span>
            </label>
            {enableRapidFire && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  Target points
                  <input type="number" min={1} value={rapidFireTarget} onChange={e => setRapidFireTarget(Number(e.target.value))} style={{ width: 70 }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  Bonus points
                  <input type="number" min={1} value={rapidFireBonus} onChange={e => setRapidFireBonus(Number(e.target.value))} style={{ width: 70 }} />
                </label>
              </div>
            )}
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Round pairings aren&apos;t generated automatically for this format — you&apos;ll enter each round&apos;s pairings by hand after setup.
          </p>
        </>
      )}

      {format === 'fixed_partners' && (
        <>
          <h2>Who Picks the Partners?</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={partnerMode === 'auto'} onChange={() => setPartnerMode('auto')} />
              <span>App decides (recommended)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={partnerMode === 'manual'} onChange={() => setPartnerMode('manual')} />
              <span>I&apos;ll pick partners myself</span>
            </label>
          </div>

          {partnerMode === 'manual' && (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>Tap a player, then tap their partner to pair them</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {names.map(n => n.trim()).map((name, playerIndex) => {
                  if (!name) return null;
                  const team = manualPartnerAssignment[playerIndex] ?? null;
                  const isPending = pendingPartnerIndex === playerIndex;
                  return (
                    <button
                      key={playerIndex}
                      type="button"
                      onClick={() => handlePartnerTap(playerIndex)}
                      style={{
                        minHeight: 44,
                        padding: '6px 14px',
                        borderRadius: 999,
                        border: isPending ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: team === null ? 'white' : `hsl(${(team * 47) % 360}, 55%, 45%)`,
                        color: team === null ? 'var(--foreground)' : 'white',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {name} {team !== null ? `— Team ${team + 1}` : isPending ? '— tap a partner' : ''}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Tap two players to pair them. Tap an already-paired player to unpair them. Every player needs exactly one partner.
              </p>
            </div>
          )}
        </>
      )}

      {(format === 'scramble' || format === 'squad_rivalry') && !skillBalanced && (
        <>
          <h2>Lock Partners (optional)</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Keep specific players partnered together all night — the rest still rotate normally.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={lockPickerA}
                onChange={e => setLockPickerA(e.target.value)}
                aria-label="First player to lock"
                style={{ minHeight: 40, padding: '6px 10px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8 }}
              >
                <option value="">Player A…</option>
                {trimmedNamesForLocks.filter(n => !lockedPlayers.has(n) || n === lockPickerA).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>+</span>
              <select
                value={lockPickerB}
                onChange={e => setLockPickerB(e.target.value)}
                aria-label="Second player to lock"
                style={{ minHeight: 40, padding: '6px 10px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8 }}
              >
                <option value="">Player B…</option>
                {trimmedNamesForLocks.filter(n => n !== lockPickerA && (!lockedPlayers.has(n) || n === lockPickerB)).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button type="button" className="btn-secondary" onClick={handleAddLock} disabled={!lockPickerA || !lockPickerB}>
                Lock
              </button>
            </div>
            {lockedPairs.length > 0 && (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lockedPairs.map(([a, b], i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <Lock size={14} /> {a} & {b}
                    <button type="button" className="text-link-btn" onClick={() => handleRemoveLock(i)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <h2>Court Numbers</h2>
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, minWidth: 0 }}>
        {courtLabels.map((label, i) => (
          <input
            key={i}
            value={label}
            onChange={e => updateCourtLabel(i, e.target.value)}
            placeholder={`Court ${i + 1}`}
            aria-label={`Court ${i + 1} number or name`}
            style={{ flex: '1 1 100px', minWidth: 0, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        ))}
      </div>

      {format !== 'court_blocks' && (
        <>
          <h2>Rounds</h2>
          <input
            type="number"
            value={roundCount || ''}
            onChange={e => setRoundCount(Number(e.target.value) || 0)}
            min={1}
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
          />
        </>
      )}

      <h2>Venue (optional)</h2>
      <input
        type="text"
        value={venue}
        onChange={e => setVenue(e.target.value)}
        placeholder="e.g. Oshiwara Sports Complex"
        aria-label="Venue, optional"
        style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: '100%', border: '1px solid var(--border)', borderRadius: 8, background: 'white', marginBottom: 16 }}
      />

      <h2>Start Time (optional)</h2>
      <input
        type="time"
        value={startTime}
        onChange={e => setStartTime(e.target.value)}
        aria-label="Session start time, optional"
        style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 140, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
      />
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
        Set this + minutes per round below to show real clock times on the schedule (e.g. 8:00–8:10 PM) instead of just round numbers.
      </p>

      <h2>Minutes per Round (optional)</h2>
      <input
        type="number"
        value={roundDurationMinutes}
        onChange={e => setRoundDurationMinutes(e.target.value)}
        min={1}
        placeholder="e.g. 10"
        aria-label="Minutes per round, optional"
        style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
      />

      {format === 'court_blocks' && (
        <>
          <h2>How Many Times Do You Swap?</h2>
          <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Number of swaps
              </label>
              <input
                type="number"
                value={swapCount || ''}
                onChange={e => setSwapCount(Number(e.target.value) || 0)}
                min={1}
                aria-label="Number of swaps"
                style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 80, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Rounds before each swap
              </label>
              <input
                type="number"
                value={roundsPerBlock || ''}
                onChange={e => setRoundsPerBlock(Number(e.target.value) || 0)}
                min={1}
                aria-label="Rounds per swap"
                style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 80, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
            = {roundsPerBlock * swapCount} rounds total, swapping courts {swapCount} time{swapCount === 1 ? '' : 's'}.
          </p>

          <h2>Who Picks the Groups?</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={assignmentMode === 'auto'} onChange={() => setAssignmentMode('auto')} />
              <span>App decides (recommended)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={assignmentMode === 'manual'} onChange={() => setAssignmentMode('manual')} />
              <span>I&apos;ll pick manually</span>
            </label>
          </div>

          {assignmentMode === 'manual' &&
            Array.from({ length: blockCount }, (_, blockIndex) => (
              <div key={blockIndex} className="card" style={{ marginTop: 12 }}>
                <strong>Swap {blockIndex + 1} — tap a player to cycle through courts</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {names.map(n => n.trim()).map((name, playerIndex) => {
                    if (!name) return null;
                    const courtIndex = manualBlocks[blockIndex]?.[playerIndex] ?? null;
                    return (
                      <button
                        key={playerIndex}
                        type="button"
                        onClick={() => cycleManualBlockPlayer(blockIndex, playerIndex)}
                        style={{
                          minHeight: 44,
                          padding: '6px 14px',
                          borderRadius: 999,
                          border: '1px solid var(--border)',
                          background: courtIndex === null ? 'white' : 'var(--primary)',
                          color: courtIndex === null ? 'var(--foreground)' : 'white',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {name}
                        {courtIndex !== null ? ` — Court ${courtLabels[courtIndex]}` : ''}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  Every player needs a court, at least 4 players per court.
                </p>
              </div>
            ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSubStep('players')}>
          ← Back
        </button>
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => setSubStep('cost')}>
          Next: Cost & Details
        </button>
      </div>
      </>
      )}

      {subStep === 'cost' && (
      <>
      <h2>Court & Ball Cost (optional)</h2>
      <div className="card" style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Court cost (₹)
          </label>
          <input
            type="number"
            value={courtCost}
            onChange={e => setCourtCost(e.target.value)}
            placeholder="e.g. 800"
            aria-label="Court cost"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 28px 10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Ball cost (₹)
          </label>
          <input
            type="number"
            value={ballCost}
            onChange={e => setBallCost(e.target.value)}
            aria-label="Ball cost"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 28px 10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -6, marginBottom: 16 }}>
        Leave court cost blank to skip dues tracking for this session. Split evenly across everyone playing.
      </p>

      {courtCost.trim() !== '' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Your UPI ID (optional — others pay you here)
          </label>
          <input
            type="text"
            value={bookerUpiVpa}
            onChange={e => setBookerUpiVpa(e.target.value)}
            placeholder="e.g. yourname@okhdfcbank"
            aria-label="Your UPI ID"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
          {bookerUpiVpa.trim() === '' && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Leave blank to use the club's default UPI ID (set in Club Settings), if any.</p>
          )}
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSubStep('format')}>
          ← Back
        </button>
        <button className="btn-primary" style={{ flex: 1 }} onClick={handleGenerate} disabled={submitting}>
          {submitting ? 'Generating…' : 'Generate Schedule'}
        </button>
      </div>
      </>
      )}
    </main>
  );
}
