import { describe, it, expect } from 'vitest';
import { parsePairingConstraints } from './aiPairing';

describe('parsePairingConstraints', () => {
  const players = ['Nadeem', 'Viki', 'Amresh', 'Sid', 'Karan', 'Gopal'];

  it('parses pairing with match count', () => {
    const res = parsePairingConstraints('Nadeem and Viki want to play together for 2 matches', players);
    expect(res.lockedPairs).toHaveLength(1);
    expect(res.lockedPairs[0]).toEqual({
      playerA: 'Nadeem',
      playerB: 'Viki',
      startRound: 1,
      endRound: 2,
    });
  });

  it('parses pairing with explicit round range', () => {
    const res = parsePairingConstraints('Keep Amresh and Sid paired in rounds 3 to 5', players);
    expect(res.lockedPairs).toHaveLength(1);
    expect(res.lockedPairs[0]).toEqual({
      playerA: 'Amresh',
      playerB: 'Sid',
      startRound: 3,
      endRound: 5,
    });
  });

  it('returns empty for unrecognized players', () => {
    const res = parsePairingConstraints('John and Bob for 3 matches', players);
    expect(res.lockedPairs).toHaveLength(0);
  });
});
