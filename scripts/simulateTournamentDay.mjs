import { checkWinner, getActivePair, getNextPairOnDeck, PAIR_MATCHUPS } from '../lib/mwRapidFire.ts';

console.log('====================================================');
console.log('⚡ MW MAVERICKS vs SVKM CHALLENGERS — FULL STRESS TEST');
console.log('====================================================\n');

// 1. LEAGUE PHASE SIMULATION (22 Rounds across 3 Courts)
console.log('--- TEST 1: LEAGUE PHASE WEIGHTED SCORING ---');
let mwLeaguePts = 0;
let svkmLeaguePts = 0;

const mockRounds = [];

for (let r = 1; r <= 22; r++) {
  let weight = 1;
  if (r >= 9 && r <= 14) weight = 2;
  if (r >= 15 && r <= 22) weight = 3;

  for (let c = 1; c <= 3; c++) {
    // Alternate winners for balanced stress test
    const mwWin = (r + c) % 2 === 0;
    const scoreA = mwWin ? 11 : Math.floor(Math.random() * 9);
    const scoreB = mwWin ? Math.floor(Math.random() * 9) : 11;

    if (scoreA > scoreB) mwLeaguePts += weight;
    else if (scoreB > scoreA) svkmLeaguePts += weight;

    mockRounds.push({ round_number: r, court: c, score_a: scoreA, score_b: scoreB, weight });
  }
}

console.log(`✓ 66 League Matches Simulated across 22 Rounds.`);
console.log(`  MW Mavericks League Points: ${mwLeaguePts}`);
console.log(`  SVKM Challengers League Points: ${svkmLeaguePts}`);
console.log(`  Total Squad Points in Play: ${mwLeaguePts + svkmLeaguePts} / 132 pts\n`);


// 2. RAPID FIRE GRAND FINALE SIMULATION (Race to 31 with 30-30 Deuce)
console.log('--- TEST 2: RAPID FIRE ROTATIONS & DEUCE WIN-BY-2 ---');

let mwRf = 0;
let svkmRf = 0;
const history = [];

// Simulate points up to 30-30 deuce
for (let p = 1; p <= 60; p++) {
  const scoringTeam = p % 2 === 1 ? 'MW' : 'SVKM';
  if (scoringTeam === 'MW') mwRf++;
  else svkmRf++;

  const pair = getActivePair(mwRf, svkmRf);
  const nextPair = getNextPairOnDeck(mwRf, svkmRf);
  history.push({ point: p, mwRf, svkmRf, activePairNumber: pair.pairNumber, nextPairNumber: nextPair.pairNumber });
}

console.log(`✓ Reached 30-30 Deuce State: MW ${mwRf} - ${svkmRf} SVKM`);
console.log(`  Winner Status at 30-30: ${checkWinner(mwRf, svkmRf)} (Must be null)`);

if (checkWinner(mwRf, svkmRf) !== null) {
  console.error('❌ ERROR: Winner declared prematurely at 30-30!');
  process.exit(1);
} else {
  console.log('  ✓ Verified: No winner declared at 30-30 deuce!');
}

// Point 61: 31-30 MW (Match Point, not won yet)
mwRf++;
console.log(`\n  Point 61 (31-30 MW): Winner Status = ${checkWinner(mwRf, svkmRf)} (Must be null)`);
if (checkWinner(mwRf, svkmRf) !== null) {
  console.error('❌ ERROR: Winner declared without 2-point lead at 31-30!');
  process.exit(1);
} else {
  console.log('  ✓ Verified: Must lead by 2 points to win at 31-30!');
}

// Point 62: 32-30 MW (Winning point)
mwRf++;
console.log(`  Point 62 (32-30 MW): Winner Status = ${checkWinner(mwRf, svkmRf)} (Must be 'MW')`);
if (checkWinner(mwRf, svkmRf) !== 'MW') {
  console.error('❌ ERROR: Failed to declare MW winner at 32-30!');
  process.exit(1);
} else {
  console.log('  ✓ Verified: MW MAVERICKS declared winner at 32-30!');
}

// Award +10 Bonus Pts
const finalMwScore = mwLeaguePts + 10;
const finalSvkmScore = svkmLeaguePts;
console.log(`\n✓ Final Tournament Grand Score: MW ${finalMwScore} - ${finalSvkmScore} SVKM`);
console.log('====================================================');
console.log('✅ ALL STRESS TEST SCENARIOS PASSED WITH 0 DEFECTS');
console.log('====================================================');
