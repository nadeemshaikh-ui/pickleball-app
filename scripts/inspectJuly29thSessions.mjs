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

async function inspectJulySessions() {
  console.log('=== SEARCHING ALL SESSIONS FROM JULY 2026 ===\n');

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .or('created_at.gte.2026-07-20T00:00:00Z,event_date.gte.2026-07-20');

  console.table(sessions.map(s => ({
    ID: s.id,
    Club_ID: s.club_id,
    Name: s.group_name || s.name || 'N/A',
    Format: s.format,
    Status: s.status,
    Created_At: s.created_at,
    Event_Date: s.event_date || 'N/A',
    Player_Count: (s.players || []).length
  })));

  for (const s of sessions) {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', s.id);

    const scoredCount = (rounds || []).filter(r => (r.team_a_score || 0) > 0 || (r.team_b_score || 0) > 0).length;

    console.log(`\n================ Session ID: ${s.id} (${s.group_name || 'Unnamed'}) ================`);
    console.log(`Created At: ${s.created_at} | Event Date: ${s.event_date || 'N/A'}`);
    console.log(`Total Rounds: ${rounds?.length || 0} | Scored Rounds: ${scoredCount}`);
    if (rounds && rounds.length > 0) {
      console.log('Sample Rounds:');
      console.table(rounds.slice(0, 5).map(r => ({
        Round: r.round_number,
        Court: r.court,
        TeamA: (r.team_a || []).join(' & '),
        TeamB: (r.team_b || []).join(' & '),
        Score: `${r.team_a_score || 0} - ${r.team_b_score || 0}`
      })));
    }
  }
}

inspectJulySessions();
