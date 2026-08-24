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

async function run() {
  const { data: logs, error } = await supabase
    .from('rapid_fire_log')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`=== RAPID FIRE LOGS FOR ${sessionId} ===`);
  console.log(`Total logged rallies: ${logs.length}`);
  if (logs.length > 0) {
    console.log("Rallies details:");
    logs.forEach(l => {
      console.log(`- Order: ${l.event_order} | Scoring: ${l.scoring_team_id} | Players: ${l.on_court_players?.join(', ')}`);
    });
  }
}

run().catch(console.error);
