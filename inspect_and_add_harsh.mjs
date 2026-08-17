import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
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
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';

  const { data: players } = await supabase.from('players').select('*').limit(1);
  if (players && players.length > 0) {
    console.log('Players table columns:', Object.keys(players[0]));
  }

  // Insert Harsh into players table
  const { data: pIns, error: pErr } = await supabase.from('players').insert({
    club_id: clubId,
    name: 'Harsh'
  }).select();

  if (pErr) console.error('Error adding Harsh:', pErr.message);
  else console.log('🎉 Successfully added Harsh to players table:', pIns);

  // Get session details for share token & URLs
  const { data: session } = await supabase.from('sessions').select('*').eq('id', 'hot101');
  console.log('\n--- SESSION HOT101 RECORD ---');
  console.log(session[0]);
}

run().catch(console.error);
