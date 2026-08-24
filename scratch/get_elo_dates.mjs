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

async function run() {
  const { data: snapshots, error } = await supabase
    .from('player_elo_snapshots')
    .select('*');

  if (error) {
    console.error(error);
    return;
  }

  // Get unique recorded times or sessions associated with matches
  const uniqueTimes = new Set();
  snapshots.forEach(s => {
    uniqueTimes.add(s.recorded_at.split('T')[0]);
  });
  console.log("Dates of ELO Updates:", Array.from(uniqueTimes));
}

run().catch(console.error);
