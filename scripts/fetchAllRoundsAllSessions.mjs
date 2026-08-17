import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let serviceKey = '';

envLines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = line.split('=')[1].trim();
  }
});

const supabase = createClient(supabaseUrl, serviceKey);

async function checkAllRounds() {
  const { data: sessions } = await supabase.from('sessions').select('*');
  const { data: rounds } = await supabase.from('rounds').select('*');
  const scoredRounds = rounds.filter(r => r.score_a !== null && r.score_b !== null);

  console.log(`Total Sessions: ${sessions.length}`);
  console.log(`Total Rounds: ${rounds.length} (Scored: ${scoredRounds.length})`);

  sessions.forEach(s => {
    const sRounds = rounds.filter(r => r.session_id === s.id && r.score_a !== null && r.score_b !== null);
    console.log(`Session [${s.id}] (${s.group_name || s.format}): ${sRounds.length} scored rounds`);
  });
}

checkAllRounds();
