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
const mavericksA = { 'A1': 'Hemal', 'A2': 'Karan', 'A3': 'Nimish', 'A4': 'Saurabh' };
const mavericksB = { 'B1': 'Gopal', 'B2': 'Miten', 'B3': 'Hitesh', 'B4': 'Chirag' };
const mavericksC = { 'C1': 'Tushar', 'C2': 'Hiten', 'C3': 'Amit', 'C4': 'Ketan' };

// Player Name mappings for Hotshots (X, Y, Z)
const hotshotsX = { 'X1': 'Sumiit', 'X2': 'Viki', 'X3': 'Nadeem', 'X4': 'Sid G' };
const hotshotsY = { 'Y1': 'Deep', 'Y2': 'Priyesh', 'Y3': 'Amreesh', 'Y4': 'Anosh' };
const hotshotsZ = { 'Z1': 'Shahnawaz', 'Z2': 'Arif', 'Z3': 'Ansh', 'Z4': 'Gulshan' };

// Unified player mapping
const mapping = {
  ...mavericksA, ...mavericksB, ...mavericksC,
  ...hotshotsX, ...hotshotsY, ...hotshotsZ
};

const allPlayerNames = Object.values(mapping);

const squadsConfig = [
  { id: 'mavericks', label: 'Mavericks', players: [...Object.values(mavericksA), ...Object.values(mavericksB), ...Object.values(mavericksC)], logoUrl: null },
  { id: 'hotshots', label: 'Hotshots', players: [...Object.values(hotshotsX), ...Object.values(hotshotsY), ...Object.values(hotshotsZ)], logoUrl: null }
];

// Helper to map code pairs to player names
const mapTeam = (codes) => codes.map(c => mapping[c] || c);

