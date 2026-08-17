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

const expectedSchedule = [
  // Session 1 Court 1
  { round: 1, court: 1, team_a: 'Amresh & Parth', team_b: 'Budo & Sumit' },
  { round: 2, court: 1, team_a: 'Amresh & Budo', team_b: 'Parth & Ankit' },
  { round: 3, court: 1, team_a: 'Priyesh & Parth', team_b: 'Ankit & Sumit' },
  { round: 4, court: 1, team_a: 'Priyesh & Budo', team_b: 'Amresh & Ankit' },
  { round: 5, court: 1, team_a: 'Priyesh & Sumit', team_b: 'Parth & Budo' },
  { round: 6, court: 1, team_a: 'Priyesh & Ankit', team_b: 'Amresh & Sumit' },

  // Session 1 Court 2
  { round: 1, court: 2, team_a: 'Sid G & Gopal', team_b: 'Deep & Hemal' },
  { round: 2, court: 2, team_a: 'Sid G & Hemal', team_b: 'Viki & Deep' },
  { round: 3, court: 2, team_a: 'Viki & Hemal', team_b: 'Gopal & Sid K' },
  { round: 4, court: 2, team_a: 'Sid G & Sid K', team_b: 'Viki & Gopal' },
  { round: 5, court: 2, team_a: 'Sid G & Deep', team_b: 'Sid K & Hemal' },
  { round: 6, court: 2, team_a: 'Viki & Sid K', team_b: 'Gopal & Deep' },

  // Session 2 Court 1
  { round: 7, court: 1, team_a: 'Sumit & Viki', team_b: 'Parth & Sid G' },
  { round: 8, court: 1, team_a: 'Parth & Priyesh', team_b: 'Viki & Sid K' },
  { round: 9, court: 1, team_a: 'Sumit & Sid K', team_b: 'Parth & Viki' },
  { round: 10, court: 1, team_a: 'Parth & Sid K', team_b: 'Sid G & Priyesh' },
  { round: 11, court: 1, team_a: 'Sumit & Sid G', team_b: 'Priyesh & Viki' },
  { round: 12, court: 1, team_a: 'Sumit & Priyesh', team_b: 'Sid G & Sid K' },

  // Session 2 Court 2
  { round: 7, court: 2, team_a: 'Gopal & Budo', team_b: 'Amresh & Ankit' },
  { round: 8, court: 2, team_a: 'Hemal & Ankit', team_b: 'Budo & Amresh' },
  { round: 9, court: 2, team_a: 'Gopal & Amresh', team_b: 'Hemal & Deep' },
  { round: 10, court: 2, team_a: 'Gopal & Ankit', team_b: 'Deep & Amresh' },
  { round: 11, court: 2, team_a: 'Hemal & Budo', team_b: 'Deep & Ankit' },
  { round: 12, court: 2, team_a: 'Gopal & Hemal', team_b: 'Deep & Budo' },
];

async function verifyHotshotsSchedule() {
  console.log(`Verifying HOTSHOTS session ${SESSION_ID} against Official Image Schedule...`);

  const { data: dbRounds, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', SESSION_ID)
    .order('round_number', { ascending: true })
    .order('court', { ascending: true });

  if (error || !dbRounds) {
    console.error('Failed to fetch DB rounds:', error);
    return;
  }

  let matchesCount = 0;
  let allMatched = true;

  expectedSchedule.forEach(exp => {
    const match = dbRounds.find(r => r.round_number === exp.round && r.court === exp.court);
    if (!match) {
      console.error(`❌ MISSING R${exp.round} C${exp.court}`);
      allMatched = false;
      return;
    }

    const dbTeamA = match.team_a.join(' & ');
    const dbTeamB = match.team_b.join(' & ');

    if (dbTeamA === exp.team_a && dbTeamB === exp.team_b) {
      matchesCount++;
    } else {
      console.error(`❌ MISMATCH R${exp.round} C${exp.court}: Expected [${exp.team_a} vs ${exp.team_b}] got [${dbTeamA} vs ${dbTeamB}]`);
      allMatched = false;
    }
  });

  // Calculate player stats across all 12 rounds
  const playCounts = {};
  const sitCounts = {};

  dbRounds.forEach(r => {
    [...r.team_a, ...r.team_b].forEach(p => {
      playCounts[p] = (playCounts[p] || 0) + 1;
    });
    r.sitting_out.forEach(p => {
      sitCounts[p] = (sitCounts[p] || 0) + 1;
    });
  });

  console.log('\n--- VERIFICATION RESULTS ---');
  console.log(`Total Matches Verified: ${matchesCount} / ${expectedSchedule.length}`);
  console.log(`100% Schedule Image Match: ${allMatched ? 'YES ✅' : 'NO ❌'}`);
  console.log('\nPlayer Match Counts (Target: 8 matches per player across 12 rounds):');
  console.table(playCounts);
  console.log('Player Sitting Out Counts (Target: 4 rests per player across 12 rounds):');
  console.table(sitCounts);
}

verifyHotshotsSchedule();
