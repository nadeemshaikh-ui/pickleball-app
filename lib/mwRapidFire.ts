export type Team = 'MW' | 'SVKM';

export interface PairMatchup {
  id: number;
  pairNumber: number;
  mwPair: string;
  svkmPair: string;
}

export interface MatchLogEntry {
  id: string;
  pointNumber: number;
  scoringTeam: Team;
  scoringTeamName: string;
  pairMatchup: PairMatchup;
  mwScoreAfter: number;
  svkmScoreAfter: number;
  timestamp: string;
}

export interface RapidFireState {
  mwScore: number;
  svkmScore: number;
  history: Array<{ mwScore: number; svkmScore: number; log: MatchLogEntry[] }>;
  log: MatchLogEntry[];
  isFinished: boolean;
  winner: Team | null;
}

export const PAIR_MATCHUPS: PairMatchup[] = [
  { id: 0, pairNumber: 1, mwPair: 'KARAN & GOPAL', svkmPair: '12 & TEJAS' },
  { id: 1, pairNumber: 2, mwPair: 'HEMAL & TUSHAR', svkmPair: 'ANKIT & RAHIL' },
  { id: 2, pairNumber: 3, mwPair: 'MBS & AMBRESH', svkmPair: 'GAURAV & VICKY' },
  { id: 3, pairNumber: 4, mwPair: 'SAURABH & SAGAR', svkmPair: 'DD & SMIT' },
  { id: 4, pairNumber: 5, mwPair: 'KETAN & CHIRAG', svkmPair: 'NEEL & MRUGESH' },
  { id: 5, pairNumber: 6, mwPair: 'HITEN & AMIT', svkmPair: 'ANISH & HARSH' },
];

export const TEAM_NAMES: Record<Team, string> = {
  MW: 'MW MAVERICKS',
  SVKM: 'SVKM CHALLENGERS',
};

/**
 * Calculates the current rotation pair index based on total points scored.
 * Formula: Math.floor((mwScore + svkmScore) / 3) % 6
 */
export function getRotationIndex(mwScore: number, svkmScore: number): number {
  const totalPoints = Math.max(0, mwScore) + Math.max(0, svkmScore);
  return Math.floor(totalPoints / 3) % 6;
}

/**
 * Returns the current active pair on court based on total points.
 */
export function getActivePair(mwScore: number, svkmScore: number): PairMatchup {
  const index = getRotationIndex(mwScore, svkmScore);
  return PAIR_MATCHUPS[index];
}

/**
 * Returns the next pair on deck waiting to enter court.
 */
export function getNextPairOnDeck(mwScore: number, svkmScore: number): PairMatchup {
  const currentIndex = getRotationIndex(mwScore, svkmScore);
  const nextIndex = (currentIndex + 1) % 6;
  return PAIR_MATCHUPS[nextIndex];
}

/**
 * Determines match winner according to Grand Finale rules:
 * - Race to 31 points.
 * - At 30-30 deuce or higher, must win by at least 2 points (e.g. 32-30, 33-31).
 */
export function checkWinner(mwScore: number, svkmScore: number): Team | null {
  // Deuce condition: both teams have at least 30 points
  if (mwScore >= 30 && svkmScore >= 30) {
    if (mwScore >= svkmScore + 2) return 'MW';
    if (svkmScore >= mwScore + 2) return 'SVKM';
    return null;
  }

  // Standard target condition (before 30-30 deuce reached)
  if (mwScore >= 31 && mwScore > svkmScore) return 'MW';
  if (svkmScore >= 31 && svkmScore > mwScore) return 'SVKM';

  return null;
}

/**
 * Check if the match is in a deuce state (30-30 or tied at 30+).
 */
export function isDeuceState(mwScore: number, svkmScore: number): boolean {
  return mwScore >= 30 && svkmScore >= 30;
}

/**
 * Initial match state creation helper.
 */
export function createInitialState(): RapidFireState {
  return {
    mwScore: 0,
    svkmScore: 0,
    history: [],
    log: [],
    isFinished: false,
    winner: null,
  };
}

/**
 * Pure state transition function to add a point to a team.
 */
export function addPoint(state: RapidFireState, scoringTeam: Team): RapidFireState {
  if (state.isFinished) {
    return state;
  }

  const currentPair = getActivePair(state.mwScore, state.svkmScore);
  const newMwScore = scoringTeam === 'MW' ? state.mwScore + 1 : state.mwScore;
  const newSvkmScore = scoringTeam === 'SVKM' ? state.svkmScore + 1 : state.svkmScore;

  const winner = checkWinner(newMwScore, newSvkmScore);
  const isFinished = winner !== null;

  const totalPoints = newMwScore + newSvkmScore;
  const newLogEntry: MatchLogEntry = {
    id: `${totalPoints}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    pointNumber: totalPoints,
    scoringTeam,
    scoringTeamName: TEAM_NAMES[scoringTeam],
    pairMatchup: currentPair,
    mwScoreAfter: newMwScore,
    svkmScoreAfter: newSvkmScore,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };

  return {
    mwScore: newMwScore,
    svkmScore: newSvkmScore,
    history: [
      ...state.history,
      {
        mwScore: state.mwScore,
        svkmScore: state.svkmScore,
        log: [...state.log],
      },
    ],
    log: [newLogEntry, ...state.log],
    isFinished,
    winner,
  };
}

/**
 * Pure state transition function for 1-tap Undo.
 */
export function undoPoint(state: RapidFireState): RapidFireState {
  if (state.history.length === 0) {
    return state;
  }

  const previous = state.history[state.history.length - 1];
  const remainingHistory = state.history.slice(0, -1);
  const winner = checkWinner(previous.mwScore, previous.svkmScore);

  return {
    mwScore: previous.mwScore,
    svkmScore: previous.svkmScore,
    history: remainingHistory,
    log: previous.log,
    isFinished: winner !== null,
    winner,
  };
}