// Schedule data balanced so every player has exactly 9 matches
const schedule = [
  // Round 1
  { round: 1, court: 1, team_a: ['A1', 'A2'], team_b: ['X1', 'X2'] }, // Hemal+Karan vs Sumiit+Viki
  { round: 1, court: 2, team_a: ['B1', 'B2'], team_b: ['Y1', 'Y2'] }, // Gopal+Miten vs Deep+Priyesh
  { round: 1, court: 3, team_a: ['C1', 'C2'], team_b: ['Z1', 'Z2'] }, // Tushar+Hiten vs Shahnawaz+Arif
  
  // Round 2
  { round: 2, court: 1, team_a: ['A3', 'A4'], team_b: ['X3', 'X4'] }, // Nimish+Saurabh vs Nadeem+Sid G
  { round: 2, court: 2, team_a: ['B3', 'B4'], team_b: ['Y3', 'Y4'] }, // Hitesh+Chirag vs Amreesh+Anosh
  { round: 2, court: 3, team_a: ['C3', 'C4'], team_b: ['Z3', 'Z4'] }, // Amit+Ketan vs Ansh+Gulshan
  
  // Round 3
  { round: 3, court: 1, team_a: ['A1', 'A3'], team_b: ['X1', 'X3'] }, // Hemal+Nimish vs Sumiit+Nadeem
  { round: 3, court: 2, team_a: ['B1', 'B3'], team_b: ['Y1', 'Y3'] }, // Gopal+Hitesh vs Deep+Amreesh
  { round: 3, court: 3, team_a: ['C1', 'C3'], team_b: ['Z1', 'Z3'] }, // Tushar+Amit vs Shahnawaz+Ansh
  
  // Round 4
  { round: 4, court: 1, team_a: ['A2', 'A4'], team_b: ['X2', 'X4'] }, // Karan+Saurabh vs Viki+Sid G
  { round: 4, court: 2, team_a: ['B2', 'B4'], team_b: ['Y2', 'Y4'] }, // Miten+Chirag vs Priyesh+Anosh
  { round: 4, court: 3, team_a: ['C2', 'C4'], team_b: ['Z2', 'Z4'] }, // Hiten+Ketan vs Arif+Gulshan
  
  // Round 5 - ADJUSTED to X1+X4 (Sumiit + Sid G) to balance matches
  { round: 5, court: 1, team_a: ['A1', 'A4'], team_b: ['X1', 'X4'] }, 
  { round: 5, court: 2, team_a: ['B1', 'B4'], team_b: ['Y1', 'Y4'] }, 
  { round: 5, court: 3, team_a: ['C1', 'C4'], team_b: ['Z1', 'Z4'] }, 
  
  // Round 6 - ADJUSTED to X2+X3 (Viki + Nadeem) to balance matches
  { round: 6, court: 1, team_a: ['A2', 'A3'], team_b: ['X2', 'X3'] }, 
  { round: 6, court: 2, team_a: ['B2', 'B3'], team_b: ['Y2', 'Y3'] }, 
  { round: 6, court: 3, team_a: ['C2', 'C3'], team_b: ['Z2', 'Z3'] }, 

  // Round 7
  { round: 7, court: 1, team_a: ['A1', 'A2'], team_b: ['Y1', 'Y2'] },
  { round: 7, court: 2, team_a: ['B1', 'B2'], team_b: ['Z1', 'Z2'] },
  { round: 7, court: 3, team_a: ['C1', 'C2'], team_b: ['X1', 'X2'] },
  
  // Round 8
  { round: 8, court: 1, team_a: ['A3', 'A4'], team_b: ['Y3', 'Y4'] },
  { round: 8, court: 2, team_a: ['B3', 'B4'], team_b: ['Z3', 'Z4'] },
  { round: 8, court: 3, team_a: ['C3', 'C4'], team_b: ['X3', 'X4'] },
  
  // Round 9
  { round: 9, court: 1, team_a: ['A1', 'A3'], team_b: ['Y1', 'Y3'] },
  { round: 9, court: 2, team_a: ['B1', 'B3'], team_b: ['Z1', 'Z3'] },
  { round: 9, court: 3, team_a: ['C1', 'C3'], team_b: ['X1', 'X3'] },
  
  // Round 10
  { round: 10, court: 1, team_a: ['A2', 'A4'], team_b: ['Y2', 'Y4'] },
  { round: 10, court: 2, team_a: ['B2', 'B4'], team_b: ['Z2', 'Z4'] },
  { round: 10, court: 3, team_a: ['C2', 'C4'], team_b: ['X2', 'X4'] },
  
  // Round 11 - ADJUSTED to Y-group equivalent logic for Z and X rotations
  { round: 11, court: 1, team_a: ['A1', 'A4'], team_b: ['Y1', 'Y4'] }, 
  { round: 11, court: 2, team_a: ['B1', 'B4'], team_b: ['Z1', 'Z4'] }, 
  { round: 11, court: 3, team_a: ['C1', 'C4'], team_b: ['X1', 'X4'] }, // Sumiit + Sid G
  
  // Round 12
  { round: 12, court: 1, team_a: ['A2', 'A3'], team_b: ['Y2', 'Y3'] },
  { round: 12, court: 2, team_a: ['B2', 'B3'], team_b: ['Z2', 'Z3'] },
  { round: 12, court: 3, team_a: ['C2', 'C3'], team_b: ['X2', 'X3'] }, // Viki + Nadeem

  // Round 13
  { round: 13, court: 1, team_a: ['A1', 'A2'], team_b: ['Z1', 'Z2'] },
  { round: 13, court: 2, team_a: ['B1', 'B2'], team_b: ['X1', 'X2'] },
  { round: 13, court: 3, team_a: ['C1', 'C2'], team_b: ['Y1', 'Y2'] },
  
  // Round 14
  { round: 14, court: 1, team_a: ['A3', 'A4'], team_b: ['Z3', 'Z4'] },
  { round: 14, court: 2, team_a: ['B3', 'B4'], team_b: ['X3', 'X4'] },
  { round: 14, court: 3, team_a: ['C3', 'C4'], team_b: ['Y3', 'Y4'] },
  
  // Round 15
  { round: 15, court: 1, team_a: ['A1', 'A3'], team_b: ['Z1', 'Z3'] },
  { round: 15, court: 2, team_a: ['B1', 'B3'], team_b: ['X1', 'X3'] },
  { round: 15, court: 3, team_a: ['C1', 'C3'], team_b: ['Y1', 'Y3'] },
  
  // Round 16
  { round: 16, court: 1, team_a: ['A2', 'A4'], team_b: ['Z2', 'Z4'] },
  { round: 16, court: 2, team_a: ['B2', 'B4'], team_b: ['X2', 'X4'] },
  { round: 16, court: 3, team_a: ['C2', 'C4'], team_b: ['Y2', 'Y4'] },
  
  // Round 17
  { round: 17, court: 1, team_a: ['A1', 'A4'], team_b: ['Z1', 'Z4'] },
  { round: 17, court: 2, team_a: ['B1', 'B4'], team_b: ['X1', 'X4'] }, // Sumiit + Sid G
  { round: 17, court: 3, team_a: ['C1', 'C4'], team_b: ['Y1', 'Y4'] },
  
  // Round 18
  { round: 18, court: 1, team_a: ['A2', 'A3'], team_b: ['Z2', 'Z3'] },
  { round: 18, court: 2, team_a: ['B2', 'B3'], team_b: ['X2', 'X3'] }, // Viki + Nadeem
  { round: 18, court: 3, team_a: ['C2', 'C3'], team_b: ['Y2', 'Y3'] }
];

async function run() {
  console.log("Equalizing Match Schedules so everyone has exactly 9 matches...");

  // Delete existing rounds
  await supabase.from('rounds').delete().eq('session_id', sessionId);

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
    console.log(`Successfully populated all ${roundsToInsert.length} balanced rounds!`);
  }
}

run().catch(console.error);
