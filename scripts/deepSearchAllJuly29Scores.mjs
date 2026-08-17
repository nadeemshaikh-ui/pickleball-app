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

async function deepSearchJuly29() {
  console.log('=== DEEP SEARCHING ALL SUPABASE TABLES & ROUNDS FOR JULY 29 SCORES ===\n');

  // Fetch all tables from information_schema if possible or query known tables
  const tables = [
    'rounds',
    'sessions',
    'tournaments',
    'tournament_stages',
    'tournament_fixtures',
    'tournament_standings',
    'players',
    'club_members'
  ];

  for (const tableName of tables) {
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.log(`Table '${tableName}' error: ${error.message}`);
        continue;
      }
      console.log(`Table '${tableName}' has ${data?.length || 0} rows.`);

      if (tableName === 'rounds') {
        const scoredRounds = (data || []).filter(r => (r.team_a_score || 0) > 0 || (r.team_b_score || 0) > 0);
        console.log(`\n---> Total Scored Rounds in Entire DB: ${scoredRounds.length}`);
        
        const bySession = new Map();
        scoredRounds.forEach(r => {
          if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
          bySession.get(r.session_id).push(r);
        });

        for (const [sid, rList] of bySession.entries()) {
          console.log(`\nSession '${sid}' has ${rList.length} scored rounds.`);
          console.table(rList.slice(0, 5).map(r => ({
            Round: r.round_number,
            Court: r.court,
            TeamA: (r.team_a || []).join(' & '),
            TeamB: (r.team_b || []).join(' & '),
            Score: `${r.team_a_score} - ${r.team_b_score}`
          })));
        }
      }
    } catch (e) {
      console.log(`Error inspecting ${tableName}:`, e.message);
    }
  }

  // Also check artifact files / workspace data for Home Team vs Challengers or July 29th
  console.log('\n=== SEARCHING ARTIFACT FILES & WORKSPACE FOR JULY 29 PDF/REPORTS ===');
  const artifactDir = path.resolve(process.cwd(), '../.gemini/antigravity/brain/3d633335-c773-43f9-9a42-61b9a52d9729');
  if (fs.existsSync(artifactDir)) {
    const files = fs.readdirSync(artifactDir);
    const julFiles = files.filter(f => f.toLowerCase().includes('july') || f.toLowerCase().includes('challengers') || f.toLowerCase().includes('home'));
    console.log('Matching Artifact Files:', julFiles);
  }
}

deepSearchJuly29();
