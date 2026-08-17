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

async function inspectSession() {
  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', 'ea864a')
    .single();

  if (sErr) {
    console.error('Error fetching session ea864a:', sErr);
    return;
  }

  console.log('Session metadata for ea864a:');
  console.log(JSON.stringify(session, null, 2));

  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', 'ea864a')
    .order('round_number', { ascending: true })
    .order('court', { ascending: true });

  if (rErr) {
    console.error('Error fetching rounds:', rErr);
    return;
  }

  console.log(`Total rounds for session ea864a: ${rounds.length}`);
  if (rounds.length > 0) {
    console.log('First 5 rounds:');
    console.log(JSON.stringify(rounds.slice(0, 5), null, 2));
  }
}

inspectSession();
