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

async function checkDateMatches(dateStr) {
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('*')
    .like('created_at', `${dateStr}%`);

  if (error) {
    console.error(error);
    return;
  }

  const anoshRounds = rounds.filter(r => 
    (r.team_a && r.team_a.some(p => p.toLowerCase().includes('anosh'))) ||
    (r.team_b && r.team_b.some(p => p.toLowerCase().includes('anosh')))
  );

  console.log(`\nDate: ${dateStr}`);
  console.log(`Total Rounds logged on this date: ${rounds.length}`);
  console.log(`Matches played by Anosh on this date: ${anoshRounds.length}`);
  if (anoshRounds.length > 0) {
    console.log("Unique Sessions for Anosh on this date:", Array.from(new Set(anoshRounds.map(r => r.session_id))));
  }
}

async function run() {
  await checkDateMatches('2026-07-29');
  await checkDateMatches('2026-08-05');
}

run().catch(console.error);
