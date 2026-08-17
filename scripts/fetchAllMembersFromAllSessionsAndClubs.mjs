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

async function extractAllMembersEverywhere() {
  const { data: clubs } = await supabase.from('clubs').select('*');
  const { data: sessions } = await supabase.from('sessions').select('*');
  const { data: rounds } = await supabase.from('rounds').select('*');

  console.log('=== COMPLETE EXHAUSTIVE MEMBER EXTRACTION FOR ALL CLUBS ===\n');

  for (const c of clubs) {
    const cSessions = sessions.filter(s => s.club_id === c.id);
    const cSessionIds = cSessions.map(s => s.id);
    const cRounds = rounds.filter(r => cSessionIds.includes(r.session_id));

    const allPlayerNames = new Set();

    // From session players arrays
    cSessions.forEach(s => {
      (s.players || []).forEach(p => {
        if (typeof p === 'string') allPlayerNames.add(p);
        else if (p?.name) allPlayerNames.add(p.name);
      });
      if (s.squads) {
        Object.values(s.squads).forEach(sq => {
          (sq.players || sq || []).forEach(p => {
            if (typeof p === 'string') allPlayerNames.add(p);
            else if (p?.name) allPlayerNames.add(p.name);
          });
        });
      }
    });

    // From rounds team_a and team_b
    cRounds.forEach(r => {
      (r.team_a || []).forEach(p => allPlayerNames.add(p));
      (r.team_b || []).forEach(p => allPlayerNames.add(p));
    });

    console.log(`\n======================================================`);
    console.log(`CLUB: ${c.name.toUpperCase()} (ID: ${c.id})`);
    console.log(`Sessions Count: ${cSessions.length} | Scored Rounds: ${cRounds.length}`);
    console.log(`Extracted Members Count: ${allPlayerNames.size}`);
    console.log(`------------------------------------------------------`);
    console.log(Array.from(allPlayerNames).sort().join('\n'));
  }
}

extractAllMembersEverywhere();
