import { describe, it, expect } from 'vitest';
import {
  PAIR_MATCHUPS,
  getRotationIndex,
  getActivePair,
  getNextPairOnDeck,
  checkWinner,
  isDeuceState,
  createInitialState,
  addPoint,
  undoPoint,
} from './mwRapidFire';

describe('MW Mavericks Rapid Fire Grand Finale Engine', () => {
  describe('Requirement 3 & 4: 3-Point Pair Rotations & Exact Matchups', () => {
    it('should match the exact pair matchups order from flyer', () => {
      expect(PAIR_MATCHUPS).toEqual([
        { id: 0, pairNumber: 1, mwPair: 'KARAN & GOPAL', svkmPair: '12 & TEJAS' },
        { id: 1, pairNumber: 2, mwPair: 'HEMAL & TUSHAR', svkmPair: 'ANKIT & RAHIL' },
        { id: 2, pairNumber: 3, mwPair: 'MBS & AMBRESH', svkmPair: 'GAURAV & VICKY' },
        { id: 3, pairNumber: 4, mwPair: 'SAURABH & SAGAR', svkmPair: 'DD & SMIT' },
        { id: 4, pairNumber: 5, mwPair: 'KETAN & CHIRAG', svkmPair: 'NEEL & MRUGESH' },
        { id: 5, pairNumber: 6, mwPair: 'HITEN & AMIT', svkmPair: 'ANISH & HARSH' },
      ]);
    });

    it('should calculate rotation index using Math.floor((mw + svkm) / 3) % 6', () => {
      // 0 to 2 points: Pair 1 (Index 0)
      expect(getRotationIndex(0, 0)).toBe(0);
      expect(getRotationIndex(1, 0)).toBe(0);
      expect(getRotationIndex(1, 1)).toBe(0);

      // 3 to 5 points: Pair 2 (Index 1)
      expect(getRotationIndex(2, 1)).toBe(1);
      expect(getRotationIndex(3, 1)).toBe(1);
      expect(getRotationIndex(3, 2)).toBe(1);

      // 6 to 8 points: Pair 3 (Index 2)
      expect(getRotationIndex(4, 2)).toBe(2);

      // 9 to 11 points: Pair 4 (Index 3)
      expect(getRotationIndex(5, 5)).toBe(3);

      // 12 to 14 points: Pair 5 (Index 4)
      expect(getRotationIndex(7, 6)).toBe(4);

      // 15 to 17 points: Pair 6 (Index 5)
      expect(getRotationIndex(8, 8)).toBe(5);

      // 18 points: Loops back to Pair 1 (Index 0)
      expect(getRotationIndex(9, 9)).toBe(0);
      expect(getRotationIndex(10, 8)).toBe(0);
    });

    it('should return active pair and next pair on deck accurately', () => {
      // At score 0-0, active = Pair 1, deck = Pair 2
      expect(getActivePair(0, 0).mwPair).toBe('KARAN & GOPAL');
      expect(getNextPairOnDeck(0, 0).mwPair).toBe('HEMAL & TUSHAR');

      // At total points 15 (Pair 6 active), next on deck should wrap around to Pair 1
      expect(getActivePair(8, 7).mwPair).toBe('HITEN & AMIT');
      expect(getNextPairOnDeck(8, 7).mwPair).toBe('KARAN & GOPAL');
    });
  });

  describe('Requirement 1: 31-Point Win Condition', () => {
    it('should declare MW Mavericks winner at 31-29', () => {
      expect(checkWinner(31, 29)).toBe('MW');
    });

    it('should declare SVKM Challengers winner at 25-31', () => {
      expect(checkWinner(25, 31)).toBe('SVKM');
    });

    it('should not declare winner at 30-29', () => {
      expect(checkWinner(30, 29)).toBeNull();
    });

    it('should stop accepting points once a winner is declared', () => {
      let state = createInitialState();
      // Simulate 30-29 MW
      state.mwScore = 30;
      state.svkmScore = 29;

      // Score 31st point for MW
      state = addPoint(state, 'MW');
      expect(state.mwScore).toBe(31);
      expect(state.isFinished).toBe(true);
      expect(state.winner).toBe('MW');

      // Further tap should not mutate score or log
      const scoreAfterExtraTap = addPoint(state, 'SVKM');
      expect(scoreAfterExtraTap.mwScore).toBe(31);
      expect(scoreAfterExtraTap.svkmScore).toBe(29);
      expect(scoreAfterExtraTap.log.length).toBe(state.log.length);
    });
  });

  describe('Requirement 2: Deuce & Win-by-2 Logic', () => {
    it('should identify deuce state when score is 30-30 or above', () => {
      expect(isDeuceState(29, 30)).toBe(false);
      expect(isDeuceState(30, 30)).toBe(true);
      expect(isDeuceState(31, 31)).toBe(true);
    });

    it('should not end match at 31-30 after reaching 30-30 deuce', () => {
      expect(checkWinner(31, 30)).toBeNull();
    });

    it('should declare MW winner at 32-30 deuce win', () => {
      expect(checkWinner(32, 30)).toBe('MW');
    });

    it('should handle extended deuce battles like 33-31 or 35-33', () => {
      expect(checkWinner(31, 32)).toBeNull();
      expect(checkWinner(31, 33)).toBe('SVKM');
      expect(checkWinner(34, 34)).toBeNull();
      expect(checkWinner(36, 34)).toBe('MW');
    });
  });

  describe('Requirement 5: 1-Tap Undo & State History', () => {
    it('should undo previous points cleanly and restore history', () => {
      let state = createInitialState();

      // Tap MW point
      state = addPoint(state, 'MW'); // 1-0
      expect(state.mwScore).toBe(1);
      expect(state.svkmScore).toBe(0);
      expect(state.log.length).toBe(1);

      // Tap SVKM point
      state = addPoint(state, 'SVKM'); // 1-1
      expect(state.mwScore).toBe(1);
      expect(state.svkmScore).toBe(1);
      expect(state.log.length).toBe(2);

      // Tap Undo -> should return to 1-0
      state = undoPoint(state);
      expect(state.mwScore).toBe(1);
      expect(state.svkmScore).toBe(0);
      expect(state.log.length).toBe(1);
      expect(state.log[0].scoringTeam).toBe('MW');

      // Tap Undo again -> should return to 0-0
      state = undoPoint(state);
      expect(state.mwScore).toBe(0);
      expect(state.svkmScore).toBe(0);
      expect(state.log.length).toBe(0);
    });

    it('should re-open match if winning point is undone', () => {
      let state = createInitialState();
      state.mwScore = 30;
      state.svkmScore = 30;

      state = addPoint(state, 'MW'); // 31-30 (deuce ongoing)
      expect(state.isFinished).toBe(false);

      state = addPoint(state, 'MW'); // 32-30 (MW wins!)
      expect(state.isFinished).toBe(true);
      expect(state.winner).toBe('MW');

      // Undo winning point
      state = undoPoint(state);
      expect(state.mwScore).toBe(31);
      expect(state.svkmScore).toBe(30);
      expect(state.isFinished).toBe(false);
      expect(state.winner).toBeNull();
    });

    it('should handle undo gracefully when history is empty', () => {
      const state = createInitialState();
      const undone = undoPoint(state);
      expect(undone).toEqual(state);
    });
  });
});
