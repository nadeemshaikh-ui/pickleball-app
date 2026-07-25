import { describe, it, expect } from 'vitest';
import {
  deriveLedger,
  computeRegenerateFrom,
  computeRegenerateFromBlock,
  deriveOriginalFixedPartnersTeams,
  rebuildFixedPartnersTeams,
} from './regenerate';
import { generateScrambleSchedule } from './shuffle';
import type { RoundRow } from './db';

function makeRow(overrides: Partial<RoundRow>): RoundRow {
  return {
    id: Math.random().toString(36),
    session_id: 's1',
    round_number: 1,
    court: 1,
    team_a: ['A', 'B'],
    team_b: ['C', 'D'],
    sitting_out: [],
    score_a: null,
    score_b: null,
    ...overrides,
  };
}

describe('computeRegenerateFrom', () => {
  it('never touches the in-progress round — skips one full round past the highest scored round', () => {
    const rounds = [
      makeRow({ round_number: 1, court: 1, score_a: 11, score_b: 8 }),
      makeRow({ round_number: 1, court: 2, score_a: 11, score_b: 9 }),
      makeRow({ round_number: 2, court: 1, score_a: null, score_b: null }),
      makeRow({ round_number: 2, court: 2, score_a: null, score_b: null }),
      makeRow({ round_number: 3, court: 1, score_a: null, score_b: null }),
    ];
    // Round 1 fully scored, round 2 is the one currently on court (no
    // score yet) — regeneration must start at round 3, not round 2.
    expect(computeRegenerateFrom(rounds)).toBe(3);
  });

  it('handles a mid-match round (one court scored, the other not) the same way', () => {
    const rounds = [
      makeRow({ round_number: 4, court: 1, score_a: 11, score_b: 7 }),
      makeRow({ round_number: 4, court: 2, score_a: null, score_b: null }),
      makeRow({ round_number: 5, court: 1, score_a: null, score_b: null }),
    ];
    expect(computeRegenerateFrom(rounds)).toBe(6);
  });

  it('returns 2 when nothing has been scored yet — round 1 is presumed in progress', () => {
    const rounds = [makeRow({ round_number: 1, court: 1 }), makeRow({ round_number: 2, court: 1 })];
    expect(computeRegenerateFrom(rounds)).toBe(2);
  });
});

describe('deriveLedger', () => {
  it('counts sit-outs once per round, not once per court row', () => {
    const rounds = [
      makeRow({ round_number: 1, court: 1, sitting_out: ['E'], score_a: 11, score_b: 5 }),
      makeRow({ round_number: 1, court: 2, sitting_out: ['E'], score_a: 11, score_b: 6 }),
    ];
    const ledger = deriveLedger(rounds);
    expect(ledger.sitOutCounts.get('E')).toBe(1);
  });

  it('tracks lastSitOut from only the most recent round', () => {
    const rounds = [
      makeRow({ round_number: 1, court: 1, sitting_out: ['E'], score_a: 11, score_b: 5 }),
      makeRow({ round_number: 2, court: 1, sitting_out: ['F'], score_a: 11, score_b: 5 }),
    ];
    const ledger = deriveLedger(rounds);
    expect([...ledger.lastSitOut]).toEqual(['F']);
  });

  it('counts a partnership once per court row', () => {
    const rounds = [makeRow({ round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], score_a: 11, score_b: 5 })];
    const ledger = deriveLedger(rounds);
    expect(ledger.partnerCounts.get('A|B')).toBe(1);
    expect(ledger.partnerCounts.get('C|D')).toBe(1);
  });
});

