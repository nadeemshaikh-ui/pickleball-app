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

async function inspectPBSunday() {
  console.log('=== INSPECTING pb_sunday_2026 SESSION IN DETAIL ===');
  const { data: session } = await supabase.from('sessions').select('*').eq('id', 'pb_sunday_2026').single();
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', 'pb_sunday_2026').order('round_number');

  console.log('Session Object:', session);
  console.log('\nFirst 5 rounds in pb_sunday_2026:');
  rounds.slice(0, 5).forEach(r => {
    console.log(`R${r.round_number} Court ${r.court} | Team A: ${r.team_a?.join(' & ')} vs Team B: ${r.team_b?.join(' & ')} | Score: ${r.score_a} - ${r.score_b}`);
  });

  const { data: allSessions } = await supabase.from('sessions').select('*');
  console.log('\nALL SESSIONS FOR MONDAY WEDNESDAY CLUB OR OTHER CLUBS:');
  allSessions.forEach(s => {
    console.log(`[${s.id}] Group: "${s.group_name}" | Format: "${s.format}" | Club: "${s.club_id}" | Date: ${s.created_at}`);
  });
}

inspectPBSunday();
