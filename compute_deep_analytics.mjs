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

async function computeDeepAnalytics() {
  const sessionId = '57gs7a';
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId);
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_number', { ascending: true });

  const players = session[0].players;
  console.log(`=== DEEP TOURNAMENT ANALYTICS & H2H RIVALRIES FOR SESSION ${sessionId} (${session[0].group_name}) ===\n`);

  // 1. Head-to-Head Matrix Initialization
  const h2h = {};
  players.forEach(p1 => {
    h2h[p1] = {};
    players.forEach(p2 => {
      if (p1 !== p2) {
        h2h[p1][p2] = { played: 0, wins: 0, losses: 0, pf: 0, pa: 0 };
      }
    });
  });

  // 2. Partnerships Initialization
  const partnerships = {};

  rounds.forEach(r => {
    if (r.score_a != null && r.score_b != null) {
      const sa = Number(r.score_a);
      const sb = Number(r.score_b);

      const tA = r.team_a;
      const tB = r.team_b;

      // Track Partnerships
      const pKeyA = [...tA].sort().join(' & ');
      const pKeyB = [...tB].sort().join(' & ');

      if (!partnerships[pKeyA]) partnerships[pKeyA] = { pair: pKeyA, played: 0, wins: 0, losses: 0, pf: 0, pa: 0 };
      if (!partnerships[pKeyB]) partnerships[pKeyB] = { pair: pKeyB, played: 0, wins: 0, losses: 0, pf: 0, pa: 0 };

      partnerships[pKeyA].played++;
      partnerships[pKeyA].pf += sa;
      partnerships[pKeyA].pa += sb;
      if (sa > sb) partnerships[pKeyA].wins++;
      else partnerships[pKeyA].losses++;

      partnerships[pKeyB].played++;
      partnerships[pKeyB].pf += sb;
      partnerships[pKeyB].pa += sa;
      if (sb > sa) partnerships[pKeyB].wins++;
      else partnerships[pKeyB].losses++;

      // Track H2H Opponents
      tA.forEach(p1 => {
        tB.forEach(p2 => {
          h2h[p1][p2].played++;
          h2h[p1][p2].pf += sa;
          h2h[p1][p2].pa += sb;
          if (sa > sb) h2h[p1][p2].wins++;
          else h2h[p1][p2].losses++;

          h2h[p2][p1].played++;
          h2h[p2][p1].pf += sb;
          h2h[p2][p1].pa += sa;
          if (sb > sa) h2h[p2][p1].wins++;
          else h2h[p2][p1].losses++;
        });
      });
    }
  });

  // Print H2H breakdown per player
  console.log('--- 🤺 HEAD-TO-HEAD (H2H) OPPONENT BREAKDOWN ---');
  players.forEach(p1 => {
    console.log(`\n📌 ${p1}'s Record Against Opponents:`);
    Object.keys(h2h[p1]).forEach(p2 => {
      const rec = h2h[p1][p2];
      const diff = rec.pf - rec.pa;
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      console.log(`   vs ${p2.padEnd(16)} | Games: ${rec.played} | Record: ${rec.wins}W - ${rec.losses}L | Points: ${rec.pf}-${rec.pa} (${diffStr})`);
    });
  });

  // Print Top Partnerships
  console.log('\n--- 🤝 DUO PARTNERSHIP PERFORMANCE ---');
  const sortedPairs = Object.values(partnerships).sort((a, b) => (b.wins / b.played) - (a.wins / a.played) || b.wins - a.wins);
  sortedPairs.forEach(p => {
    const winRate = ((p.wins / p.played) * 100).toFixed(0);
    const diff = p.pf - p.pa;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    console.log(`   ${p.pair.padEnd(30)} | Record: ${p.wins}W - ${p.losses}L (${winRate}%) | Points: ${p.pf}-${p.pa} (${diffStr})`);
  });
}

computeDeepAnalytics().catch(console.error);
