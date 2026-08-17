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

const url = env.NEXT_PUBLIC_SUPABASE_URL || 'https://ltbnjtgzpwxulbczmzdr.supabase.co';
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

function generatePodSchedule(playerList, mustPartnerFirst = null, forbidRestInFirstRound = []) {
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

  const selected = [];

  function search(r, playedCount, partnersMap) {
    if (r === 6) {
      if (playedCount.every(c => c === 4)) return true;
      return false;
    }

    for (const m of matches) {
      const [r1, r2] = m.rest;
      
      if (r === 0 && forbidRestInFirstRound.length > 0) {
        const restNames = [playerList[r1], playerList[r2]];
        if (forbidRestInFirstRound.some(p => restNames.includes(p))) continue;
      }

      if (r > 0) {
        const prevRest = selected[r - 1].rest;
        if (prevRest.includes(r1) || prevRest.includes(r2)) continue;
      }

      if (mustPartnerFirst !== null && m.active.includes(0)) {
        const p1 = m.team1.includes(0) ? m.team1.find(x => x !== 0) : m.team2.find(x => x !== 0);
        if (partnersMap.has(p1)) continue;
      }

      let ok = true;
      for (const p of m.active) {
        if (playedCount[p] >= 4) { ok = false; break; }
      }
      if (!ok) continue;

      const nextPlayed = [...playedCount];
      m.active.forEach(p => nextPlayed[p]++);

      const nextPartners = new Set(partnersMap);
      if (mustPartnerFirst !== null && m.active.includes(0)) {
        const p1 = m.team1.includes(0) ? m.team1.find(x => x !== 0) : m.team2.find(x => x !== 0);
        nextPartners.add(p1);
      }

      selected.push(m);
      if (search(r + 1, nextPlayed, nextPartners)) return true;
      selected.pop();
    }

    return false;
  }

  if (search(0, [0,0,0,0,0,0], new Set())) {
    return selected.map(m => ({
      team_1: playerList[m.team1[0]] + ' & ' + playerList[m.team1[1]],
      team_2: playerList[m.team2[0]] + ' & ' + playerList[m.team2[1]],
      rest: m.rest.map(i => playerList[i])
    }));
  }
  return null;
}

async function updateZeroConsecutiveRestSchedule() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';

  const h1_c1_pls = ['Deep', 'Shaan', 'Priyesh', 'Hemal', 'Ankit', 'Yule'];
  const h1_c2_pls = ['Nadeem', 'Sid', 'Gopal', 'Gulshan', 'Anosh', 'Miten'];
  const h1_c3_pls = ['Viki', 'Sumit', 'Amresh', 'PK', 'Shrinath', 'Karan'];

  const h2_c1_pls = ['Nadeem', 'Anosh', 'Sumit', 'Amresh', 'Karan', 'Gopal'];
  const h2_c2_pls = ['Viki', 'Sid', 'Miten', 'Gulshan', 'Yule', 'Priyesh'];
  const h2_c3_pls = ['Deep', 'Shaan', 'Ankit', 'PK', 'Shrinath', 'Hemal'];

  const sched_h1_c1 = generatePodSchedule(h1_c1_pls);
  const sched_h1_c2 = generatePodSchedule(h1_c2_pls, 'Nadeem');
  const sched_h1_c3 = generatePodSchedule(h1_c3_pls);

  const r6_resting_players = [
    ...sched_h1_c1[5].rest,
    ...sched_h1_c2[5].rest,
    ...sched_h1_c3[5].rest
  ];

  const forbidH2C1 = r6_resting_players.filter(p => h2_c1_pls.includes(p));
  const forbidH2C2 = r6_resting_players.filter(p => h2_c2_pls.includes(p));
  const forbidH2C3 = r6_resting_players.filter(p => h2_c3_pls.includes(p));

  const sched_h2_c1 = generatePodSchedule(h2_c1_pls, null, forbidH2C1);
  const sched_h2_c2 = generatePodSchedule(h2_c2_pls, null, forbidH2C2);
  const sched_h2_c3 = generatePodSchedule(h2_c3_pls, null, forbidH2C3);

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

  // 1. Update tournament_stages table
  const { data: stageData, error: sErr } = await supabase
    .from('tournament_stages')
    .update({ config: { schedule: fullSchedule, rosters } })
    .eq('club_id', clubId);
  if (sErr) console.error('Error updating stage config:', sErr);
  else console.log('Successfully updated tournament_stages config!');

  // 2. Clear & rebuild rounds table for active session hot101
  await supabase.from('rounds').delete().eq('session_id', 'hot101');

  const roundRows = fullSchedule.map(r => ({
    session_id: 'hot101',
    round_number: r.round_number,
    court_number: 1,
    team_a_name: r.court_1.team_1,
    team_b_name: r.court_1.team_2,
    score_a: null,
    score_b: null,
    status: 'scheduled'
  }));

  const roundRowsC2 = fullSchedule.map(r => ({
    session_id: 'hot101',
    round_number: r.round_number,
    court_number: 2,
    team_a_name: r.court_2.team_1,
    team_b_name: r.court_2.team_2,
    score_a: null,
    score_b: null,
    status: 'scheduled'
  }));

  const roundRowsC3 = fullSchedule.map(r => ({
    session_id: 'hot101',
    round_number: r.round_number,
    court_number: 3,
    team_a_name: r.court_3.team_1,
    team_b_name: r.court_3.team_2,
    score_a: null,
    score_b: null,
    status: 'scheduled'
  }));

  const { error: rErr } = await supabase
    .from('rounds')
    .insert([...roundRows, ...roundRowsC2, ...roundRowsC3]);
  if (rErr) console.error('Error inserting rounds:', rErr);
  else console.log('Successfully inserted 36 rounds into Supabase for hot101!');
}

updateZeroConsecutiveRestSchedule().catch(console.error);
