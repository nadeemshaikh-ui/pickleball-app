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

async function inspectAugust12Session() {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', 'ea864a').single();
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', 'ea864a').order('round_number');

  console.log('=== AUGUST 12 SESSION AUDIT (ID: ea864a) ===');
  console.log('Session Details:', session);
  console.log(`\nTotal Scored Rounds in ea864a: ${rounds?.length || 0}`);
  if (rounds && rounds.length > 0) {
    console.table(rounds.map(r => ({
      Round: r.round_number,
      Court: r.court,
      TeamA: (r.team_a || []).join(' & '),
      TeamB: (r.team_b || []).join(' & '),
      Score: `${r.team_a_score || 0} - ${r.team_b_score || 0}`
    })));
  }

  // Also check if there are any other sessions created between Aug 11 and Aug 13
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('*')
    .gte('created_at', '2026-08-11T00:00:00Z');

  console.log('\n=== ALL SESSIONS CREATED SINCE AUG 11, 2026 ===');
  console.table(allSessions.map(s => ({
    ID: s.id,
    Club_ID: s.club_id,
    Name: s.group_name || s.name || 'N/A',
    Format: s.format,
    Status: s.status,
    Created_At: s.created_at
  })));
}

inspectAugust12Session();
