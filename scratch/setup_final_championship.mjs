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

const sessionId = 'mw_mavericks_vs_hotshots_2026';

const schedule = [
  // ROUND 1
  { round: 1, court: 1, team_a: ['Hemal', 'Karan'], team_b: ['Sumiit', 'Viki'] },
  { round: 1, court: 2, team_a: ['Gopal', 'Miten'], team_b: ['Deep', 'Priyesh'] },
  { round: 1, court: 3, team_a: ['Tushar', 'Hiten'], team_b: ['Shahnawaz', 'Arif'] },
  
  { round: 2, court: 1, team_a: ['Nimish', 'Saurabh'], team_b: ['Nadeem', 'Sid G'] },
  { round: 2, court: 2, team_a: ['Shravani', 'Hitesh'], team_b: ['Amreesh', 'Anosh'] },
  { round: 2, court: 3, team_a: ['Amit', 'Ketan'], team_b: ['Ansh', 'Gulshan'] },
  
  { round: 3, court: 1, team_a: ['Hemal', 'Nimish'], team_b: ['Sumiit', 'Nadeem'] },
  { round: 3, court: 2, team_a: ['Gopal', 'Hitesh'], team_b: ['Deep', 'Amreesh'] },
  { round: 3, court: 3, team_a: ['Tushar', 'Amit'], team_b: ['Shahnawaz', 'Ansh'] },
  
  { round: 4, court: 1, team_a: ['Karan', 'Saurabh'], team_b: ['Viki', 'Sid G'] },
  { round: 4, court: 2, team_a: ['Miten', 'Shravani'], team_b: ['Priyesh', 'Anosh'] },
  { round: 4, court: 3, team_a: ['Hiten', 'Ketan'], team_b: ['Arif', 'Gulshan'] },
  
  { round: 5, court: 1, team_a: ['Hemal', 'Saurabh'], team_b: ['Sumiit', 'Sid G'] },
  { round: 5, court: 2, team_a: ['Gopal', 'Shravani'], team_b: ['Deep', 'Anosh'] },
  { round: 5, court: 3, team_a: ['Tushar', 'Ketan'], team_b: ['Shahnawaz', 'Gulshan'] },
  
  { round: 6, court: 1, team_a: ['Karan', 'Nimish'], team_b: ['Viki', 'Nadeem'] },
  { round: 6, court: 2, team_a: ['Miten', 'Hitesh'], team_b: ['Priyesh', 'Amreesh'] },
  { round: 6, court: 3, team_a: ['Hiten', 'Amit'], team_b: ['Arif', 'Ansh'] },

  // ROUND 2
  { round: 7, court: 1, team_a: ['Hemal', 'Karan'], team_b: ['Deep', 'Priyesh'] },
  { round: 7, court: 2, team_a: ['Gopal', 'Miten'], team_b: ['Shahnawaz', 'Arif'] },
  { round: 7, court: 3, team_a: ['Tushar', 'Hiten'], team_b: ['Sumiit', 'Viki'] },
  
  { round: 8, court: 1, team_a: ['Nimish', 'Saurabh'], team_b: ['Amreesh', 'Anosh'] },
  { round: 8, court: 2, team_a: ['Shravani', 'Hitesh'], team_b: ['Ansh', 'Gulshan'] },
  { round: 8, court: 3, team_a: ['Amit', 'Ketan'], team_b: ['Nadeem', 'Sid G'] },
  
  { round: 9, court: 1, team_a: ['Hemal', 'Nimish'], team_b: ['Deep', 'Amreesh'] },
  { round: 9, court: 2, team_a: ['Gopal', 'Hitesh'], team_b: ['Shahnawaz', 'Ansh'] },
  { round: 9, court: 3, team_a: ['Tushar', 'Amit'], team_b: ['Sumiit', 'Nadeem'] },
  
  { round: 10, court: 1, team_a: ['Karan', 'Saurabh'], team_b: ['Priyesh', 'Anosh'] },
  { round: 10, court: 2, team_a: ['Miten', 'Shravani'], team_b: ['Arif', 'Gulshan'] },
  { round: 10, court: 3, team_a: ['Hiten', 'Ketan'], team_b: ['Viki', 'Sid G'] },
  
  { round: 11, court: 1, team_a: ['Hemal', 'Saurabh'], team_b: ['Deep', 'Anosh'] },
  { round: 11, court: 2, team_a: ['Gopal', 'Shravani'], team_b: ['Shahnawaz', 'Gulshan'] },
  { round: 11, court: 3, team_a: ['Tushar', 'Ketan'], team_b: ['Sumiit', 'Sid G'] },
  
  { round: 12, court: 1, team_a: ['Karan', 'Nimish'], team_b: ['Priyesh', 'Amreesh'] },
  { round: 12, court: 2, team_a: ['Miten', 'Hitesh'], team_b: ['Arif', 'Ansh'] },
  { round: 12, court: 3, team_a: ['Hiten', 'Amit'], team_b: ['Viki', 'Nadeem'] },

  // ROUND 3
  { round: 13, court: 1, team_a: ['Hemal', 'Karan'], team_b: ['Shahnawaz', 'Arif'] },
  { round: 13, court: 2, team_a: ['Gopal', 'Miten'], team_b: ['Sumiit', 'Viki'] },
  { round: 13, court: 3, team_a: ['Tushar', 'Hiten'], team_b: ['Deep', 'Priyesh'] },
  
  { round: 14, court: 1, team_a: ['Nimish', 'Saurabh'], team_b: ['Ansh', 'Gulshan'] },
  { round: 14, court: 2, team_a: ['Shravani', 'Hitesh'], team_b: ['Nadeem', 'Sid G'] },
  { round: 14, court: 3, team_a: ['Amit', 'Ketan'], team_b: ['Amreesh', 'Anosh'] },
  
  { round: 15, court: 1, team_a: ['Hemal', 'Nimish'], team_b: ['Shahnawaz', 'Ansh'] },
  { round: 15, court: 2, team_a: ['Gopal', 'Hitesh'], team_b: ['Sumiit', 'Nadeem'] },
  { round: 15, court: 3, team_a: ['Tushar', 'Amit'], team_b: ['Deep', 'Amreesh'] },
  
  { round: 16, court: 1, team_a: ['Karan', 'Saurabh'], team_b: ['Arif', 'Gulshan'] },
  { round: 16, court: 2, team_a: ['Miten', 'Shravani'], team_b: ['Viki', 'Sid G'] },
  { round: 16, court: 3, team_a: ['Hiten', 'Ketan'], team_b: ['Priyesh', 'Anosh'] },
  
  { round: 17, court: 1, team_a: ['Hemal', 'Saurabh'], team_b: ['Shahnawaz', 'Gulshan'] },
  { round: 17, court: 2, team_a: ['Gopal', 'Shravani'], team_b: ['Sumiit', 'Sid G'] },
  { round: 17, court: 3, team_a: ['Tushar', 'Ketan'], team_b: ['Deep', 'Anosh'] },
  
  { round: 18, court: 1, team_a: ['Karan', 'Nimish'], team_b: ['Arif', 'Ansh'] },
  { round: 18, court: 2, team_a: ['Miten', 'Hitesh'], team_b: ['Viki', 'Nadeem'] },
  { round: 18, court: 3, team_a: ['Hiten', 'Amit'], team_b: ['Priyesh', 'Amreesh'] }
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
    team_a: r.team_a,
    team_b: r.team_b,
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
