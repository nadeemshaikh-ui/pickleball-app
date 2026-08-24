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

const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';

async function run() {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`TOTAL SESSIONS DETECTED: ${sessions.length}\n`);

  for (const s of sessions) {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', s.id);

    const playersSet = new Set();
    if (rounds) {
      rounds.forEach(r => {
        if (r.team_a) r.team_a.forEach(p => playersSet.add(p));
        if (r.team_b) r.team_b.forEach(p => playersSet.add(p));
      });
    }

    const formattedDate = s.event_date || new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    console.log(`--------------------------------------------------`);
    console.log(`Session: ${s.group_name || s.id}`);
    console.log(`Date: ${formattedDate}`);
    console.log(`Status: ${s.status}`);
    console.log(`Format: ${s.format}`);
    console.log(`Players (${playersSet.size}): ${Array.from(playersSet).join(', ')}`);
  }
}

run().catch(console.error);
