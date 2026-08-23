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
const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2'; // Hotshots Club ID

// Define schedule rounds from the image schedule
const scheduleData = [
  // Round 1
  { round: 1, time: '7:00–7:10 PM', court: 1, team_a: ['Sumit', 'Hemal'], team_b: ['Nadeem', 'Gopal'], sit: ['Arif', 'Viki', 'Deep', 'Amresh'] },
  { round: 1, time: '7:00–7:10 PM', court: 2, team_a: ['Shah', 'Karan'], team_b: ['Miten', 'Sid K'], sit: ['Arif', 'Viki', 'Deep', 'Amresh'] },
  { round: 1, time: '7:00–7:10 PM', court: 3, team_a: ['Ankit', 'Ansh'], team_b: ['Gulshan', 'Sid G'], sit: ['Arif', 'Viki', 'Deep', 'Amresh'] },
  
  // Round 2
  { round: 2, time: '7:10–7:20 PM', court: 1, team_a: ['Arif', 'Hemal'], team_b: ['Ankit', 'Shah'], sit: ['Ansh', 'Karan', 'Nadeem', 'Sid K'] },
  { round: 2, time: '7:10–7:20 PM', court: 2, team_a: ['Sumit', 'Viki'], team_b: ['Sid G', 'Amresh'], sit: ['Ansh', 'Karan', 'Nadeem', 'Sid K'] },
  { round: 2, time: '7:10–7:20 PM', court: 3, team_a: ['Miten', 'Gopal'], team_b: ['Deep', 'Gulshan'], sit: ['Ansh', 'Karan', 'Nadeem', 'Sid K'] },

  // Round 3
  { round: 3, time: '7:20–7:30 PM', court: 1, team_a: ['Arif', 'Viki'], team_b: ['Gopal', 'Sid K'], sit: ['Sumit', 'Hemal', 'Deep', 'Amresh'] },
  { round: 3, time: '7:20–7:30 PM', court: 2, team_a: ['Ankit', 'Ansh'], team_b: ['Miten', 'Nadeem'], sit: ['Sumit', 'Hemal', 'Deep', 'Amresh'] },
  { round: 3, time: '7:20–7:30 PM', court: 3, team_a: ['Shah', 'Karan'], team_b: ['Gulshan', 'Sid G'], sit: ['Sumit', 'Hemal', 'Deep', 'Amresh'] },

  // Round 4
  { round: 4, time: '7:30–7:40 PM', court: 1, team_a: ['Sumit', 'Arif'], team_b: ['Ansh', 'Karan'], sit: ['Ankit', 'Shah', 'Nadeem', 'Sid K'] },
  { round: 4, time: '7:30–7:40 PM', court: 2, team_a: ['Viki', 'Hemal'], team_b: ['Deep', 'Gulshan'], sit: ['Ankit', 'Shah', 'Nadeem', 'Sid K'] },
  { round: 4, time: '7:30–7:40 PM', court: 3, team_a: ['Miten', 'Gopal'], team_b: ['Sid G', 'Amresh'], sit: ['Ankit', 'Shah', 'Nadeem', 'Sid K'] },

  // Round 5
  { round: 5, time: '7:40–7:50 PM', court: 1, team_a: ['Arif', 'Viki'], team_b: ['Miten', 'Nadeem'], sit: ['Sumit', 'Hemal', 'Gulshan', 'Sid G'] },
  { round: 5, time: '7:40–7:50 PM', court: 2, team_a: ['Ansh', 'Shah'], team_b: ['Gopal', 'Sid K'], sit: ['Sumit', 'Hemal', 'Gulshan', 'Sid G'] },
  { round: 5, time: '7:40–7:50 PM', court: 3, team_a: ['Ankit', 'Karan'], team_b: ['Deep', 'Amresh'], sit: ['Sumit', 'Hemal', 'Gulshan', 'Sid G'] },

  // Round 6
  { round: 6, time: '7:50–8:00 PM', court: 1, team_a: ['Sumit', 'Viki'], team_b: ['Ankit', 'Shah'], sit: ['Ansh', 'Karan', 'Miten', 'Gopal'] },
  { round: 6, time: '7:50–8:00 PM', court: 2, team_a: ['Arif', 'Hemal'], team_b: ['Gulshan', 'Amresh'], sit: ['Ansh', 'Karan', 'Miten', 'Gopal'] },
  { round: 6, time: '7:50–8:00 PM', court: 3, team_a: ['Nadeem', 'Sid K'], team_b: ['Deep', 'Sid G'], sit: ['Ansh', 'Karan', 'Miten', 'Gopal'] },

  // Round 7
  { round: 7, time: '8:00–8:10 PM', court: 1, team_a: ['Viki', 'Hemal'], team_b: ['Ansh', 'Karan'], sit: ['Ankit', 'Shah', 'Miten', 'Gopal'] },
  { round: 7, time: '8:00–8:10 PM', court: 2, team_a: ['Sumit', 'Arif'], team_b: ['Deep', 'Sid G'], sit: ['Ankit', 'Shah', 'Miten', 'Gopal'] },
  { round: 7, time: '8:00–8:10 PM', court: 3, team_a: ['Nadeem', 'Sid K'], team_b: ['Gulshan', 'Amresh'], sit: ['Ankit', 'Shah', 'Miten', 'Gopal'] },

  // Round 8
  { round: 8, time: '8:10–8:20 PM', court: 1, team_a: ['Sumit', 'Hemal'], team_b: ['Miten', 'Sid K'], sit: ['Arif', 'Viki', 'Gulshan', 'Sid G'] },
  { round: 8, time: '8:10–8:20 PM', court: 2, team_a: ['Ankit', 'Karan'], team_b: ['Nadeem', 'Gopal'], sit: ['Arif', 'Viki', 'Gulshan', 'Sid G'] },
  { round: 8, time: '8:10–8:20 PM', court: 3, team_a: ['Shah', 'Ansh'], team_b: ['Deep', 'Amresh'], sit: ['Arif', 'Viki', 'Gulshan', 'Sid G'] }
];

