import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let serviceKey = '';

envLines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = line.split('=')[1].trim();
  }
});

const supabase = createClient(supabaseUrl, serviceKey);

async function analyze() {
  console.log('--- FETCHING CLUBS ---');
  const { data: clubs, error: cErr } = await supabase.from('clubs').select('*');
  console.log('Clubs count:', clubs?.length);
  if (clubs) {
    clubs.forEach(c => console.log(`Club ID: ${c.id} | Name: ${c.name} | Slug: ${c.slug}`));
  }

  console.log('\n--- FETCHING ALL SESSIONS ---');
  const { data: sessions, error: sErr } = await supabase.from('sessions').select('*').order('created_at', { ascending: false });
  console.log('Sessions count:', sessions?.length);
  if (sessions) {
    sessions.forEach(s => console.log(`Session ID: ${s.id} | Club ID: ${s.club_id} | Group: ${s.group_name} | Format: ${s.format} | Rounds: ${s.round_count} | Status: ${s.status}`));
  }

  console.log('\n--- FETCHING ALL ROUNDS WITH SCORES ---');
  const { data: rounds, error: rErr } = await supabase.from('rounds').select('*');
  const scoredRounds = rounds?.filter(r => r.score_a !== null && r.score_b !== null) || [];
  console.log(`Total Rounds: ${rounds?.length} | Scored Rounds: ${scoredRounds.length}`);

  console.log('\n--- FETCHING ALL PLAYERS ---');
  const { data: players } = await supabase.from('players').select('*');
  console.log('Players count:', players?.length);
}

analyze();
