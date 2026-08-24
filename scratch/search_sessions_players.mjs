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
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*');

  if (error) {
    console.error(error);
    return;
  }

  console.log("=== SCANNING ALL SESSION PLAYER LISTS FOR 'ANOSH' ===\n");
  for (const s of sessions) {
    const hasAnoshInList = s.players && s.players.some(p => p.toLowerCase().includes('anosh'));
    
    // Also look at squads
    let hasAnoshInSquads = false;
    if (s.squads) {
      s.squads.forEach(sq => {
        if (sq.players && sq.players.some(p => p.toLowerCase().includes('anosh'))) {
          hasAnoshInSquads = true;
        }
      });
    }

    if (hasAnoshInList || hasAnoshInSquads) {
      console.log(`Found Session: ${s.group_name || s.id} (${s.id})`);
      console.log(`Date: ${s.event_date || s.created_at}`);
      console.log(`Club ID: ${s.club_id}`);
      console.log(`Players List: ${s.players ? s.players.join(', ') : 'None'}`);
      console.log(`--------------------------------------------------`);
    }
  }
}

run().catch(console.error);
