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

async function inspectSessionRounds() {
  console.log('=== INSPECTING ALL SESSION ROUNDS & SESSION DETAILS ===');
  const { data: sessions } = await supabase.from('sessions').select('*');
  const { data: rounds } = await supabase.from('rounds').select('*');

  console.log('\n--- ALL SESSIONS IN SUPABASE ---');
  sessions.forEach(s => {
    const sRounds = rounds.filter(r => r.session_id === s.id && r.score_a !== null && r.score_b !== null);
    console.log(`Session [${s.id}] | Group Name: "${s.group_name}" | Created At: ${s.created_at} | Scored Rounds: ${sRounds.length}`);
  });

  console.log('\n--- ROUND COUNT BREAKDOWN BY SESSION_ID ---');
  const countsBySession = {};
  rounds.forEach(r => {
    if (r.score_a !== null && r.score_b !== null && (r.score_a > 0 || r.score_b > 0)) {
      countsBySession[r.session_id] = (countsBySession[r.session_id] || 0) + 1;
    }
  });

  Object.entries(countsBySession).forEach(([sid, count]) => {
    const sess = sessions.find(s => s.id === sid);
    console.log(`Session ID: "${sid}" -> ${count} scored matches | Session Name: "${sess?.group_name}" | Date: ${sess?.created_at}`);
  });
}

inspectSessionRounds();