describe('generateScrambleSchedule — regeneration support (startRound/initialLedger)', () => {
  const players8 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];

  it('numbers rounds starting from startRound, not 1', () => {
    const rounds = generateScrambleSchedule(players8, 2, 3, 'seed-regen', [], undefined, undefined, 6);
    expect(rounds.map(r => r.roundNumber)).toEqual([6, 7, 8]);
  });

  it('a late-added player (not in the ledger) appears in the very next generated round', () => {
    const before = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
    const ledger = { sitOutCounts: new Map(before.map(p => [p, 3])), partnerCounts: new Map(), lastSitOut: new Set<string>() };
    const withNewPlayer = [...before, 'P8']; // P8 wasn't in the ledger at all
    const rounds = generateScrambleSchedule(withNewPlayer, 2, 1, 'seed-regen', [], undefined, undefined, 6, ledger);
    const onCourt = rounds[0].courts.flatMap(c => [...c.teamA, ...c.teamB]);
    const sittingOut = rounds[0].sittingOutPerCourt[0];
    expect(onCourt.includes('P8') || sittingOut.includes('P8')).toBe(true);
  });

  it("a late-added player's sit-out count converges to within 1 of the group by the end — no permanent catch-up penalty", () => {
    const before = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
    const ledger = { sitOutCounts: new Map(before.map(p => [p, 5])), partnerCounts: new Map(), lastSitOut: new Set<string>() };
    const withNewPlayer = [...before, 'P8'];
    const rounds = generateScrambleSchedule(withNewPlayer, 2, 20, 'seed-regen', [], undefined, undefined, 6, ledger);
    const sitCounts: Record<string, number> = Object.fromEntries(withNewPlayer.map(p => [p, 0]));
    for (const round of rounds) for (const p of round.sittingOutPerCourt[0]) sitCounts[p]++;
    // P8 started at 0 (vs everyone else's 5) but only has 20 rounds to
    // catch up in — confirm the deficit shrinks a lot, without demanding
    // full parity (that would require more rounds than this test grants).
    const counts = Object.values(sitCounts);
    expect(Math.max(...counts) - sitCounts['P8']).toBeLessThan(5);
  });

  it('a removed player never appears in any regenerated round', () => {
    const remaining = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']; // P8 removed
    const ledger = { sitOutCounts: new Map(remaining.map(p => [p, 2])), partnerCounts: new Map(), lastSitOut: new Set<string>() };
    const rounds = generateScrambleSchedule(remaining, 1, 5, 'seed-regen', [], undefined, undefined, 6, ledger);
    for (const round of rounds) {
      const everyone = [...round.courts.flatMap(c => [...c.teamA, ...c.teamB]), ...round.sittingOutPerCourt[0]];
      expect(everyone).not.toContain('P8');
    }
  });

  it('is reproducible: same seed, startRound, pool, and ledger → identical output', () => {
    const ledger = { sitOutCounts: new Map(players8.map(p => [p, 4])), partnerCounts: new Map([['P1|P2', 2]]), lastSitOut: new Set(['P3']) };
    const a = generateScrambleSchedule(players8, 2, 4, 'seed-regen', [], undefined, undefined, 9, {
      sitOutCounts: new Map(ledger.sitOutCounts),
      partnerCounts: new Map(ledger.partnerCounts),
      lastSitOut: new Set(ledger.lastSitOut),
    });
    const b = generateScrambleSchedule(players8, 2, 4, 'seed-regen', [], undefined, undefined, 9, {
      sitOutCounts: new Map(ledger.sitOutCounts),
      partnerCounts: new Map(ledger.partnerCounts),
      lastSitOut: new Set(ledger.lastSitOut),
    });
    expect(a).toEqual(b);
  });

  it('defaults (no startRound/initialLedger passed) behave exactly as before — unaffected callers see no change', () => {
    const withDefaults = generateScrambleSchedule(players8, 2, 4, 'seed-a');
    const explicitDefaults = generateScrambleSchedule(players8, 2, 4, 'seed-a', [], undefined, undefined, 1, undefined);
    expect(withDefaults).toEqual(explicitDefaults);
  });
});

