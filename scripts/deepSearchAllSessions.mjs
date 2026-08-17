import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let serviceKey = '';

envLines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, serviceKey);

async function deepSearchAllSessions() {
  console.log('=== SEARCHING ALL CLUBS & SESSIONS ===');
  const { data: clubs } = await supabase.from('clubs').select('*');
  const { data: sessions } = await supabase.from('sessions').select('*');
  const { data: rounds } = await supabase.from('rounds').select('*');

  console.log('Total Clubs:', clubs.length);
  console.log('Total Sessions:', sessions.length);
  console.log('Total Rounds:', rounds.length);

  sessions.forEach(s => {
    const sRounds = rounds.filter(r => r.session_id === s.id && r.score_a !== null && r.score_b !== null);
    const club = clubs.find(c => c.id === s.club_id);
    const playerSet = new Set();
    sRounds.forEach(r => {
      (r.team_a || []).forEach(p => playerSet.add(p));
      (r.team_b || []).forEach(p => playerSet.add(p));
    });

    console.log(`\n--------------------------------------------------`);
    console.log(`Session ID: "${s.id}"`);
    console.log(`Club: "${club?.name || s.club_id}"`);
    console.log(`Group/Name: "${s.group_name}"`);
    console.log(`Format: "${s.format}" | Status: "${s.status}"`);
    console.log(`Scored Rounds: ${sRounds.length}`);
    console.log(`Players (${playerSet.size}): ${Array.from(playerSet).sort().join(', ')}`);
  });
}

deepSearchAllSessions();
