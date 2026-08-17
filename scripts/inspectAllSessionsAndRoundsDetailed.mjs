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

async function inspectAllSessionsAndRounds() {
  console.log('=== INSPECTING ALL SESSIONS, CLUBS & TIMESTAMPS ===');
  const { data: sessions } = await supabase.from('sessions').select('*');
  const { data: clubs } = await supabase.from('clubs').select('*');
  const { data: rounds } = await supabase.from('rounds').select('*');

  console.log('Clubs List:');
  clubs.forEach(c => console.log(`- [${c.id}] ${c.name}`));

  console.log('\nSessions List:');
  sessions.forEach(s => {
    const sRounds = rounds.filter(r => r.session_id === s.id && r.score_a !== null && r.score_b !== null);
    const club = clubs.find(c => c.id === s.club_id);
    console.log(`- Session [${s.id}] | Club: "${club?.name || s.club_id}" (${s.club_id}) | Name: "${s.group_name}" | Date: ${s.created_at || s.date || 'N/A'} | Scored Rounds: ${sRounds.length}`);
  });

  console.log('\nCheck if any rounds exist without session_id or with other session_ids:');
  const sessionIds = new Set(sessions.map(s => s.id));
  const orphanRounds = rounds.filter(r => !sessionIds.has(r.session_id));
  console.log(`Orphan rounds count: ${orphanRounds.length}`);
}

inspectAllSessionsAndRounds();
