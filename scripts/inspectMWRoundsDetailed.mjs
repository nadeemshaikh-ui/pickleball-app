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

async function inspectMWRoundsDetailed() {
  console.log('=== SEARCHING ALL SESSIONS & ROUNDS FOR MONDAY-WEDNESDAY CLUB ===\n');

  const { data: mwSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('club_id', 'd5b57890-3787-41bb-bf23-38bc95345011');

  console.log('Monday-Wednesday Club Sessions in DB:');
  console.table(mwSessions);

  const { data: allRounds } = await supabase
    .from('rounds')
    .select('*')
    .in('session_id', ['mw_mavericks_season_2_2026', '1u03ob', 'ea864a', 'pb_sunday_2026'])
    .order('created_at', { ascending: false });

  console.log(`\nTotal rounds across all candidate sessions: ${allRounds?.length || 0}`);

  // Group rounds by session_id and check scored vs non-zero scores
  const sessionStats = new Map();
  (allRounds || []).forEach(r => {
    if (!sessionStats.has(r.session_id)) {
      sessionStats.set(r.session_id, { total: 0, scored: 0, sampleRounds: [] });
    }
    const stat = sessionStats.get(r.session_id);
    stat.total++;
    const isScored = (r.team_a_score > 0 || r.team_b_score > 0);
    if (isScored) stat.scored++;
    if (stat.sampleRounds.length < 3) {
      stat.sampleRounds.push({
        Round: r.round_number,
        Court: r.court,
        TeamA: (r.team_a || []).join(' & '),
        TeamB: (r.team_b || []).join(' & '),
        Score: `${r.team_a_score || 0} - ${r.team_b_score || 0}`,
        Created_At: r.created_at
      });
    }
  });

  for (const [sid, stat] of sessionStats.entries()) {
    console.log(`\n================ Session ID: ${sid} ================`);
    console.log(`Total Rounds: ${stat.total} | Scored Rounds (score > 0): ${stat.scored}`);
    console.table(stat.sampleRounds);
  }
}

inspectMWRoundsDetailed();
