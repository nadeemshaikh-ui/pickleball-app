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

async function run() {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_number', { ascending: true }).order('court', { ascending: true });
  
  const finished = rounds.filter(r => r.score_a !== null && r.score_b !== null);
  console.log(`=== SESSION STANDINGS CHECK (Session: ${session.group_name}) ===`);
  console.log(`Total Rounds in DB: ${rounds.length} | Scored: ${finished.length}\n`);

  // Track Team Statistics
  const teamStats = {
    'Team 1 (Samosa Smashers)': { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, matches: 0 },
    'Team 2 (Papad Punishers)': { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, matches: 0 }
  };

  // Team 1 players: 'Sumit', 'Hemal', 'Miten', 'Arif', 'Viki', 'Ansh', 'Shah', 'Nadeem'
  // Team 2 players: 'Ankit' (Rizwaan), 'Gopal', 'Amresh', 'Karan', 'Sid G', 'Sid K', 'Deep', 'Gulshan'
  const isTeam1 = (player) => ['Sumit', 'Hemal', 'Miten', 'Arif', 'Viki', 'Ansh', 'Shah', 'Nadeem'].includes(player);

  finished.forEach(r => {
    const playerOnA = r.team_a[0];
    const playerOnB = r.team_b[0];

    const isA_Team1 = isTeam1(playerOnA);
    const isB_Team1 = isTeam1(playerOnB);

    // Skip if players from same team are matched up or something is wrong
    if (isA_Team1 === isB_Team1) return; 

    const teamAName = isA_Team1 ? 'Team 1 (Samosa Smashers)' : 'Team 2 (Papad Punishers)';
    const teamBName = isB_Team1 ? 'Team 1 (Samosa Smashers)' : 'Team 2 (Papad Punishers)';

    teamStats[teamAName].matches++;
    teamStats[teamBName].matches++;
    teamStats[teamAName].pointsFor += r.score_a;
    teamStats[teamAName].pointsAgainst += r.score_b;
    teamStats[teamBName].pointsFor += r.score_b;
    teamStats[teamBName].pointsAgainst += r.score_a;

    if (r.score_a > r.score_b) {
      teamStats[teamAName].wins++;
      teamStats[teamBName].losses++;
    } else {
      teamStats[teamBName].wins++;
      teamStats[teamAName].losses++;
    }
  });

  console.log('TEAM STANDINGS:');
  Object.keys(teamStats).forEach(name => {
    const t = teamStats[name];
    const diff = t.pointsFor - t.pointsAgainst;
    console.log(`- ${name.padEnd(26)} | Matches Played: ${t.matches} | Record: ${t.wins}W - ${t.losses}L | Diff: ${diff > 0 ? '+' + diff : diff} (${t.pointsFor}-${t.pointsAgainst})`);
  });
}

run();
