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

async function deepAuditClubs() {
  console.log('================ DEEP CLUB MEMBERS & SESSIONS AUDIT ================');

  // 1. Fetch all clubs
  const { data: clubs } = await supabase.from('clubs').select('*');
  console.log('Total Clubs:', clubs.length);
  clubs.forEach(c => console.log(`Club [${c.id}]: ${c.name}`));

  // 2. Fetch all club_members
  const { data: members } = await supabase.from('club_members').select('*');
  console.log('Total Club Members across all clubs:', members.length);

  // 3. Fetch all players
  const { data: players } = await supabase.from('players').select('*');
  console.log('Total Registered Players in players table:', players.length);

  // 4. Search for Nadeem / Nadim & Sumit / Sumiit
  const nadeemPlayers = players.filter(p => p.name && (p.name.toLowerCase().includes('nadim') || p.name.toLowerCase().includes('nadeem')));
  const sumitPlayers = players.filter(p => p.name && (p.name.toLowerCase().includes('sumit') || p.name.toLowerCase().includes('sumiit')));

  console.log('\n--- NADEEM / NADIM PLAYERS ---');
  console.log(nadeemPlayers);

  console.log('\n--- SUMIT / SUMIIT PLAYERS ---');
  console.log(sumitPlayers);

  // 5. Inspect players per club
  for (const c of clubs) {
    const cPlayers = players.filter(p => p.club_id === c.id);
    const cMembers = members.filter(m => m.club_id === c.id);
    console.log(`\n========================================`);
    console.log(`Club: "${c.name}" (ID: ${c.id})`);
    console.log(`Players (${cPlayers.length}):`, cPlayers.map(p => p.name).sort().join(', '));
  }

  // 6. Inspect ALL sessions and see which club they belong to
  const { data: sessions } = await supabase.from('sessions').select('*');
  console.log('\n================ ALL SESSIONS & CLUBS ================');
  for (const s of sessions) {
    const club = clubs.find(c => c.id === s.club_id);
    const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', s.id);
    const scored = rounds.filter(r => r.score_a !== null && r.score_b !== null);

    const playerSet = new Set();
    scored.forEach(r => {
      (r.team_a || []).forEach(p => playerSet.add(p));
      (r.team_b || []).forEach(p => playerSet.add(p));
    });

    console.log(`Session ID: ${s.id} | Club: "${club?.name || s.club_id}" | Group: "${s.group_name}" | Scored Rounds: ${scored.length} | Active Players: ${Array.from(playerSet).sort().join(', ')}`);
  }
}

deepAuditClubs();
