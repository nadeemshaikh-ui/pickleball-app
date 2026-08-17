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

const matches = [];
for (let i = 0; i < 6; i++) {
  for (let j = i + 1; j < 6; j++) {
    for (let k = 0; k < 6; k++) {
      if (k === i || k === j) continue;
      for (let l = k + 1; l < 6; l++) {
        if (l === i || l === j) continue;
        if (i < k) {
          matches.push({
            team1: [i, j],
            team2: [k, l],
            active: [i, j, k, l],
            rest: [0,1,2,3,4,5].filter(x => x!==i && x!==j && x!==k && x!==l)
          });
        }
      }
    }
  }
}

function solvePod(playerList, mustPartnerList = null, forbidRestR1 = []) {
  const selected = [];
  const partnerCounts = Array(6).fill(0).map(() => Array(6).fill(0));
  const matchCounts = Array(6).fill(0);

  function search(r) {
    if (r === 6) {
      if (matchCounts.every(c => c === 4)) return true;
      return false;
    }

    for (const m of matches) {
      const [r1, r2] = m.rest;

      // 1. Boundary check for Hour 2 first round (R7)
      if (r === 0 && forbidRestR1.length > 0) {
        const restNames = [playerList[r1], playerList[r2]];
        if (forbidRestR1.some(p => restNames.includes(p))) continue;
      }

      // 2. Zero consecutive rests
      if (r > 0) {
        const prevRest = selected[r - 1].rest;
        if (prevRest.includes(r1) || prevRest.includes(r2)) continue;
      }

      // 3. STRICT UNIQUE PARTNERSHIP RULE (Max 1 partnership per pair)
      const [t1a, t1b] = m.team1;
      const [t2a, t2b] = m.team2;
      if (partnerCounts[t1a][t1b] >= 1) continue;
      if (partnerCounts[t2a][t2b] >= 1) continue;

      // 4. Max 4 matches per player
      let ok = true;
      for (const p of m.active) {
        if (matchCounts[p] >= 4) { ok = false; break; }
      }
      if (!ok) continue;

      // Apply move
      partnerCounts[t1a][t1b]++; partnerCounts[t1b][t1a]++;
      partnerCounts[t2a][t2b]++; partnerCounts[t2b][t2a]++;
      m.active.forEach(p => matchCounts[p]++);
      selected.push(m);

      if (search(r + 1)) return true;

      // Undo move
      selected.pop();
      m.active.forEach(p => matchCounts[p]--);
      partnerCounts[t1a][t1b]--; partnerCounts[t1b][t1a]--;
      partnerCounts[t2a][t2b]--; partnerCounts[t2b][t2a]--;
    }

    return false;
  }

  if (search(0)) {
    return selected.map(m => ({
      team_1: playerList[m.team1[0]] + ' & ' + playerList[m.team1[1]],
      team_2: playerList[m.team2[0]] + ' & ' + playerList[m.team2[1]],
      rest: [playerList[m.rest[0]], playerList[m.rest[1]]]
    }));
  }
  return null;
}