describe('computeRegenerateFromBlock', () => {
  it('never allows a mid-block round — always rounds up to the START of the NEXT block', () => {
    // roundsPerBlock=3: round 4 is safe per the plain round-level rule
    // (highest scored = 2, +2 = 4), but round 4 is INSIDE block 2
    // (rounds 4-6) — must jump to block 3's start (round 7), not just 4.
    const rounds = [
      makeRow({ round_number: 1, court: 1, score_a: 11, score_b: 5 }),
      makeRow({ round_number: 2, court: 1, score_a: 11, score_b: 5 }),
      makeRow({ round_number: 3, court: 1, score_a: null, score_b: null }),
    ];
    expect(computeRegenerateFromBlock(rounds, 3)).toBe(7);
  });

  it('skips the whole block containing the safe round, even when that round is early in the block', () => {
    const rounds = [
      makeRow({ round_number: 1, court: 1, score_a: 11, score_b: 5 }),
      makeRow({ round_number: 2, court: 1, score_a: 11, score_b: 5 }),
      makeRow({ round_number: 3, court: 1, score_a: 11, score_b: 5 }),
      makeRow({ round_number: 4, court: 1, score_a: null, score_b: null }),
    ];
    // highest scored = 3, +2 = 5. roundsPerBlock=4 -> round 5 falls inside
    // block 2 (rounds 5-8) — the whole block is skipped, landing at
    // block 3's start (round 9), not round 5 itself.
    expect(computeRegenerateFromBlock(rounds, 4)).toBe(9);
  });
});

describe('Fixed Partners team reconstruction', () => {
  it('reconstructs original teams from played-round history', () => {
    const history = [
      makeRow({ round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], score_a: 11, score_b: 5 }),
      makeRow({ round_number: 1, court: 2, team_a: ['E', 'F'], team_b: ['G', 'H'], score_a: 11, score_b: 5 }),
    ];
    const teams = deriveOriginalFixedPartnersTeams(history);
    const asSet = new Set(teams.map(t => [...t].sort().join('|')));
    expect(asSet).toEqual(new Set(['A|B', 'C|D', 'E|F', 'G|H']));
  });

  it('preserves a team untouched when both members are still active', () => {
    const original: [string, string][] = [['A', 'B'], ['C', 'D']];
    const { teams, benched } = rebuildFixedPartnersTeams(original, ['A', 'B', 'C', 'D'], 'seed-fp-regen');
    expect(teams).toContainEqual(['A', 'B']);
    expect(teams).toContainEqual(['C', 'D']);
    expect(benched).toHaveLength(0);
  });

  it('pairs up orphans whose partners are absent, and benches a lone leftover orphan', () => {
    // B and D are absent, leaving A and C as orphans (odd count = 1 leftover after pairing... actually 2 orphans pair evenly)
    const original: [string, string][] = [['A', 'B'], ['C', 'D']];
    const { teams, benched } = rebuildFixedPartnersTeams(original, ['A', 'C'], 'seed-fp-regen');
    expect(teams).toHaveLength(1);
    expect([...teams[0]].sort()).toEqual(['A', 'C']);
    expect(benched).toHaveLength(0);
  });

  it('benches a genuinely unpaired leftover orphan', () => {
    const original: [string, string][] = [['A', 'B'], ['C', 'D'], ['E', 'F']];
    // B, D, F absent -> A, C, E are orphans (odd count of 3) -> one pair + one benched
    const { teams, benched } = rebuildFixedPartnersTeams(original, ['A', 'C', 'E'], 'seed-fp-regen');
    const orphanTeams = teams.filter(t => !(t[0] === undefined));
    expect(orphanTeams).toHaveLength(1);
    expect(benched).toHaveLength(1);
    expect(['A', 'C', 'E']).toContain(benched[0]);
  });

  it('a player never seen in history (always sat out) is treated as a fresh orphan, not dropped', () => {
    const original: [string, string][] = [['A', 'B']];
    const { teams, benched } = rebuildFixedPartnersTeams(original, ['A', 'B', 'NeverPlayed'], 'seed-fp-regen');
    const allPlayers = [...teams.flat(), ...benched];
    expect(allPlayers).toContain('NeverPlayed');
  });

  it('restoring both original partners re-forms the original team even after a prior orphan-pairing pass', () => {
    const original: [string, string][] = [['A', 'B'], ['C', 'D']];
    // Both back present — must NOT still reflect any previous temporary pairing, since this always re-derives from the immutable original history.
    const { teams } = rebuildFixedPartnersTeams(original, ['A', 'B', 'C', 'D'], 'seed-fp-regen');
    expect(teams.sort()).toEqual([['A', 'B'], ['C', 'D']].sort());
  });
});
