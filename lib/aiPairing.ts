import { type LockedPair } from './shuffle';

export interface ParsePairingConstraintResult {
  lockedPairs: LockedPair[];
  summary: string;
}

/**
 * Parses natural language pairing preferences into structured LockedPair objects.
 * Examples:
 * - "Nadeem and Viki want to play together for 2 matches"
 * - "Keep Amresh and Sid paired in rounds 1 to 3"
 * - "Karan & Gopal locked for rounds 4-6"
 */
export function parsePairingConstraints(
  text: string,
  availablePlayers: string[],
  maxRounds = 15
): ParsePairingConstraintResult {
  if (!text || !text.trim()) {
    return { lockedPairs: [], summary: '' };
  }

  const lines = text.split(/\n|,|;/).map(l => l.trim()).filter(Boolean);
  const lockedPairs: LockedPair[] = [];
  const summaries: string[] = [];

  lines.forEach(line => {
    // Find matching player names in the line
    const matchedPlayers = availablePlayers.filter(p => 
      new RegExp(`\\b${p}\\b`, 'i').test(line)
    );

    if (matchedPlayers.length >= 2) {
      const p1 = matchedPlayers[0];
      const p2 = matchedPlayers[1];

      // Check for round range (e.g. "rounds 1 to 3" or "rounds 4-6" or "2 matches")
      let startRound = 1;
      let endRound = maxRounds;

      const rangeMatch = line.match(/rounds?\s*(\d+)\s*(?:to|-)\s*(\d+)/i);
      const countMatch = line.match(/(\d+)\s*(?:matches|rounds|games)/i);

      if (rangeMatch) {
        startRound = parseInt(rangeMatch[1], 10);
        endRound = parseInt(rangeMatch[2], 10);
      } else if (countMatch) {
        const count = parseInt(countMatch[1], 10);
        startRound = 1;
        endRound = Math.min(count, maxRounds);
      }

      lockedPairs.push({
        playerA: p1,
        playerB: p2,
        startRound,
        endRound,
      });

      summaries.push(`🔒 ${p1} & ${p2} (Rounds ${startRound}–${endRound})`);
    }
  });

  return {
    lockedPairs,
    summary: summaries.join(', '),
  };
}
