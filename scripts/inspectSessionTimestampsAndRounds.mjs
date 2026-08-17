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

async function inspectSessionsDeep() {
  const { data: sessions } = await supabase.from('sessions').select('*');
  console.log('=== ALL SESSIONS IN SUPABASE ===');
  console.table(sessions.map(s => ({
    ID: s.id,
    Club_ID: s.club_id,
    Group_Name: s.group_name || s.name || 'N/A',
    Format: s.format,
    Status: s.status,
    Created_At: s.created_at,
    Updated_At: s.updated_at
  })));

  // Compare rounds between mw_mavericks_season_2_2026 and pb_sunday_2026
  const { data: r1 } = await supabase.from('rounds').select('*').eq('session_id', 'mw_mavericks_season_2_2026');
  const { data: r2 } = await supabase.from('rounds').select('*').eq('session_id', 'pb_sunday_2026');

  console.log(`\nRounds in mw_mavericks_season_2_2026: ${r1?.length || 0}`);
  console.log(`Rounds in pb_sunday_2026: ${r2?.length || 0}`);

  if (r1 && r2) {
    console.log('\n--- Sample First 5 Rounds from mw_mavericks_season_2_2026 ---');
    console.table(r1.slice(0, 5).map(r => ({
      Round: r.round_number,
      Court: r.court,
      TeamA: (r.team_a || []).join(' & '),
      TeamB: (r.team_b || []).join(' & '),
      Score: `${r.team_a_score || 0} - ${r.team_b_score || 0}`
    })));

    console.log('\n--- Sample First 5 Rounds from pb_sunday_2026 ---');
    console.table(r2.slice(0, 5).map(r => ({
      Round: r.round_number,
      Court: r.court,
      TeamA: (r.team_a || []).join(' & '),
      TeamB: (r.team_b || []).join(' & '),
      Score: `${r.team_a_score || 0} - ${r.team_b_score || 0}`
    })));

    // Check how many exact score & player matches exist between r1 and r2
    let identicalCount = 0;
    r1.forEach(round1 => {
      const match = r2.find(round2 => 
        round2.round_number === round1.round_number &&
        round2.court === round1.court &&
        JSON.stringify(round2.team_a) === JSON.stringify(round1.team_a) &&
        JSON.stringify(round2.team_b) === JSON.stringify(round1.team_b) &&
        round2.team_a_score === round1.team_a_score &&
        round2.team_b_score === round1.team_b_score
      );
      if (match) identicalCount++;
    });

    console.log(`\nExact Identical Matches between Season 1 & Season 2: ${identicalCount} out of ${r1.length}`);
  }
}

inspectSessionsDeep();
