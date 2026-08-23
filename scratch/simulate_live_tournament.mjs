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

async function simulateTournament() {
  console.log("=================== TOURNAMENT SIMULATION START ===================");

  // 1. Fetch rounds for this session
  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true })
    .order('court', { ascending: true });

  if (rErr || !rounds || rounds.length === 0) {
    console.error("❌ Failed to fetch rounds:", rErr || "No rounds found.");
    return;
  }

  console.log(`✅ Loaded ${rounds.length} rounds for league phase (Rounds 1 to 8).`);

  // 2. Simulate scores for Rounds 1 to 8 (League Phase)
  const simulatedScores = [
    [11, 9], [11, 7], [11, 5], [11, 8], [11, 6], [11, 4],
    [11, 9], [11, 8], [11, 7], [11, 5], [11, 3], [11, 6]
  ];

  console.log("⚡ Logging simulated scores for all league phase rounds...");
  for (const round of rounds) {
    const scoreIdx = Math.floor(Math.random() * simulatedScores.length);
    const score = simulatedScores[scoreIdx];
    
    const aWins = Math.random() > 0.5;
    const scoreA = aWins ? score[0] : score[1];
    const scoreB = aWins ? score[1] : score[0];

    const { error: uErr } = await supabase
      .from('rounds')
      .update({ score_a: scoreA, score_b: scoreB })
      .eq('id', round.id);

    if (uErr) {
      console.error(`❌ Failed to update score for Round ${round.round_number} Court ${round.court}:`, uErr.message);
      return;
    }
  }

  console.log("✅ All 24 league match scores successfully logged!");

  // 3. Query the session details and calculate player rankings
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  const { data: updatedRounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId);

  console.log("\n=================== VERIFYING STANDINGS AND ELO MATH ===================");
  
  const squad1Players = ['Sumit', 'Hemal', 'Miten', 'Arif', 'Viki', 'Ansh', 'Shah', 'Nadeem'];
  const squad2Players = ['Ankit', 'Gopal', 'Amresh', 'Karan', 'Sid G', 'Sid K', 'Deep', 'Gulshan'];

  const playerStats = {};
  [...squad1Players, ...squad2Players].forEach(p => {
    playerStats[p] = { name: p, wins: 0, matches: 0, diff: 0 };
  });

  updatedRounds.forEach(r => {
    if (r.score_a !== null && r.score_b !== null) {
      const aWon = r.score_a > r.score_b;
      r.team_a.forEach(p => {
        if (playerStats[p]) {
          playerStats[p].matches++;
          playerStats[p].diff += (r.score_a - r.score_b);
          if (aWon) playerStats[p].wins++;
        }
      });
      r.team_b.forEach(p => {
        if (playerStats[p]) {
          playerStats[p].matches++;
          playerStats[p].diff += (r.score_b - r.score_a);
          if (!aWon) playerStats[p].wins++;
        }
      });
    }
  });

  console.log("\n=== STANDINGS MATRIX FOR HOUR 1 & HOUR 2 ===");
  Object.values(playerStats)
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff)
    .forEach(s => {
      console.log(`Player: ${s.name.padEnd(10)} | Wins: ${s.wins} / ${s.matches} | Points Diff: ${s.diff >= 0 ? '+' : ''}${s.diff}`);
    });

  console.log("\n=================== SIMULATION COMPLETED SUCCESSFULLY ===================");
}

simulateTournament().catch(console.error);
