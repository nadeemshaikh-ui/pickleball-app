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

async function auditScrambleIntegrity() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';
  const { data: stages } = await supabase.from('tournament_stages').select('*').eq('club_id', clubId);
  const stage = stages[0];
  const schedule = stage.config.schedule;
  const rosters = stage.config.rosters;

  console.log('=== AUDITING PERFECT SCRAMBLE INTEGRITY ===\n');

  // 1. Check Partner Variety per pod
  let repeatPartnerships = 0;
  const checkPodPartnerships = (podRounds, courtKey) => {
    const partnerPairs = new Map();
    podRounds.forEach(r => {
      const match = r[courtKey];
      const t1 = match.team_1.split('&').map(s => s.trim()).sort();
      const t2 = match.team_2.split('&').map(s => s.trim()).sort();

      const pair1 = t1.join(' & ');
      const pair2 = t2.join(' & ');

      partnerPairs.set(pair1, (partnerPairs.get(pair1) || 0) + 1);
      partnerPairs.set(pair2, (partnerPairs.get(pair2) || 0) + 1);
    });

    for (const [pair, count] of partnerPairs.entries()) {
      if (count > 1) {
        console.log(`❌ Repeat partnership on ${courtKey}: ${pair} (${count} times)`);
        repeatPartnerships++;
      }
    }
  };

  const h1_rounds = schedule.slice(0, 6);
  const h2_rounds = schedule.slice(6, 12);

  ['court_1', 'court_2', 'court_3'].forEach(c => checkPodPartnerships(h1_rounds, c));
  ['court_1', 'court_2', 'court_3'].forEach(c => checkPodPartnerships(h2_rounds, c));

  console.log('LAW 1 — PARTNER VARIETY (Max 1 Partnership Per Pair):', repeatPartnerships === 0 ? 'PASSED ✅ (0 Repeats!)' : 'FAILED ❌');

  // 2. Check Zero Consecutive Rests
  let consecutiveRestViolations = 0;
  const allPlayers = new Set();
  ['hour1', 'hour2'].forEach(hKey => {
    Object.values(rosters[hKey]).forEach(pls => pls.forEach(p => allPlayers.add(p)));
  });

  allPlayers.forEach(p => {
    for (let r = 0; r < 11; r++) {
      const curR = schedule[r];
      const nxtR = schedule[r + 1];

      const getActive = (rObj) => [
        ...rObj.court_1.team_1.split('&'), ...rObj.court_1.team_2.split('&'),
        ...rObj.court_2.team_1.split('&'), ...rObj.court_2.team_2.split('&'),
        ...rObj.court_3.team_1.split('&'), ...rObj.court_3.team_2.split('&')
      ].map(s => s.trim());

      const activeCur = getActive(curR);
      const activeNxt = getActive(nxtR);

      if (!activeCur.includes(p) && !activeNxt.includes(p)) {
        console.log(`❌ Consecutive rest found for ${p} in R${r+1} and R${r+2}`);
        consecutiveRestViolations++;
      }
    }
  });

  console.log('LAW 2 — ZERO CONSECUTIVE RESTS:', consecutiveRestViolations === 0 ? 'PASSED ✅ (0 Violations!)' : 'FAILED ❌');

  // 3. Print Court 3 Hour 2 Fixtures to show Deep & Shaan partner variety!
  console.log('\n--- COURT 3 HOUR 2 (ROUNDS 7–12) FRESH FIXTURES ---');
  for (let r = 6; r < 12; r++) {
    const m = schedule[r].court_3;
    console.log(`R${r+1} (${schedule[r].time_slot}): ${m.team_1} vs ${m.team_2}`);
  }
}

auditScrambleIntegrity().catch(console.error);
