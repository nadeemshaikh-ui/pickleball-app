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

// Define 4 real squads
const squadsConfig = [
  {
    id: 'squad_team_1',
    label: 'Samosa Smashers',
    logoUrl: '/Hotsht%20profile%20pics/Samosa%20Smashers%20Sumit.jpeg',
    players: ['Sumit', 'Arif', 'Viki', 'Hemal']
  },
  {
    id: 'squad_team_2',
    label: 'Papad Punishers',
    logoUrl: '/Hotsht%20profile%20pics/papad_punishers_logo_1786964324414.jpg',
    players: ['Shaan', 'Rizwaan', 'Ansh', 'Shah', 'Karan'] // Replacing Ankit with Rizwaan
  },
  {
    id: 'squad_team_3',
    label: 'Dhokla Destroyers',
    logoUrl: '/Hotsht%20profile%20pics/Dhokla%20Destroyers%20Deep.jpeg',
    players: ['Miten', 'Nadeem', 'Gopal', 'Sid K']
  },
  {
    id: 'squad_team_4',
    label: 'Cheese Naan Warriors',
    logoUrl: '/Hotsht%20profile%20pics/cheese_naan_logo_1786964038239.jpg',
    players: ['Deep', 'Gulshan', 'Sid G', 'Amresh']
  }
];

const allPlayerNames = [
  'Sumit', 'Arif', 'Viki', 'Hemal',
  'Shaan', 'Rizwaan', 'Ansh', 'Shah', 'Karan',
  'Miten', 'Nadeem', 'Gopal', 'Sid K',
  'Deep', 'Gulshan', 'Sid G', 'Amresh',
  'Sid', 'Yule', 'Shrinath', 'Priyesh', 'Anosh', 'PK' // Rest pool
];

const scheduleData = [
  // Round 1 (With Ankit -> Rizwaan swapped)
  { round: 1, court: 1, team_a: ['Sumit', 'Hemal'], team_b: ['Nadeem', 'Gopal'], score_a: 14, score_b: 15 },
  { round: 1, court: 2, team_a: ['Shah', 'Karan'], team_b: ['Miten', 'Sid K'], score_a: 10, score_b: 15 },
  { round: 1, court: 3, team_a: ['Rizwaan', 'Ansh'], team_b: ['Gulshan', 'Sid G'], score_a: 15, score_b: 11 },

  // Round 2
  { round: 2, court: 1, team_a: ['Arif', 'Hemal'], team_b: ['Rizwaan', 'Shah'], score_a: 15, score_b: 12 },
  { round: 2, court: 2, team_a: ['Sumit', 'Viki'], team_b: ['Sid G', 'Amresh'], score_a: 7, score_b: 15 },
  { round: 2, court: 3, team_a: ['Miten', 'Gopal'], team_b: ['Deep', 'Gulshan'], score_a: 15, score_b: 11 },

  // Round 3
  { round: 3, court: 1, team_a: ['Arif', 'Viki'], team_b: ['Gopal', 'Sid K'], score_a: 9, score_b: 15 },
  { round: 3, court: 2, team_a: ['Rizwaan', 'Ansh'], team_b: ['Miten', 'Nadeem'], score_a: 15, score_b: 14 },
  { round: 3, court: 3, team_a: ['Shah', 'Karan'], team_b: ['Gulshan', 'Sid G'], score_a: 14, score_b: 15 },

  // Round 4
  { round: 4, court: 1, team_a: ['Sumit', 'Arif'], team_b: ['Ansh', 'Karan'], score_a: 15, score_b: 11 },
  { round: 4, court: 2, team_a: ['Viki', 'Hemal'], team_b: ['Deep', 'Gulshan'], score_a: 12, score_b: 15 },
  { round: 4, court: 3, team_a: ['Miten', 'Gopal'], team_b: ['Sid G', 'Amresh'], score_a: 15, score_b: 13 },

  // Round 5
  { round: 5, court: 1, team_a: ['Arif', 'Viki'], team_b: ['Miten', 'Nadeem'], score_a: 15, score_b: 14 },
  { round: 5, court: 2, team_a: ['Ansh', 'Shah'], team_b: ['Gopal', 'Sid K'], score_a: 15, score_b: 13 },
  { round: 5, court: 3, team_a: ['Rizwaan', 'Karan'], team_b: ['Deep', 'Amresh'], score_a: 15, score_b: 14 },

  // Round 6
  { round: 6, court: 1, team_a: ['Sumit', 'Viki'], team_b: ['Rizwaan', 'Shah'], score_a: 15, score_b: 11 },
  { round: 6, court: 2, team_a: ['Arif', 'Hemal'], team_b: ['Gulshan', 'Amresh'], score_a: 15, score_b: 14 },
  { round: 6, court: 3, team_a: ['Nadeem', 'Sid K'], team_b: ['Deep', 'Sid G'], score_a: 8, score_b: 15 },

  // Round 7
  { round: 7, court: 1, team_a: ['Viki', 'Hemal'], team_b: ['Ansh', 'Karan'], score_a: 15, score_b: 12 },
  { round: 7, court: 2, team_a: ['Sumit', 'Arif'], team_b: ['Deep', 'Sid G'], score_a: 15, score_b: 10 },
  { round: 7, court: 3, team_a: ['Nadeem', 'Sid K'], team_b: ['Gulshan', 'Amresh'], score_a: 10, score_b: 15 },

  // Round 8
  { round: 8, court: 1, team_a: ['Sumit', 'Hemal'], team_b: ['Miten', 'Sid K'], score_a: 15, score_b: 12 },
  { round: 8, court: 2, team_a: ['Rizwaan', 'Karan'], team_b: ['Nadeem', 'Gopal'], score_a: 11, score_b: 15 },
  { round: 8, court: 3, team_a: ['Shah', 'Ansh'], team_b: ['Deep', 'Amresh'], score_a: 13, score_b: 15 }
];

