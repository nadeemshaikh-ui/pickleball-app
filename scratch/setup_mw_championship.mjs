import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

// Sessions Details
const sessionId = 'mw_mavericks_vs_hotshots_2026';
const clubId = 'd5b57890-3787-41bb-bf23-38bc95345011'; // Monday-Wednesday Club ID

// Player Name mappings for Mavericks (A, B, C)
// Group A (Blue Storm)
const mavericksA = {
  'A1': 'Hemal',
  'A2': 'Karan',
  'A3': 'Nimish',
  'A4': 'Saurabh'
};
// Group B (Red Strikers)
const mavericksB = {
  'B1': 'Gopal',
  'B2': 'Miten',
  'B3': 'Hitesh',
  'B4': 'Chirag'
};
// Group C (Green Force)
const mavericksC = {
  'C1': 'Tushar',
  'C2': 'Hiten',
  'C3': 'Amit',
  'C4': 'Ketan'
};

// Player Name mappings for Hotshots (X, Y, Z)
// Group A (Blue Blazers) -> maps to X
const hotshotsX = {
  'X1': 'Sumiit',
  'X2': 'Viki',
  'X3': 'Nadeem',
  'X4': 'Sid G'
};
// Group B (Red Firestorm) -> maps to Y
const hotshotsY = {
  'Y1': 'Deep',
  'Y2': 'Priyesh',
  'Y3': 'Amreesh',
  'Y4': 'Anosh'
};
// Group C (Green Hurricanes) -> maps to Z
const hotshotsZ = {
  'Z1': 'Shahnawaz',
  'Z2': 'Arif',
  'Z3': 'Ansh',
  'Z4': 'Gulshan'
};

// Unified player mapping
const mapping = {
  ...mavericksA, ...mavericksB, ...mavericksC,
  ...hotshotsX, ...hotshotsY, ...hotshotsZ
};

const allPlayerNames = Object.values(mapping);

// 3 Squads for Mavericks & Hotshots (stored for reference)
const squadsConfig = [
  { id: 'mavericks_blue_storm', label: 'Mavericks (Blue Storm)', players: Object.values(mavericksA) },
  { id: 'mavericks_red_strikers', label: 'Mavericks (Red Strikers)', players: Object.values(mavericksB) },
  { id: 'mavericks_green_force', label: 'Mavericks (Green Force)', players: Object.values(mavericksC) },
  { id: 'hotshots_blue_blazers', label: 'Hotshots (Blue Blazers)', players: Object.values(hotshotsX) },
  { id: 'hotshots_red_firestorm', label: 'Hotshots (Red Firestorm)', players: Object.values(hotshotsY) },
  { id: 'hotshots_green_hurricanes', label: 'Hotshots (Green Hurricanes)', players: Object.values(hotshotsZ) }
];

// Helper to map code pairs to player names
const mapTeam = (codes) => codes.map(c => mapping[c] || c);