const allPlayerNames = [
  'Viki', 'Sid', 'Deep', 'Yule', 'Shrinath', 'Sumit',
  'Hemal', 'Priyesh', 'Gulshan', 'Ankit', 'Nadeem', 'Karan',
  'Gopal', 'Shaan', 'Miten', 'Anosh', 'Amresh', 'PK',
  'Sid G', 'Sid K', 'Arif', 'Ansh', 'Shah' // Including dynamic pool names
];

const squadsConfig = [
  {
    id: 'squad_team_1',
    label: 'Team 1',
    logoUrl: '/Hotsht%20profile%20pics/Samosa%20Smashers%20Sumit.jpeg',
    players: ['Sumit', 'Hemal', 'Miten', 'Arif', 'Viki', 'Ansh', 'Shah', 'Nadeem']
  },
  {
    id: 'squad_team_2',
    label: 'Team 2',
    logoUrl: '/Hotsht%20profile%20pics/papad_punishers_logo_1786964324414.jpg',
    players: ['Ankit', 'Gopal', 'Amresh', 'Karan', 'Sid G', 'Sid K', 'Deep', 'Gulshan']
  }
];

const stageConfig = [
  {
    stageLabel: 'League Stage',
    roundStart: 1,
    roundEnd: 8,
    pointsPerWin: 1
  },
  {
    stageLabel: 'Gold & Bronze Finals',
    roundStart: 9,
    roundEnd: 11,
    pointsPerWin: 2 // Finals matches are 2x (Round 2) or 3x progressive config
  }
];

async function run() {
  console.log("Setting up Thursday 'Who's the Hotshot' Team Championship Session...");

  // Delete existing session and rounds if any
  await supabase.from('rounds').delete().eq('session_id', sessionId);
  await supabase.from('sessions').delete().eq('id', sessionId);

  // Insert session with format = 'team_championship'
  const { error: sErr } = await supabase.from('sessions').insert({
    id: sessionId,
    club_id: clubId,
    format: 'team_championship', // Changed to team_championship!
    players: allPlayerNames,
    absent_players: [],
    squads: squadsConfig, // Added squads configuration!
    round_count: 11, // Total rounds including finals!
    status: 'in_progress',
    court_labels: ['Court 1', 'Court 2', 'Court 3'],
    round_duration_minutes: 10,
    rounds_per_block: null,
    group_name: "Who's the Hotshot Tournament",
    logo_url_1: '/Hotsht%20profile%20pics/Samosa%20Smashers%20Sumit.jpeg',
    logo_url_2: '/Hotsht%20profile%20pics/papad_punishers_logo_1786964324414.jpg',
    start_time: '07:00 PM',
    event_date: '2026-08-20',
    court_cost: null,
    ball_cost: 0,
    is_ladder: false,
    king_of_court_fixed_pairs: null,
    venue: 'Hotshot Club',
    storylines: [],
    booker_upi_vpa: null,
    stage_config: stageConfig, // Added stageConfig!
    rapid_fire_config: null,
    match_scoring_rule: 'golden_14' // Added rally scoring rule matching 14-14 golden point!
  });

  if (sErr) {
    console.error("Error creating session:", sErr);
    return;
  }
  console.log("Session 'hotshot_session_thursday' successfully created as Team Championship format!");

  // Insert rounds
  const roundsToInsert = scheduleData.map(r => ({
    session_id: sessionId,
    round_number: r.round,
    court: r.court,
    team_a: r.team_a,
    team_b: r.team_b,
    sitting_out: r.sit,
    score_a: null,
    score_b: null
  }));

  const { error: rErr } = await supabase.from('rounds').insert(roundsToInsert);
  if (rErr) {
    console.error("Error inserting rounds:", rErr);
  } else {
    console.log(`Successfully populated ${roundsToInsert.length} rounds for the tournament schedule!`);
  }
}

run().catch(console.error);
