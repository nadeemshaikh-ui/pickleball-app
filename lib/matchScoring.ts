// Team Championship match-ending rules — real tournaments use different
// conventions for how a match at 14-14 (or beyond) actually finishes, and
// this isn't optional/config-free: an organizer picks ONE rule for the
// whole tournament at setup, applied to all 15 rounds consistently.
export type MatchScoringRule = 'golden_14' | 'cap_16' | 'cap_17';

export const MATCH_SCORING_RULE_INFO: Record<MatchScoringRule, { label: string; description: string }> = {
  golden_14: {
    label: 'Golden point at 14-14 (to 15)',
    description: 'Race to 15. At 14-14, the next point wins outright — sudden death, no win-by-2 needed once tied at 14.',
  },
  cap_16: {
    label: 'Win by 2, capped at 16',
    description: 'Race to 15, must win by 2 (so 15-13 ends it). If tied 15-15, the match caps at 16 — next point at 15-15 wins outright.',
  },
  cap_17: {
    label: 'Win by 2, capped at 17',
    description: 'Race to 15, must win by 2. Win-by-2 continues through 16-14, but caps at 17 — if tied 16-16, the next point wins outright.',
  },
};

export function validateMatchScore(a: number, b: number, rule: MatchScoringRule): { valid: boolean; error?: string } {
  if (a === b) return { valid: false, error: "Pickleball games can't end in a tie — check the score." };
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);

  if (rule === 'golden_14') {
    // Winner is always exactly 15 — either a normal finish (loser 0-13) or
    // the golden point at 14-14 (loser exactly 14).
    if (hi !== 15 || lo < 0 || lo > 14) {
      return { valid: false, error: 'This tournament plays to 15 with a golden point at 14-14 — the winning score must be exactly 15, loser 0-14.' };
    }
    return { valid: true };
  }

  const cap = rule === 'cap_16' ? 16 : 17;
  // Normal win-by-2 finish below the cap: winner 15, margin >= 2.
  if (hi === 15 && hi - lo >= 2 && lo >= 0) return { valid: true };
  // Win-by-2 continues one point at a time up to (but not past) the cap:
  // e.g. cap_17 allows 16-14 (still win-by-2, hasn't hit the cap yet).
  if (hi > 15 && hi < cap && hi - lo === 2) return { valid: true };
  // At the cap, ANY winning margin is valid — the match ends the instant
  // either side reaches the cap, whether that's a clean 2-point win
  // (cap_17: 17-15) or a golden-point 1-point finish from a tied score
  // (cap_17: 17-16, reached from 16-16).
  if (hi === cap && lo <= cap - 1) return { valid: true };

  return {
    valid: false,
    error:
      rule === 'cap_16'
        ? 'This tournament plays to 15, win by 2, capped at 16 — valid finishes: 15-13 or closer, or 16-14/16-15.'
        : 'This tournament plays to 15, win by 2, capped at 17 — valid finishes: 15-13 or closer, 16-14, or 17-15/17-16.',
  };
}