// Schedule data parsed from screenshot 1
const schedule = [
  // Round 1
  { round: 1, court: 1, team_a: ['A1', 'A2'], team_b: ['X1', 'X2'] },
  { round: 1, court: 2, team_a: ['B1', 'B2'], team_b: ['Y1', 'Y2'] },
  { round: 1, court: 3, team_a: ['C1', 'C2'], team_b: ['Z1', 'Z2'] },
  
  { round: 2, court: 1, team_a: ['A3', 'A4'], team_b: ['X3', 'X4'] },
  { round: 2, court: 2, team_a: ['B3', 'B4'], team_b: ['Y3', 'Y4'] },
  { round: 2, court: 3, team_a: ['C3', 'C4'], team_b: ['Z3', 'Z4'] },
  
  { round: 3, court: 1, team_a: ['A1', 'A3'], team_b: ['X1', 'X3'] },
  { round: 3, court: 2, team_a: ['B1', 'B3'], team_b: ['Y1', 'Y3'] },
  { round: 3, court: 3, team_a: ['C1', 'C3'], team_b: ['Z1', 'Z3'] },
  
  { round: 4, court: 1, team_a: ['A2', 'A4'], team_b: ['X2', 'X4'] },
  { round: 4, court: 2, team_a: ['B2', 'B4'], team_b: ['Y2', 'Y4'] },
  { round: 4, court: 3, team_a: ['C2', 'C4'], team_b: ['Z2', 'Z4'] },
  
  { round: 5, court: 1, team_a: ['A1', 'A4'], team_b: ['X1', 'X2'] },
  { round: 5, court: 2, team_a: ['B1', 'B4'], team_b: ['Y1', 'Y4'] },
  { round: 5, court: 3, team_a: ['C1', 'C4'], team_b: ['Z1', 'Z4'] },
  
  { round: 6, court: 1, team_a: ['A2', 'A3'], team_b: ['X2', 'X3'] },
  { round: 6, court: 2, team_a: ['B2', 'B3'], team_b: ['Y2', 'Y3'] },
  { round: 6, court: 3, team_a: ['C2', 'C3'], team_b: ['Z2', 'Z3'] },

  // Round 2 (in sheet, matches rounds 7-12)
  { round: 7, court: 1, team_a: ['A1', 'A2'], team_b: ['Y1', 'Y2'] },
  { round: 7, court: 2, team_a: ['B1', 'B2'], team_b: ['Z1', 'Z2'] },
  { round: 7, court: 3, team_a: ['C1', 'C2'], team_b: ['X1', 'X2'] },
  
  { round: 8, court: 1, team_a: ['A3', 'A4'], team_b: ['Y3', 'Y4'] },
  { round: 8, court: 2, team_a: ['B3', 'B4'], team_b: ['Z3', 'Z4'] },
  { round: 8, court: 3, team_a: ['C3', 'C4'], team_b: ['X3', 'X4'] },
  
  { round: 9, court: 1, team_a: ['A1', 'A3'], team_b: ['Y1', 'Y3'] },
  { round: 9, court: 2, team_a: ['B1', 'B3'], team_b: ['Z1', 'Z3'] },
  { round: 9, court: 3, team_a: ['C1', 'C3'], team_b: ['X1', 'X3'] },
  
  { round: 10, court: 1, team_a: ['A2', 'A4'], team_b: ['Y2', 'Y4'] },
  { round: 10, court: 2, team_a: ['B2', 'B4'], team_b: ['Z2', 'Z4'] },
  { round: 10, court: 3, team_a: ['C2', 'C4'], team_b: ['X2', 'X4'] },
  
  { round: 11, court: 1, team_a: ['A1', 'A4'], team_b: ['Y1', 'Y4'] },
  { round: 11, court: 2, team_a: ['B1', 'B4'], team_b: ['Z1', 'Z4'] },
  { round: 11, court: 3, team_a: ['C1', 'C4'], team_b: ['X1', 'X4'] },
  
  { round: 12, court: 1, team_a: ['A2', 'A3'], team_b: ['Y2', 'Y3'] },
  { round: 12, court: 2, team_a: ['B2', 'B3'], team_b: ['Z2', 'Z3'] },
  { round: 12, court: 3, team_a: ['C2', 'C3'], team_b: ['X2', 'X3'] },

  // Round 3 (in sheet, matches rounds 13-18)
  { round: 13, court: 1, team_a: ['A1', 'A2'], team_b: ['Z1', 'Z2'] },
  { round: 13, court: 2, team_a: ['B1', 'B2'], team_b: ['X1', 'X2'] },
  { round: 13, court: 3, team_a: ['C1', 'C2'], team_b: ['Y1', 'Y2'] },
  
  { round: 14, court: 1, team_a: ['A3', 'A4'], team_b: ['Z3', 'Z4'] },
  { round: 14, court: 2, team_a: ['B3', 'B4'], team_b: ['X3', 'X4'] },
  { round: 14, court: 3, team_a: ['C3', 'C4'], team_b: ['Y3', 'Y4'] },
  
  { round: 15, court: 1, team_a: ['A1', 'A3'], team_b: ['Z1', 'Z3'] },
  { round: 15, court: 2, team_a: ['B1', 'B3'], team_b: ['X1', 'X3'] },
  { round: 15, court: 3, team_a: ['C1', 'C3'], team_b: ['Y1', 'Y3'] },
  
  { round: 16, court: 1, team_a: ['A2', 'A4'], team_b: ['Z2', 'Z4'] },
  { round: 16, court: 2, team_a: ['B2', 'B4'], team_b: ['X2', 'X4'] },
  { round: 16, court: 3, team_a: ['C2', 'C4'], team_b: ['Y2', 'Y4'] },
  
  { round: 17, court: 1, team_a: ['A1', 'A4'], team_b: ['Z1', 'Z4'] },
  { round: 17, court: 2, team_a: ['B1', 'B4'], team_b: ['X1', 'X4'] },
  { round: 17, court: 3, team_a: ['C1', 'C4'], team_b: ['Y1', 'Y4'] },
  
  { round: 18, court: 1, team_a: ['A2', 'A3'], team_b: ['Z2', 'Z3'] },
  { round: 18, court: 2, team_a: ['B2', 'B3'], team_b: ['X2', 'X3'] },
  { round: 18, court: 3, team_a: ['C2', 'C3'], team_b: ['Y2', 'Y3'] }
];

