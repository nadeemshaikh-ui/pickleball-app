import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables
const envContent = fs.readFileSync('C:\\Users\\Nadeem\\Documents\\pickleball-app\\.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > -1) {
    const k = l.substring(0, idx).trim();
    let v = l.substring(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

const sessionId = 'hotshot_session_thursday';

async function auditTournament() {
  console.log("=================== AUDITING SCHEDULE FOR THURSDAY ===================");
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_number', { ascending: true }).order('court', { ascending: true });

  if (!session || !rounds || rounds.length === 0) {
    console.error("❌ Session or Rounds not found in database!");
    return;
  }

  console.log(`✅ Loaded Session: "${session.group_name}"`);
  console.log(`✅ Loaded Rounds count: ${rounds.length} (8 Rounds across 3 courts)`);

  const playerRoundCounts = {};
  const consecutiveRests = {};
  const partnerships = {};
  const courtOccupancy = {}; // To verify "no player can play on two courts in the same round"

  // Initialize player tracking structures
  session.players.forEach(p => {
    playerRoundCounts[p] = 0;
    consecutiveRests[p] = 0;
  });

  // Group rounds by round number
  const roundMap = {};
  rounds.forEach(r => {
    if (!roundMap[r.round_number]) {
      roundMap[r.round_number] = [];
    }
    roundMap[r.round_number].push(r);
  });

  let doubleBookingCount = 0;
  let consecutiveRestCount = 0;
  let invalidPartnerCount = 0;

  for (let rNum = 1; rNum <= 8; rNum++) {
    const roundRows = roundMap[rNum] || [];
    const activePlayersThisRound = [];
    
    roundRows.forEach(c => {
      const active = [...c.team_a, ...c.team_b];
      active.forEach(p => {
        if (activePlayersThisRound.includes(p)) {
          console.log(`❌ ERROR: Player "${p}" is double-booked on multiple courts in Round ${rNum}!`);
          doubleBookingCount++;
        }
        activePlayersThisRound.push(p);
        playerRoundCounts[p]++;
      });

      // Track partnerships
      const teamAPair = c.team_a.sort().join(" & ");
      const teamBPair = c.team_b.sort().join(" & ");
      partnerships[teamAPair] = (partnerships[teamAPair] || 0) + 1;
      partnerships[teamBPair] = (partnerships[teamBPair] || 0) + 1;
    });

    // Check who was resting
    const resting = session.players.filter(p => !activePlayersThisRound.includes(p));
    
    // Check for consecutive rests
    session.players.forEach(p => {
      if (resting.includes(p)) {
        consecutiveRests[p]++;
        if (consecutiveRests[p] > 1) {
          console.log(`❌ ERROR: Player "${p}" has consecutive rests (Round ${rNum - 1} and Round ${rNum})!`);
          consecutiveRestCount++;
        }
      } else {
        consecutiveRests[p] = 0;
      }
    });
  }

  // Print results
  console.log("\n=== INDIVIDUAL PLAY STATISTICS ===");
  session.players.forEach(p => {
    console.log(`Player: ${p.padEnd(10)} | Matches Scheduled: ${playerRoundCounts[p]} / 8 rounds`);
  });

  console.log("\n=== PARTNERSHIP REPETITIONS ===");
  Object.keys(partnerships).forEach(pair => {
    if (partnerships[pair] > 1) {
      console.log(`⚠️ Partnership repeated: ${pair} played together ${partnerships[pair]} times.`);
    }
  });

  console.log("\n=== AUDIT SUMMARY ===");
  console.log(`1. Double-booking check: ${doubleBookingCount === 0 ? "PASSED ✅" : `FAILED ❌ (${doubleBookingCount} violations)`}`);
  console.log(`2. Consecutive rest check: ${consecutiveRestCount === 0 ? "PASSED ✅" : `FAILED ❌ (${consecutiveRestCount} violations)`}`);
  console.log(`3. Target play rounds verification (6 games per player):`);
  let playsVerification = true;
  session.players.forEach(p => {
    if (playerRoundCounts[p] !== 6) {
      console.log(`   ❌ Warning: ${p} plays ${playerRoundCounts[p]} games (Expected: 6)`);
      playsVerification = false;
    }
  });
  if (playsVerification) console.log("   PASSED ✅ All players play exactly 6 matches!");

}

auditTournament().catch(console.error);
