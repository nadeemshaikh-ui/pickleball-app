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

async function printFreshSchedule() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';
  const { data: stages } = await supabase.from('tournament_stages').select('*').eq('club_id', clubId);
  const stage = stages[0];
  const schedule = stage.config.schedule;
  const rosters = stage.config.rosters;

  schedule.forEach((r, idx) => {
    const isH1 = idx < 6;
    const rnum = idx + 1;
    const hRoster = isH1 ? rosters.hour1 : rosters.hour2;

    const getActive = (mStr) => mStr.split('&').map(s => s.trim());
    const c1_act = new Set([...getActive(r.court_1.team_1), ...getActive(r.court_1.team_2)]);
    const c2_act = new Set([...getActive(r.court_2.team_1), ...getActive(r.court_2.team_2)]);
    const c3_act = new Set([...getActive(r.court_3.team_1), ...getActive(r.court_3.team_2)]);

    const c1_rest = hRoster['Court 1 (Group 1)'].filter(p => !c1_act.has(p));
    const c2_rest = hRoster['Court 2 (Group 2)'].filter(p => !c2_act.has(p));
    const c3_rest = hRoster['Court 3 (Group 3)'].filter(p => !c3_act.has(p));

    console.log(`ROUND ${rnum} (${r.time_slot}):`);
    console.log(`  Court 1: ${r.court_1.team_1} vs ${r.court_1.team_2}  (Resting: ${c1_rest.join(', ')})`);
    console.log(`  Court 2: ${r.court_2.team_1} vs ${r.court_2.team_2}  (Resting: ${c2_rest.join(', ')})`);
    console.log(`  Court 3: ${r.court_3.team_1} vs ${r.court_3.team_2}  (Resting: ${c3_rest.join(', ')})\n`);
  });
}

printFreshSchedule().catch(console.error);
