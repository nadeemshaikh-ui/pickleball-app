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

async function verifyLiveNoConsecutiveRests() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';
  const { data: stages } = await supabase.from('tournament_stages').select('*').eq('club_id', clubId);
  const stage = stages[0];
  const schedule = stage.config.schedule;
  const rosters = stage.config.rosters;

  console.log('=== AUDITING CONSECUTIVE RESTS IN LIVE SUPABASE DATABASE ===\n');

  let consecutiveFailures = 0;
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
        console.log('❌ Consecutive rest found for:', p, 'in R' + (r+1) + ' and R' + (r+2));
        consecutiveFailures++;
      }
    }
  });

  if (consecutiveFailures === 0) {
    console.log('🎉 100% PERFECT! ZERO CONSECUTIVE RESTS FOR ALL 18 PLAYERS IN ALL 12 ROUNDS!');
  } else {
    console.log('Total consecutive rest violations:', consecutiveFailures);
  }
}

verifyLiveNoConsecutiveRests().catch(console.error);
