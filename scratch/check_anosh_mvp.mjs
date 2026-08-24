import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('C:\\Users\\Nadeem\\Documents\\pickleball-app\\.env.local', 'utf8');
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

async function checkSession(id) {
  const { data: s } = await supabase.from('sessions').select('*').eq('id', id).single();
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', id);

  console.log(`\nChecking Session: ${s.group_name || s.id} (${s.id})`);
  console.log(`Status: ${s.status}`);
  console.log(`Total Rounds in DB: ${rounds ? rounds.length : 0}`);
  
  const scored = rounds ? rounds.filter(r => r.score_a !== null) : [];
  console.log(`Total Scored Rounds: ${scored.length}`);

  if (scored.length > 0) {
    const wins = {};
    scored.forEach(r => {
      const aWon = r.score_a > r.score_b;
      const winners = aWon ? r.team_a : r.team_b;
      winners.forEach(p => {
        wins[p] = (wins[p] || 0) + 1;
      });
    });
    const sorted = Object.keys(wins).map(n => ({ name: n, wins: wins[n] })).sort((a,b) => b.wins - a.wins);
    console.log("Leaderboard Top 3:");
    sorted.slice(0, 3).forEach(x => console.log(`- ${x.name}: ${x.wins} wins`));
  }
}

async function run() {
  await checkSession('hot101');
  await checkSession('200tao');
}

run().catch(console.error);
