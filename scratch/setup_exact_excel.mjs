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
  // 1-POINTERS (League Stage)
  { round: 1, court: 1, team_a: ['Hemal', 'Karan'], team_b: ['Viki', 'Nadeem'] },
  { round: 1, court: 2, team_a: ['Gopal', 'Shrawani'], team_b: ['Deep', 'Anoush'] },
  { round: 1, court: 3, team_a: ['Hiten', 'Tushar'], team_b: ['Ansh', 'Shanawaz'] },

  { round: 2, court: 1, team_a: ['Karan', 'Saurabh'], team_b: ['Nadeem', 'Sumeet'] },
  { round: 2, court: 2, team_a: ['Gopal', 'Hitesh'], team_b: ['Deep', 'Priyesh'] },
  { round: 2, court: 3, team_a: ['Hiten', 'Ketan'], team_b: ['Ansh', 'Arif'] },

  { round: 3, court: 1, team_a: ['Saurabh', 'Nimish'], team_b: ['Viki', 'Sumeet'] },
  { round: 3, court: 2, team_a: ['Shrawani', 'Miten'], team_b: ['Deep', 'Amreesh'] },
  { round: 3, court: 3, team_a: ['Tushar', 'Amit'], team_b: ['Ansh', 'Gulshan'] },

  { round: 4, court: 1, team_a: ['Hemal', 'Nimish'], team_b: ['Nadeem', 'Sid'] },
  { round: 4, court: 2, team_a: ['Gopal', 'Miten'], team_b: ['Priyesh', 'Anoush'] },
  { round: 4, court: 3, team_a: ['Hiten', 'Amit'], team_b: ['Arif', 'Shanawaz'] },

  { round: 5, court: 1, team_a: ['Hemal', 'Saurabh'], team_b: ['Viki', 'Sid'] },
  { round: 5, court: 2, team_a: ['Hitesh', 'Shrawani'], team_b: ['Priyesh', 'Amreesh'] },
  { round: 5, court: 3, team_a: ['Ketan', 'Tushar'], team_b: ['Arif', 'Gulshan'] },

  { round: 6, court: 1, team_a: ['Karan', 'Nimish'], team_b: ['Sid', 'Sumeet'] },
  { round: 6, court: 2, team_a: ['Hitesh', 'Miten'], team_b: ['Anoush', 'Amreesh'] },
  { round: 6, court: 3, team_a: ['Ketan', 'Amit'], team_b: ['Shanawaz', 'Gulshan'] },

  // 2-POINTERS (League Stage)
  { round: 7, court: 1, team_a: ['Gopal', 'Miten'], team_b: ['Arif', 'Shanawaz'] },
  { round: 7, court: 2, team_a: ['Hiten', 'Amit'], team_b: ['Nadeem', 'Sid'] },
  { round: 7, court: 3, team_a: ['Hemal', 'Nimish'], team_b: ['Priyesh', 'Anoush'] },

  { round: 8, court: 1, team_a: ['Hitesh', 'Shrawani'], team_b: ['Arif', 'Gulshan'] },
  { round: 8, court: 2, team_a: ['Ketan', 'Tushar'], team_b: ['Nadeem', 'Sumeet'] },
  { round: 8, court: 3, team_a: ['Karan', 'Saurabh'], team_b: ['Priyesh', 'Amreesh'] },

  { round: 9, court: 1, team_a: ['Gopal', 'Shrawani'], team_b: ['Ansh', 'Shanawaz'] },
  { round: 9, court: 2, team_a: ['Hiten', 'Tushar'], team_b: ['Viki', 'Sid'] },
  { round: 9, court: 3, team_a: ['Hemal', 'Saurabh'], team_b: ['Deep', 'Anoush'] },

  { round: 10, court: 1, team_a: ['Hitesh', 'Miten'], team_b: ['Shanawaz', 'Gulshan'] },
  { round: 10, court: 2, team_a: ['Ketan', 'Amit'], team_b: ['Sid', 'Sumeet'] },
  { round: 10, court: 3, team_a: ['Karan', 'Nimish'], team_b: ['Viki', 'Nadeem'] },

  { round: 11, court: 1, team_a: ['Gopal', 'Hitesh'], team_b: ['Ansh', 'Arif'] },
  { round: 11, court: 2, team_a: ['Hiten', 'Ketan'], team_b: ['Viki', 'Sumeet'] },
  { round: 11, court: 3, team_a: ['Saurabh', 'Nimish'], team_b: ['Deep', 'Priyesh'] },

  { round: 12, court: 1, team_a: ['Shrawani', 'Miten'], team_b: ['Ansh', 'Gulshan'] },
  { round: 12, court: 2, team_a: ['Tushar', 'Amit'], team_b: ['Nadeem', 'Viki'] },
  { round: 12, court: 3, team_a: ['Hemal', 'Karan'], team_b: ['Deep', 'Amreesh'] },

  // 3-POINTERS (League Stage)
  { round: 13, court: 1, team_a: ['Hiten', 'Amit'], team_b: ['Priyesh', 'Anoush'] },
  { round: 13, court: 2, team_a: ['Saurabh', 'Nimish'], team_b: ['Ansh', 'Gulshan'] },
  { round: 13, court: 3, team_a: ['Gopal', 'Hitesh'], team_b: ['Viki', 'Nadeem'] },

  { round: 14, court: 1, team_a: ['Ketan', 'Tushar'], team_b: ['Priyesh', 'Amreesh'] },
  { round: 14, court: 2, team_a: ['Hemal', 'Karan'], team_b: ['Ansh', 'Arif'] },
  { round: 14, court: 3, team_a: ['Hitesh', 'Miten'], team_b: ['Sid', 'Sumeet'] },

  { round: 15, court: 1, team_a: ['Tushar', 'Amit'], team_b: ['Deep', 'Amreesh'] },
  { round: 15, court: 2, team_a: ['Karan', 'Nimish'], team_b: ['Shanawaz', 'Gulshan'] },
  { round: 15, court: 3, team_a: ['Shrawani', 'Miten'], team_b: ['Viki', 'Sumeet'] },

  { round: 16, court: 1, team_a: ['Ketan', 'Amit'], team_b: ['Anoush', 'Amreesh'] },
  { round: 16, court: 2, team_a: ['Hemal', 'Saurabh'], team_b: ['Ansh', 'Shanawaz'] },
  { round: 16, court: 3, team_a: ['Gopal', 'Shrawani'], team_b: ['Viki', 'Sid'] },

  { round: 17, court: 1, team_a: ['Hiten', 'Ketan'], team_b: ['Deep', 'Priyesh'] },
  { round: 17, court: 2, team_a: ['Karan', 'Saurabh'], team_b: ['Arif', 'Gulshan'] },
  { round: 17, court: 3, team_a: ['Gopal', 'Miten'], team_b: ['Nadeem', 'Sid'] },

  { round: 18, court: 1, team_a: ['Hiten', 'Tushar'], team_b: ['Deep', 'Anoush'] },
  { round: 18, court: 2, team_a: ['Hemal', 'Nimish'], team_b: ['Arif', 'Shanawaz'] },
  { round: 18, court: 3, team_a: ['Hitesh', 'Shrawani'], team_b: ['Nadeem', 'Sumeet'] }
];

async function run() {
  console.log("Aligning dynamic database to exact Excel schedule...");

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

  // Add Gold/Bronze final stage placeholders (Rounds 19 to 21)
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
    console.log(`Successfully populated all ${roundsToInsert.length} exact tournament matches!`);
  }
}

run().catch(console.error);
