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

async function inspectJuly29thDetails() {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', '1u03ob').single();
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', '1u03ob').order('round_number').order('court');

  console.log('=== JULY 29TH EVENT DETAILS (Session 1u03ob) ===');
  console.log('Session metadata:', {
    ID: session.id,
    Name: session.group_name,
    Format: session.format,
    Venue: session.venue || 'Juhu Millennium Club',
    StartTime: session.start_time || '8:00 PM',
    TotalPlayers: (session.players || []).length,
    Players: session.players
  });

  console.log(`\nTotal Scored Rounds/Matches Recorded: ${rounds?.length || 0}`);
  if (rounds && rounds.length > 0) {
    console.table(rounds.map(r => ({
      Round: r.round_number,
      Court: r.court,
      TeamA: (r.team_a || []).join(' & '),
      TeamB: (r.team_b || []).join(' & '),
      Score: `${r.team_a_score || 0} - ${r.team_b_score || 0}`
    })));
  }
}

inspectJuly29thDetails();
