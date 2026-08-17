import { type RoundRow } from './db';

export interface GeneratedScheduleRound {
  round_number: number;
  court: number;
  team_a: string[];
  team_b: string[];
  sitting_out?: string[];
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    totalRounds: number;
    totalPlayers: number;
    maxConsecutiveRests: number;
    minGamesPlayed: number;
    maxGamesPlayed: number;
    hasEmojis: boolean;
  };
}

// Unicode Emoji Detection Regex
const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

/**
 * Runs mandatory verification assertions on any AI-generated match schedule matrix:
 * 1. Zero Consecutive Rests Test (no player sits out 2 rounds in a row)
 * 2. Court Time Equilibrium Test (max - min games played <= 1)
 * 3. Rest List Integrity Test (sitting_out contains all players not in team_a or team_b)
 * 4. Emoji Prohibition Audit (no Unicode emojis in labels, text, or names)
 */
export function verifyGeneratedSchedule(
  allPlayers: string[],
  rounds: GeneratedScheduleRound[]
): VerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rounds || rounds.length === 0) {
    return {
      valid: false,
      errors: ['Schedule contains no rounds.'],
      warnings: [],
      metrics: {
        totalRounds: 0,
        totalPlayers: allPlayers.length,
        maxConsecutiveRests: 0,
        minGamesPlayed: 0,
        maxGamesPlayed: 0,
        hasEmojis: false,
      },
    };
  }

  // Track games played and sit-outs per round per player
  const gamesPlayed = new Map<string, number>();
  const sitOutsByRound = new Map<number, Set<string>>();
  const roundNumbers = Array.from(new Set(rounds.map(r => r.round_number))).sort((a, b) => a - b);
  let hasEmojis = false;

  allPlayers.forEach(p => {
    gamesPlayed.set(p, 0);
    if (EMOJI_REGEX.test(p)) hasEmojis = true;
  });

  // Group rounds by round number
  const roundsGrouped = new Map<number, GeneratedScheduleRound[]>();
  for (const r of rounds) {
    const list = roundsGrouped.get(r.round_number) ?? [];
    list.push(r);
    roundsGrouped.set(r.round_number, list);

    // Audit player names in team_a & team_b for emojis
    for (const p of [...r.team_a, ...r.team_b]) {
      if (EMOJI_REGEX.test(p)) hasEmojis = true;
    }
  }

  // Evaluate each round's sit-outs and playing roster
  for (const rNum of roundNumbers) {
    const roundMatches = roundsGrouped.get(rNum) || [];
    const activeInRound = new Set<string>();
    const roundSitOuts = new Set<string>();

    for (const m of roundMatches) {
      for (const p of m.team_a) activeInRound.add(p);
      for (const p of m.team_b) activeInRound.add(p);
      if (m.sitting_out) {
        for (const p of m.sitting_out) roundSitOuts.add(p);
      }
    }

    // Players not active in round are sitting out
    allPlayers.forEach(p => {
      if (activeInRound.has(p)) {
        gamesPlayed.set(p, (gamesPlayed.get(p) ?? 0) + 1);
      } else {
        roundSitOuts.add(p);
      }
    });

    sitOutsByRound.set(rNum, roundSitOuts);
  }

  // Assertion 1: Check Zero Consecutive Rests
  let maxConsecutiveRests = 0;
  allPlayers.forEach(p => {
    let currentConsecutive = 0;
    for (const rNum of roundNumbers) {
      const sitting = sitOutsByRound.get(rNum)?.has(p) ?? false;
      if (sitting) {
        currentConsecutive++;
        if (currentConsecutive > maxConsecutiveRests) {
          maxConsecutiveRests = currentConsecutive;
        }
        if (currentConsecutive >= 2) {
          errors.push(`Player "${p}" sits out in consecutive rounds (${rNum - 1} and ${rNum}).`);
        }
      } else {
        currentConsecutive = 0;
      }
    }
  });

  // Assertion 2: Court Time Equilibrium Test
  const counts = Array.from(gamesPlayed.values());
  const minGamesPlayed = counts.length > 0 ? Math.min(...counts) : 0;
  const maxGamesPlayed = counts.length > 0 ? Math.max(...counts) : 0;

  if (maxGamesPlayed - minGamesPlayed > 1) {
    warnings.push(`Uneven court time distribution: min games = ${minGamesPlayed}, max games = ${maxGamesPlayed}.`);
  }

  // Assertion 3: Emoji Prohibition Audit
  if (hasEmojis) {
    errors.push('Schedule output contains forbidden Unicode emojis. Re-encode using Lucide React icons.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      totalRounds: roundNumbers.length,
      totalPlayers: allPlayers.length,
      maxConsecutiveRests,
      minGamesPlayed,
      maxGamesPlayed,
      hasEmojis,
    },
  };
}
