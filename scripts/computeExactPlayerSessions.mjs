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

async function computePlayerSessions() {
  const clubId = 'd5b57890-3787-41bb-bf23-38bc95345011';
  const { data: players } = await supabase.from('players').select('*').eq('club_id', clubId);
  const { data: rounds } = await supabase.from('rounds').select('*');

  console.log('Monday-Wednesday Registered Players count:', players.length);

  const playerSessionMap = new Map();

  rounds.forEach(r => {
    if (r.score_a !== null && r.score_b !== null) {
      const allPlayersInMatch = [...(r.team_a || []), ...(r.team_b || [])];
      allPlayersInMatch.forEach(p => {
        if (!playerSessionMap.has(p)) {
          playerSessionMap.set(p, new Set());
        }
        playerSessionMap.get(p).add(r.session_id);
      });
    }
  });

  console.log('\n--- PLAYER SESSIONS PLAYED COUNT ---');
  for (const [pName, sSet] of playerSessionMap.entries()) {
    console.log(`Player [${pName}]: ${sSet.size} Sessions Played (Session IDs: ${Array.from(sSet).join(', ')})`);
  }
}

computePlayerSessions();
