import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > -1) {
    const k = l.substring(0, idx).trim();
    let v = l.substring(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function verifyRoundsData() {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', 'hot101').single();
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', 'hot101');

  console.log('--- SESSION DATA ---');
  console.log('ID:', session.id);
  console.log('Format:', session.format);
  console.log('Group Name:', session.group_name);
  console.log('Round Count:', session.round_count);

  console.log('\n--- ROUNDS DATA ---');
  console.log('Total Rounds Fetched:', rounds ? rounds.length : 0);

  if (rounds && rounds.length > 0) {
    const roundsByNum = {};
    rounds.forEach(r => {
      if (!roundsByNum[r.round_number]) roundsByNum[r.round_number] = [];
      roundsByNum[r.round_number].push(r);
    });

    console.log('Round 1 Matches Count:', roundsByNum[1] ? roundsByNum[1].length : 0);
    if (roundsByNum[1]) {
      roundsByNum[1].forEach(m => {
        console.log(`  Court ${m.court}: ${m.team_a.join(' & ')} vs ${m.team_b.join(' & ')} (Rest: ${m.sitting_out ? m.sitting_out.join(', ') : 'None'})`);
      });
    }
  }
}

verifyRoundsData().catch(console.error);