async function buildPerfectTournamentSchedule() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';

  const h1_c1_pls = ['Deep', 'Shaan', 'Priyesh', 'Hemal', 'Ankit', 'Yule'];
  const h1_c2_pls = ['Nadeem', 'Sid', 'Gopal', 'Gulshan', 'Anosh', 'Miten'];
  const h1_c3_pls = ['Viki', 'Sumit', 'Amresh', 'PK', 'Shrinath', 'Karan'];

  const h2_c1_pls = ['Nadeem', 'Anosh', 'Sumit', 'Amresh', 'Karan', 'Gopal'];
  const h2_c2_pls = ['Viki', 'Sid', 'Miten', 'Gulshan', 'Yule', 'Priyesh'];
  const h2_c3_pls = ['Deep', 'Shaan', 'Ankit', 'PK', 'Shrinath', 'Hemal'];

  const sched_h1_c1 = solvePod(h1_c1_pls);
  const sched_h1_c2 = solvePod(h1_c2_pls);
  const sched_h1_c3 = solvePod(h1_c3_pls);

  const r6_resting_players = [
    ...sched_h1_c1[5].rest,
    ...sched_h1_c2[5].rest,
    ...sched_h1_c3[5].rest
  ];

  const forbidH2C1 = r6_resting_players.filter(p => h2_c1_pls.includes(p));
  const forbidH2C2 = r6_resting_players.filter(p => h2_c2_pls.includes(p));
  const forbidH2C3 = r6_resting_players.filter(p => h2_c3_pls.includes(p));

  const sched_h2_c1 = solvePod(h2_c1_pls, null, forbidH2C1);
  const sched_h2_c2 = solvePod(h2_c2_pls, null, forbidH2C2);
  const sched_h2_c3 = solvePod(h2_c3_pls, null, forbidH2C3);

  console.log('All 6 Pods Solved with STRICT UNIQUE PARTNERSHIPS & ZERO CONSECUTIVE RESTS:');
  console.log('  H1 Court 1:', !!sched_h1_c1 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  H1 Court 2:', !!sched_h1_c2 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  H1 Court 3:', !!sched_h1_c3 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  H2 Court 1:', !!sched_h2_c1 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  H2 Court 2:', !!sched_h2_c2 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  H2 Court 3:', !!sched_h2_c3 ? 'PASSED ✅' : 'FAILED ❌');

  const timeslotsH1 = ['08:00 PM', '08:10 PM', '08:20 PM', '08:30 PM', '08:40 PM', '08:50 PM'];
  const timeslotsH2 = ['09:00 PM', '09:10 PM', '09:20 PM', '09:30 PM', '09:40 PM', '09:50 PM'];

  const fullSchedule = [];

  for (let i = 0; i < 6; i++) {
    fullSchedule.push({
      round_number: i + 1,
      time_slot: timeslotsH1[i],
      court_1: { team_1: sched_h1_c1[i].team_1, team_2: sched_h1_c1[i].team_2 },
      court_2: { team_1: sched_h1_c2[i].team_1, team_2: sched_h1_c2[i].team_2 },
      court_3: { team_1: sched_h1_c3[i].team_1, team_2: sched_h1_c3[i].team_2 }
    });
  }

  for (let i = 0; i < 6; i++) {
    fullSchedule.push({
      round_number: i + 7,
      time_slot: timeslotsH2[i],
      court_1: { team_1: sched_h2_c1[i].team_1, team_2: sched_h2_c1[i].team_2 },
      court_2: { team_1: sched_h2_c2[i].team_1, team_2: sched_h2_c2[i].team_2 },
      court_3: { team_1: sched_h2_c3[i].team_1, team_2: sched_h2_c3[i].team_2 }
    });
  }

  const rosters = {
    hour1: {
      'Court 1 (Group 1)': h1_c1_pls,
      'Court 2 (Group 2)': h1_c2_pls,
      'Court 3 (Group 3)': h1_c3_pls
    },
    hour2: {
      'Court 1 (Group 1)': h2_c1_pls,
      'Court 2 (Group 2)': h2_c2_pls,
      'Court 3 (Group 3)': h2_c3_pls
    }
  };

  // 1. Update tournament_stages in Supabase
  const { error: sErr } = await supabase
    .from('tournament_stages')
    .update({ config: { schedule: fullSchedule, rosters } })
    .eq('club_id', clubId);
  if (sErr) console.error('Error updating stage config:', sErr);
  else console.log('\n🎉 Successfully updated tournament_stages config with 100% Unique Partner Schedule!');

  // 2. Clear & repopulate rounds table for session hot101
  await supabase.from('rounds').delete().eq('session_id', 'hot101');

  const rows = [];
  fullSchedule.forEach((r, idx) => {
    const isH1 = idx < 6;
    const rnum = idx + 1;
    const hRoster = isH1 ? rosters.hour1 : rosters.hour2;

    const getActive = (mStr) => mStr.split('&').map(s => s.trim());

    // Court 1
    const c1_act = new Set([...getActive(r.court_1.team_1), ...getActive(r.court_1.team_2)]);
    const c1_rest = hRoster['Court 1 (Group 1)'].filter(p => !c1_act.has(p));
    rows.push({
      session_id: 'hot101',
      round_number: rnum,
      court: 1,
      team_a: r.court_1.team_1.split('&').map(s => s.trim()),
      team_b: r.court_1.team_2.split('&').map(s => s.trim()),
      sitting_out: c1_rest,
      score_a: null,
      score_b: null
    });

    // Court 2
    const c2_act = new Set([...getActive(r.court_2.team_1), ...getActive(r.court_2.team_2)]);
    const c2_rest = hRoster['Court 2 (Group 2)'].filter(p => !c2_act.has(p));
    rows.push({
      session_id: 'hot101',
      round_number: rnum,
      court: 2,
      team_a: r.court_2.team_1.split('&').map(s => s.trim()),
      team_b: r.court_2.team_2.split('&').map(s => s.trim()),
      sitting_out: c2_rest,
      score_a: null,
      score_b: null
    });

    // Court 3
    const c3_act = new Set([...getActive(r.court_3.team_1), ...getActive(r.court_3.team_2)]);
    const c3_rest = hRoster['Court 3 (Group 3)'].filter(p => !c3_act.has(p));
    rows.push({
      session_id: 'hot101',
      round_number: rnum,
      court: 3,
      team_a: r.court_3.team_1.split('&').map(s => s.trim()),
      team_b: r.court_3.team_2.split('&').map(s => s.trim()),
      sitting_out: c3_rest,
      score_a: null,
      score_b: null
    });
  });

  const { error: rErr } = await supabase.from('rounds').insert(rows);
  if (rErr) console.error('Error inserting rounds:', rErr);
  else console.log(`🎉 Successfully inserted all ${rows.length} rounds into rounds table for hot101!`);
}

buildPerfectTournamentSchedule().catch(console.error);
