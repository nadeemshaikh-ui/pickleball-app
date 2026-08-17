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

async function checkAllocations() {
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', 'ea864a')
    .order('round_number', { ascending: true })
    .order('court', { ascending: true });

  const roundsPerBlock = 6;
  const blocks = [
    { blockIndex: 1, label: 'Hour 1 (Rounds 1–6)', start: 1, end: 6 },
    { blockIndex: 2, label: 'Hour 2 (Rounds 7–12)', start: 7, end: 12 }
  ];

  blocks.forEach(b => {
    console.log(`\n=== ${b.label} ===`);
    const blockRounds = rounds.filter(r => r.round_number >= b.start && r.round_number <= b.end);
    
    [1, 2].forEach(courtNum => {
      const courtRounds = blockRounds.filter(r => r.court === courtNum);
      const courtPlayers = [...new Set(courtRounds.flatMap(r => [...(r.team_a||[]), ...(r.team_b||[]), ...(r.sitting_out||[])]))];
      console.log(`Court ${courtNum} Allocation (${courtPlayers.length} Players):`, courtPlayers.join(', '));
    });
  });
}

checkAllocations();
