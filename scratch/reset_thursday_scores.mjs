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
  console.log(`Resetting all scores for session '${sessionId}'...`);

  // Clear score_a and score_b for all rounds belonging to this session
  const { error: rErr } = await supabase
    .from('rounds')
    .update({ score_a: null, score_b: null })
    .eq('session_id', sessionId);

  if (rErr) {
    console.error("Error clearing scores in rounds table:", rErr);
    return;
  }

  // Set status of session back to 'in_progress' (no completed_at column exists in schema)
  const { error: sErr } = await supabase
    .from('sessions')
    .update({ status: 'in_progress' })
    .eq('id', sessionId);

  if (sErr) {
    console.error("Error resetting session status:", sErr);
    return;
  }

  // Delete generated final stage rounds 9, 10, 11 if any exist
  const { error: dErr } = await supabase
    .from('rounds')
    .delete()
    .eq('session_id', sessionId)
    .gte('round_number', 9);

  if (dErr) {
    console.error("Error cleaning final stage rounds:", dErr);
    return;
  }

  console.log("All tournament scores successfully reset in database!");
}

run().catch(console.error);
