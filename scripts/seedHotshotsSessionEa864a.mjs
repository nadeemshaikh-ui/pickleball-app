import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let serviceKey = '';

envLines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = line.split('=')[1].trim();
  }
});

const supabase = createClient(supabaseUrl, serviceKey);

const SESSION_ID = 'ea864a';

const officialHotshotsRounds = [
  // HOUR 1 (Rounds 1–6)
  // Court 1 (Priyesh, Amresh, Parth, Budo, Ankit, Sumit)
  { round: 1, court: 1, team_a: ['Amresh', 'Parth'], team_b: ['Budo', 'Sumit'], sitting_out: ['Priyesh', 'Ankit'] },
  { round: 2, court: 1, team_a: ['Amresh', 'Budo'], team_b: ['Parth', 'Ankit'], sitting_out: ['Priyesh', 'Sumit'] },
  { round: 3, court: 1, team_a: ['Priyesh', 'Parth'], team_b: ['Ankit', 'Sumit'], sitting_out: ['Amresh', 'Budo'] },
  { round: 4, court: 1, team_a: ['Priyesh', 'Budo'], team_b: ['Amresh', 'Ankit'], sitting_out: ['Parth', 'Sumit'] },
  { round: 5, court: 1, team_a: ['Priyesh', 'Sumit'], team_b: ['Parth', 'Budo'], sitting_out: ['Amresh', 'Ankit'] },
  { round: 6, court: 1, team_a: ['Priyesh', 'Ankit'], team_b: ['Amresh', 'Sumit'], sitting_out: ['Parth', 'Budo'] },

  // Court 2 (Sid G, Viki, Gopal, Sid K, Deep, Hemal)
  { round: 1, court: 2, team_a: ['Sid G', 'Gopal'], team_b: ['Deep', 'Hemal'], sitting_out: ['Viki', 'Sid K'] },
  { round: 2, court: 2, team_a: ['Sid G', 'Hemal'], team_b: ['Viki', 'Deep'], sitting_out: ['Gopal', 'Sid K'] },
  { round: 3, court: 2, team_a: ['Viki', 'Hemal'], team_b: ['Gopal', 'Sid K'], sitting_out: ['Sid G', 'Deep'] },
  { round: 4, court: 2, team_a: ['Sid G', 'Sid K'], team_b: ['Viki', 'Gopal'], sitting_out: ['Deep', 'Hemal'] },
  { round: 5, court: 2, team_a: ['Sid G', 'Deep'], team_b: ['Sid K', 'Hemal'], sitting_out: ['Viki', 'Gopal'] },
  { round: 6, court: 2, team_a: ['Viki', 'Sid K'], team_b: ['Gopal', 'Deep'], sitting_out: ['Sid G', 'Hemal'] },

  // HOUR 2 (Rounds 7–12) — COURT SWAP AFTER SESSION 1
  // Court 1 (Sumit, Parth, Sid G, Priyesh, Viki, Sid K)
  { round: 7, court: 1, team_a: ['Sumit', 'Viki'], team_b: ['Parth', 'Sid G'], sitting_out: ['Priyesh', 'Sid K'] },
  { round: 8, court: 1, team_a: ['Parth', 'Priyesh'], team_b: ['Viki', 'Sid K'], sitting_out: ['Sumit', 'Sid G'] },
  { round: 9, court: 1, team_a: ['Sumit', 'Sid K'], team_b: ['Parth', 'Viki'], sitting_out: ['Sid G', 'Priyesh'] },
  { round: 10, court: 1, team_a: ['Parth', 'Sid K'], team_b: ['Sid G', 'Priyesh'], sitting_out: ['Sumit', 'Viki'] },
  { round: 11, court: 1, team_a: ['Sumit', 'Sid G'], team_b: ['Priyesh', 'Viki'], sitting_out: ['Parth', 'Sid K'] },
  { round: 12, court: 1, team_a: ['Sumit', 'Priyesh'], team_b: ['Sid G', 'Sid K'], sitting_out: ['Parth', 'Viki'] },

  // Court 2 (Gopal, Hemal, Deep, Budo, Amresh, Ankit)
  { round: 7, court: 2, team_a: ['Gopal', 'Budo'], team_b: ['Amresh', 'Ankit'], sitting_out: ['Hemal', 'Deep'] },
  { round: 8, court: 2, team_a: ['Hemal', 'Ankit'], team_b: ['Budo', 'Amresh'], sitting_out: ['Gopal', 'Deep'] },
  { round: 9, court: 2, team_a: ['Gopal', 'Amresh'], team_b: ['Hemal', 'Deep'], sitting_out: ['Budo', 'Ankit'] },
  { round: 10, court: 2, team_a: ['Gopal', 'Ankit'], team_b: ['Deep', 'Amresh'], sitting_out: ['Hemal', 'Budo'] },
  { round: 11, court: 2, team_a: ['Hemal', 'Budo'], team_b: ['Deep', 'Ankit'], sitting_out: ['Gopal', 'Amresh'] },
  { round: 12, court: 2, team_a: ['Gopal', 'Hemal'], team_b: ['Deep', 'Budo'], sitting_out: ['Amresh', 'Ankit'] },
];

async function seedHotshotsSession() {
  console.log(`Seeding HOTSHOTS session ${SESSION_ID}...`);

  // 1. Delete existing rounds for session
  const { error: delErr } = await supabase
    .from('rounds')
    .delete()
    .eq('session_id', SESSION_ID);

  if (delErr) {
    console.error('Error deleting existing rounds:', delErr);
    return;
  }
  console.log('Deleted old rounds.');

  // 2. Prepare payload
  const rows = officialHotshotsRounds.map(r => ({
    session_id: SESSION_ID,
    round_number: r.round,
    court: r.court,
    team_a: r.team_a,
    team_b: r.team_b,
    sitting_out: r.sitting_out,
    score_a: null,
    score_b: null
  }));

  // 3. Insert new 24 rounds
  const { data: inserted, error: insErr } = await supabase
    .from('rounds')
    .insert(rows)
    .select();

  if (insErr) {
    console.error('Error inserting official rounds:', insErr);
    return;
  }

  console.log(`Successfully seeded ${inserted.length} official rounds for HOTSHOTS session ${SESSION_ID}.`);

  // 4. Update session player list to ensure exact 12 players
  const playerList = [
    'Priyesh',
    'Amresh',
    'Parth',
    'Budo',
    'Ankit',
    'Sumit',
    'Sid G',
    'Viki',
    'Gopal',
    'Sid K',
    'Deep',
    'Hemal'
  ];

  const { error: sessErr } = await supabase
    .from('sessions')
    .update({
      players: playerList,
      round_count: 12,
      rounds_per_block: 6,
      format: 'court_blocks'
    })
    .eq('id', SESSION_ID);

  if (sessErr) {
    console.error('Error updating session metadata:', sessErr);
  } else {
    console.log('Updated session player list and format metadata.');
  }
}

seedHotshotsSession();
