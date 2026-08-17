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

async function inspectSession() {
  const sessionId = '57gs7a';

  console.log('=== DETAILED INSPECTION FOR SESSION: 57gs7a (Pickle Boys) ===\n');

  // 1. Session Details
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId);
  console.log('Session Record:');
  console.log(session[0]);

  // 2. Rounds / Match Scores
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_number', { ascending: true });
  console.log(`\nTotal Rounds / Matches recorded: ${rounds ? rounds.length : 0}`);

  if (rounds && rounds.length > 0) {
    console.log('\n--- MATCH SCORES ---');
    rounds.forEach(r => {
      console.log(`Round ${r.round_number} (Court ${r.court}): ${r.team_a.join(' & ')} [${r.score_a ?? '-'}] vs [${r.score_b ?? '-'}] ${r.team_b.join(' & ')} (Status: ${r.status})`);
    });
  }

  // 3. Stage Config / Rosters
  const { data: stages } = await supabase.from('tournament_stages').select('*').eq('session_id', sessionId);
  console.log('\nStage Config:', stages);
}

inspectSession().catch(console.error);
