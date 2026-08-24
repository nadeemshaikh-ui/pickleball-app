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

  console.log(`=== SCANNING ELO SNAPSHOT RECORDS FOR 'ANOSH' ===\n`);
  // Inspect keys
  if (snapshots.length > 0) {
    console.log("Keys available:", Object.keys(snapshots[0]));
    snapshots.forEach(s => {
      // Find keys containing 'anosh' or print matches
      const valuesStr = JSON.stringify(s).toLowerCase();
      if (valuesStr.includes('anosh')) {
        console.log("Match:", s);
      }
    });
  }
}

run().catch(console.error);
