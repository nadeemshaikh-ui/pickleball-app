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

async function findNadeemMatches() {
  console.log('================ SEARCHING ALL MATCHES FOR NADEEM / NADIM / BLAZE ================');

  // 1. Search all rounds across all sessions
  const { data: rounds } = await supabase.from('rounds').select('*');
  const { data: sessions } = await supabase.from('sessions').select('*');
  const { data: clubs } = await supabase.from('clubs').select('*');

  console.log('Total Rounds in DB:', rounds.length);

  const nadeemRounds = rounds.filter(r => {
    const all = [...(r.team_a || []), ...(r.team_b || [])];
    return all.some(p => {
      const l = p.toLowerCase();
      return l.includes('nadim') || l.includes('nadeem') || l.includes('blaze');
    });
  });

  console.log('Rounds containing Nadeem count:', nadeemRounds.length);

  // Search all unique players in all 172 rounds
  const allMatchPlayers = new Set();
  rounds.forEach(r => {
    (r.team_a || []).forEach(p => allMatchPlayers.add(p));
    (r.team_b || []).forEach(p => allMatchPlayers.add(p));
  });

  console.log('\n--- ALL 33 UNIQUE PLAYER NAMES IN SCORED MATCHES ---');
  console.log(Array.from(allMatchPlayers).sort());
}

findNadeemMatches();