async function run() {
  console.log("Setting up MW Open Championship (August 23, 2026)...");

  // Clear existing session and rounds if matched
  await supabase.from('rounds').delete().eq('session_id', sessionId);
  await supabase.from('sessions').delete().eq('id', sessionId);

  // Insert session
  const { error: sErr } = await supabase.from('sessions').insert({
    id: sessionId,
    club_id: clubId,
    format: 'team_championship',
    players: allPlayerNames,
    absent_players: [],
    squads: squadsConfig,
    round_count: 21, // 18 League rounds + 3 Finals rounds
    status: 'in_progress',
    court_labels: ['Court 1', 'Court 2', 'Court 3'],
    round_duration_minutes: 10,
    rounds_per_block: null,
    group_name: "MW Open Championship - 23 Aug 2026",
    logo_url_1: '/Hotsht%20profile%20pics/Samosa%20Smashers%20Sumit.jpeg',
    logo_url_2: '/Hotsht%20profile%20pics/papad_punishers_logo_1786964324414.jpg',
    start_time: '08:00 PM',
    event_date: '2026-08-23',
    court_cost: null,
    ball_cost: 0,
    is_ladder: false,
    king_of_court_fixed_pairs: null,
    venue: 'Monday-Wednesday Club',
    storylines: [],
    booker_upi_vpa: null,
    stage_config: [
      { stageLabel: 'League Phase', roundStart: 1, roundEnd: 18, pointsPerWin: 1 },
      { stageLabel: 'Finals Showdown', roundStart: 19, roundEnd: 21, pointsPerWin: 2 }
    ],
    rapid_fire_config: { targetPoints: 31, bonusPoints: 0 },
    match_scoring_rule: 'golden_14'
  });

  if (sErr) {
    console.error("Error creating session:", sErr);
    return;
  }
  console.log("Session created successfully.");

  // Prepare rounds data
  const roundsToInsert = schedule.map(r => ({
    session_id: sessionId,
    round_number: r.round,
    court: r.court,
    team_a: mapTeam(r.team_a),
    team_b: mapTeam(r.team_b),
    sitting_out: [],
    score_a: null,
    score_b: null
  }));

  // Add Finals placeholders (Rounds 19 to 21)
  for (let r = 19; r <= 21; r++) {
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
    console.log(`Successfully populated ${roundsToInsert.length} rounds for the tournament!`);
  }
}

run().catch(console.error);
