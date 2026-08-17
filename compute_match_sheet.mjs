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

async function matchSheet() {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', '57gs7a');
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', '57gs7a').order('round_number', { ascending: true });

  const allPlayers = session[0].players;

  console.log(`=== MATCH-WISE SCORE SHEET FOR SESSION 57gs7a (${session[0].group_name}) ===\n`);

  rounds.forEach((r, idx) => {
    const rnum = r.round_number;
    const tA = r.team_a.join(' & ');
    const tB = r.team_b.join(' & ');

    const sa = r.score_a != null ? r.score_a : '-';
    const sb = r.score_b != null ? r.score_b : '-';

    const active = new Set([...r.team_a, ...r.team_b]);
    const resting = allPlayers.filter(p => !active.has(p)).join(', ');

    let winner = 'Pending';
    if (r.score_a != null && r.score_b != null) {
      if (Number(r.score_a) > Number(r.score_b)) winner = `🏆 Team A (${tA})`;
      else if (Number(r.score_b) > Number(r.score_a)) winner = `🏆 Team B (${tB})`;
      else winner = 'Handshake / Tie';
    }

    console.log(`Round ${String(rnum).padStart(2, ' ')} | Team A: ${tA.padEnd(28)} [${String(sa).padStart(2, ' ')}] vs [${String(sb).padStart(2, ' ')}] Team B: ${tB.padEnd(28)} | Winner: ${winner.padEnd(35)} | Sitting Out: ${resting}`);
  });
}

matchSheet().catch(console.error);
