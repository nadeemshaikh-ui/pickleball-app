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

async function computeStandings() {
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', '57gs7a');

  const stats = {};
  const init = p => {
    if (!stats[p]) stats[p] = { name: p, played: 0, wins: 0, losses: 0, pf: 0, pa: 0, diff: 0 };
  };

  rounds.forEach(r => {
    if (r.score_a != null && r.score_b != null) {
      const sa = Number(r.score_a);
      const sb = Number(r.score_b);

      r.team_a.forEach(init);
      r.team_b.forEach(init);

      r.team_a.forEach(p => {
        stats[p].played++;
        stats[p].pf += sa;
        stats[p].pa += sb;
        if (sa > sb) stats[p].wins++;
        else stats[p].losses++;
      });

      r.team_b.forEach(p => {
        stats[p].played++;
        stats[p].pf += sb;
        stats[p].pa += sa;
        if (sb > sa) stats[p].wins++;
        else stats[p].losses++;
      });
    }
  });

  const sorted = Object.values(stats).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    if (diffB !== diffA) return diffB - diffA;
    return b.pf - a.pf;
  });

  console.log('=== STANDINGS FOR SESSION 57gs7a (Pickle Boys) ===\n');
  sorted.forEach((p, idx) => {
    const diff = p.pf - p.pa;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    console.log(`${idx + 1}. ${p.name.padEnd(16)} | W-L: ${p.wins}-${p.losses} | Matches: ${p.played} | PF: ${p.pf} | PA: ${p.pa} | Diff: ${diffStr}`);
  });
}

computeStandings().catch(console.error);
