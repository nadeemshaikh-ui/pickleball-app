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

const sessionId = 'hotshot_session_thursday';

async function run() {
  const { data: session, error: sErr } = await supabase.from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    console.error("Session fetch error:", sErr);
    return;
  }

  const { data: rounds, error: rErr } = await supabase.from('rounds')
    .select('*')
    .eq('session_id', sessionId);

  if (rErr) {
    console.error("Rounds fetch error:", rErr);
    return;
  }

  const scoredRounds = rounds ? rounds.filter(r => r.score_a !== null && r.score_b !== null) : [];

  console.log("=================== SESSION AUDIT: hotshot_session_thursday ===================");
  console.log(`Format: ${session.format}`);
  console.log(`Status: ${session.status}`);
  console.log(`Total Rounds in Database: ${rounds ? rounds.length : 0}`);
  console.log(`Total Scored Rounds: ${scoredRounds.length}`);
  if (scoredRounds.length > 0) {
    console.log("\n--- Sample Scored Rounds ---");
    scoredRounds.slice(0, 3).forEach(r => {
      console.log(`Round ${r.round_number} Court ${r.court}: ${r.team_a.join('&')} vs ${r.team_b.join('&')} -> ${r.score_a}-${r.score_b}`);
    });
  }
}

run().catch(console.error);
