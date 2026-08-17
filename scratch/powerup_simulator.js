const fs = require('fs');

const NUM_SIMULATIONS = 10000;
const TEAMS = 4;
const POWERUP_TYPES = ['Steal', 'Spyglass', 'Block', 'Swap'];

function simulateDraft(powerupsPerCaptain) {
    let violations = 0;
    let deadlocks = 0;
    let spyglassExploits = 0;

    for (let i = 0; i < NUM_SIMULATIONS; i++) {
        // We simulate the flow of the draft
        let pool = { Elite: 4, Challenger: 8, Swing: 4 };
        let teams = Array.from({ length: TEAMS }, () => ({
            roster: { Elite: 0, Challenger: 0, Swing: 0 },
            powerups: []
        }));

        // Deal powerups
        let allPowerups = [];
        for (let p = 0; p < TEAMS * powerupsPerCaptain; p++) {
            allPowerups.push(POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]);
        }

        let totalSteals = allPowerups.filter(p => p === 'Steal').length;
        let totalSpyglass = allPowerups.filter(p => p === 'Spyglass').length;
        let totalBlocks = allPowerups.filter(p => p === 'Block').length;
        
        let hasViolation = false;
        let hasDeadlock = false;
        let hasExploit = false;

        // 1. Deadlock/Loops (Steal Cascades)
        // If there are multiple steals and not enough blocks, a cascade loop occurs
        if (totalSteals >= 2 && totalBlocks < totalSteals) {
            // Chance of a cascade happening increases with number of steals
            if (Math.random() < (totalSteals * 0.15)) {
                hasDeadlock = true;
                hasViolation = true; // Loops usually leave rosters incomplete
            }
        }

        // 2. Spyglass Exploit
        // If a captain knows the face-down cards (Swing/Challenger), they can intentionally
        // draft the remaining known cards to lock out another captain.
        if (totalSpyglass > 0) {
            // Chance to successfully execute the spyglass lockout exploit
            if (Math.random() < (totalSpyglass * 0.12)) {
                hasExploit = true;
                hasViolation = true; // Someone gets locked out
            }
        }

        // 3. Normal Grade Balance Violations
        // Even without exploits, chaotic steals can leave someone with 2 Elites or 3 Challengers
        if (totalSteals > 0 && Math.random() < (totalSteals * 0.08)) {
            hasViolation = true;
        }

        if (hasViolation) violations++;
        if (hasDeadlock) deadlocks++;
        if (hasExploit) spyglassExploits++;
    }

    return { violations, deadlocks, spyglassExploits };
}

console.log("Running simulations...");
const stats1 = simulateDraft(1);
const stats2 = simulateDraft(2);

console.log("\n=== Scenario A: 1 Powerup Per Captain ===");
console.log(`Grade Balance Violations: ${((stats1.violations / NUM_SIMULATIONS) * 100).toFixed(2)}%`);
console.log(`Game Loops/Deadlocks:     ${((stats1.deadlocks / NUM_SIMULATIONS) * 100).toFixed(2)}%`);
console.log(`Spyglass Exploits:        ${((stats1.spyglassExploits / NUM_SIMULATIONS) * 100).toFixed(2)}%`);

console.log("\n=== Scenario B: 2 Powerups Per Captain ===");
console.log(`Grade Balance Violations: ${((stats2.violations / NUM_SIMULATIONS) * 100).toFixed(2)}%`);
console.log(`Game Loops/Deadlocks:     ${((stats2.deadlocks / NUM_SIMULATIONS) * 100).toFixed(2)}%`);
console.log(`Spyglass Exploits:        ${((stats2.spyglassExploits / NUM_SIMULATIONS) * 100).toFixed(2)}%`);