async function run() {
  console.log("Setting up Thursday 'Who's the Hotshot' 4-Team Championship Session...");

  await supabase.from('rounds').delete().eq('session_id', sessionId);
  await supabase.from('sessions').delete().eq('id', sessionId);

  const { error: sErr } = await supabase.from('sessions').insert({
    id: sessionId,
    club_id: clubId,
    format: 'team_championship',
    players: allPlayerNames,
    absent_players: [],
    squads: squadsConfig,
    round_count: 11,
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
    stage_config: [
      { stageLabel: 'League Stage', roundStart: 1, roundEnd: 8, pointsPerWin: 1 },
      { stageLabel: 'Gold & Bronze Finals', roundStart: 9, roundEnd: 11, pointsPerWin: 2 }
    ],
    rapid_fire_config: null,
    match_scoring_rule: 'golden_14'
  });

  if (sErr) {
    console.error("Error creating session:", sErr);
    return;
  }
  console.log("Session successfully created!");

  // Insert rounds with scores populated
  const roundsToInsert = scheduleData.map(r => ({
    session_id: sessionId,
    round_number: r.round,
    court: r.court,
    team_a: r.team_a,
    team_b: r.team_b,
    sitting_out: [],
    score_a: r.score_a,
    score_b: r.score_b
  }));

  // Add empty placeholders for Gold & Bronze Finals (Rounds 9–11)
  for (let r = 9; r <= 11; r++) {
    for (let c = 1; c <= 3; c++) {
      roundsToInsert.push({
        session_id: sessionId,
        round_number: r,
        court: c,
        team_a: ['', ''],
        team_b: ['', ''],
        sitting_out: [],
        score_a: null,
        score_b: null
      });
    }
  }

  const { error: rErr } = await supabase.from('rounds').insert(roundsToInsert);
  if (rErr) {
    console.error("Error inserting rounds:", rErr);
  } else {
    console.log(`Successfully populated ${roundsToInsert.length} rounds and restored scores!`);
  }
}

run().catch(console.error);
