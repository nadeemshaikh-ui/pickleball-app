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

async function forensicAudit() {
  console.log('================ FORENSIC AUDIT FOR MONDAY-WEDNESDAY CLUB ================');

  // 1. Fetch Club Info
  const clubId = 'd5b57890-3787-41bb-bf23-38bc95345011';
  const { data: club } = await supabase.from('clubs').select('*').eq('id', clubId).single();
  console.log('\n--- CLUB METADATA ---');
  console.log(club);

  // 2. Fetch Club Members
  const { data: members } = await supabase.from('club_members').select('*').eq('club_id', clubId);
  console.log(`\n--- CLUB MEMBERS (${members.length}) ---`);
  console.log(members.map(m => m.name || m.user_id));

  // 3. Fetch Players table for this club
  const { data: players } = await supabase.from('players').select('*').eq('club_id', clubId);
  console.log(`\n--- CLUB PLAYERS TABLE (${players.length}) ---`);
  console.log(players.map(p => ({ id: p.id, name: p.name, nickname: p.nickname })));

  // 4. Fetch ALL Sessions in Supabase and check which ones are Monday-Wednesday Club
  const { data: allSessions } = await supabase.from('sessions').select('*');
  console.log(`\n--- ALL SESSIONS IN SUPABASE (${allSessions.length}) ---`);
  allSessions.forEach(s => {
    console.log(`Session [${s.id}] | Club ID: ${s.club_id} | Group/Name: ${s.group_name} | Format: ${s.format} | Status: ${s.status}`);
  });

  // 5. Inspect Rounds for EVERY Session to find exact player lists & tournament names
  const { data: allRounds } = await supabase.from('rounds').select('*');
  console.log(`\n--- ROUNDS PER SESSION ---`);
  for (const s of allSessions) {
    const sRounds = allRounds.filter(r => r.session_id === s.id && r.score_a !== null && r.score_b !== null);
    const pSet = new Set();
    sRounds.forEach(r => {
      (r.team_a || []).forEach(p => pSet.add(p));
      (r.team_b || []).forEach(p => pSet.add(p));
    });
    console.log(`Session [${s.id}] (${s.group_name || s.format}): ${sRounds.length} scored rounds. Players (${pSet.size}):`, Array.from(pSet).sort().join(', '));
  }
}

forensicAudit();
