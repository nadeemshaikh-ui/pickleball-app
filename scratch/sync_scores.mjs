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

// Scores parsed from the hand-written scorecard (Round 1 to 8 across Court 1, 2, and 3)
const scoredMatches = [
  // Round 1
  { round: 1, court: 1, score_a: 14, score_b: 15 },
  { round: 1, court: 2, score_a: 10, score_b: 15 },
  { round: 1, court: 3, score_a: 15, score_b: 11 }, // Ankit -> Rizwaan

  // Round 2
  { round: 2, court: 1, score_a: 15, score_b: 12 }, // Ankit -> Rizwaan
  { round: 2, court: 2, score_a: 7, score_b: 15 },
  { round: 2, court: 3, score_a: 15, score_b: 11 },

  // Round 3
  { round: 3, court: 1, score_a: 9, score_b: 15 },
  { round: 3, court: 2, score_a: 15, score_b: 14 }, // Ankit -> Rizwaan
  { round: 3, court: 3, score_a: 14, score_b: 15 },

  // Round 4
  { round: 4, court: 1, score_a: 15, score_b: 11 },
  { round: 4, court: 2, score_a: 12, score_b: 15 },
  { round: 4, court: 3, score_a: 15, score_b: 13 },

  // Round 5
  { round: 5, court: 1, score_a: 15, score_b: 14 },
  { round: 5, court: 2, score_a: 15, score_b: 13 },
  { round: 5, court: 3, score_a: 15, score_b: 14 }, // Ankit -> Rizwaan

  // Round 6
  { round: 6, court: 1, score_a: 15, score_b: 11 }, // Ankit -> Rizwaan
  { round: 6, court: 2, score_a: 15, score_b: 14 },
  { round: 6, court: 3, score_a: 8, score_b: 15 },

  // Round 7
  { round: 7, court: 1, score_a: 15, score_b: 12 }, // Written as "15 / 12" on image
  { round: 7, court: 2, score_a: 15, score_b: 10 },
  { round: 7, court: 3, score_a: 10, score_b: 15 },

  // Round 8
  { round: 8, court: 1, score_a: 15, score_b: 12 },
  { round: 8, court: 2, score_a: 11, score_b: 15 }, // Ankit -> Rizwaan
  { round: 8, court: 3, score_a: 13, score_b: 15 }
];

async function syncAndCalc() {
  console.log("1. Fetching session configuration...");
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  const { data: dbRounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId);

  if (!session || !dbRounds) {
    console.error("Session or rounds not found in DB.");
    return;
  }

  console.log("2. Syncing scores into database...");
  for (const match of scoredMatches) {
    const dbRound = dbRounds.find(r => r.round_number === match.round && r.court === match.court);
    if (dbRound) {
      await supabase
        .from('rounds')
        .update({
          score_a: match.score_a,
          score_b: match.score_b
        })
        .eq('id', dbRound.id);
    }
  }
  console.log("✅ Database synced successfully!");

  // Compute Standings
  const teamStats = {
    'Team 1 (Samosa Smashers)': { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, matches: 0 },
    'Team 2 (Papad Punishers)': { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, matches: 0 }
  };

  const isTeam1 = (player) => ['Sumit', 'Hemal', 'Miten', 'Arif', 'Viki', 'Ansh', 'Shah', 'Nadeem'].includes(player);

  dbRounds.forEach(r => {
    // Merge database details with our local scores
    const localMatch = scoredMatches.find(m => m.round === r.round_number && m.court === r.court);
    if (!localMatch) return;

    const scoreA = localMatch.score_a;
    const scoreB = localMatch.score_b;

    const isA_Team1 = isTeam1(r.team_a[0]);
    const teamAName = isA_Team1 ? 'Team 1 (Samosa Smashers)' : 'Team 2 (Papad Punishers)';
    const teamBName = isA_Team1 ? 'Team 2 (Papad Punishers)' : 'Team 1 (Samosa Smashers)';

    teamStats[teamAName].matches++;
    teamStats[teamBName].matches++;
    teamStats[teamAName].pointsFor += scoreA;
    teamStats[teamAName].pointsAgainst += scoreB;
    teamStats[teamBName].pointsFor += scoreB;
    teamStats[teamBName].pointsAgainst += scoreA;

    if (scoreA > scoreB) {
      teamStats[teamAName].wins++;
      teamStats[teamBName].losses++;
    } else {
      teamStats[teamBName].wins++;
      teamStats[teamAName].losses++;
    }
  });

  console.log('\n=================== CALCULATED STANDINGS ===================');
  Object.keys(teamStats).forEach(name => {
    const t = teamStats[name];
    const diff = t.pointsFor - t.pointsAgainst;
    console.log(`- ${name.padEnd(26)} | Wins: ${t.wins} | Losses: ${t.losses} | Diff: ${diff > 0 ? '+' + diff : diff} (${t.pointsFor}-${t.pointsAgainst})`);
  });
  console.log('============================================================\n');
}

syncAndCalc().catch(console.error);
