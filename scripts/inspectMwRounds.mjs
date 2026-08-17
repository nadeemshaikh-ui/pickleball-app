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

async function checkMwRounds() {
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', 'mw_mavericks_season_2_2026')
    .order('round_number', { ascending: true })
    .order('court', { ascending: true });

  if (error) {
    console.error('Error fetching rounds:', error);
    return;
  }

  console.log(`Total rows in DB: ${rounds.length}`);
  if (rounds.length > 0) {
    console.log('Sample Round 1 Court 1:', rounds[0]);
    console.log('Sample Round 1 Court 2:', rounds[1]);
  }
}

checkMwRounds();
