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

async function fullTournamentAudit() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';
  const { data: stages } = await supabase.from('tournament_stages').select('*').eq('club_id', clubId);
  const stage = stages[0];
  const schedule = stage.config.schedule;
  const rosters = stage.config.rosters;

  console.log('=== COMPLETE 360° TOURNAMENT AUDIT ===\n');

  const playerStats = {};
  const initPlayer = (p) => {
    if (!playerStats[p]) {
      playerStats[p] = {
        name: p,
        matches: 0,
        rests: [],
        h1Partners: [],
        h2Partners: [],
        h1Opponents: [],
        h2Opponents: []
      };
    }
  };

  ['hour1', 'hour2'].forEach(hKey => {
    Object.values(rosters[hKey]).forEach(pls => pls.forEach(initPlayer));
  });

  schedule.forEach((r, idx) => {
    const rnum = idx + 1;
    const isH1 = idx < 6;
    const hRoster = isH1 ? rosters.hour1 : rosters.hour2;

    ['court_1', 'court_2', 'court_3'].forEach(cKey => {
      const match = r[cKey];
      const t1 = match.team_1.split('&').map(s => s.trim());
      const t2 = match.team_2.split('&').map(s => s.trim());

      // Track active players
      t1.forEach(p => {
        playerStats[p].matches++;
        const partner = t1.find(x => x !== p);
        if (isH1) {
          playerStats[p].h1Partners.push(partner);
          playerStats[p].h1Opponents.push(...t2);
        } else {
          playerStats[p].h2Partners.push(partner);
          playerStats[p].h2Opponents.push(...t2);
        }
      });

      t2.forEach(p => {
        playerStats[p].matches++;
        const partner = t2.find(x => x !== p);
        if (isH1) {
          playerStats[p].h1Partners.push(partner);
          playerStats[p].h1Opponents.push(...t1);
        } else {
          playerStats[p].h2Partners.push(partner);
          playerStats[p].h2Opponents.push(...t1);
        }
      });

      // Track resting players
      const courtName = cKey === 'court_1' ? 'Court 1 (Group 1)' : (cKey === 'court_2' ? 'Court 2 (Group 2)' : 'Court 3 (Group 3)');
      const groupPls = hRoster[courtName];
      const activePls = new Set([...t1, ...t2]);
      groupPls.forEach(p => {
        if (!activePls.has(p)) {
          playerStats[p].rests.push(rnum);
        }
      });
    });
  });

  console.log('--- PLAYER BY PLAYER BREAKDOWN ---');
  let totalErrors = 0;

  Object.values(playerStats).forEach(p => {
    const h1UniqueP = new Set(p.h1Partners).size;
    const h2UniqueP = new Set(p.h2Partners).size;

    let hasConsecutiveRest = false;
    for (let i = 0; i < p.rests.length - 1; i++) {
      if (p.rests[i + 1] === p.rests[i] + 1) {
        hasConsecutiveRest = true;
      }
    }

    const matchErr = p.matches !== 8;
    const restErr = p.rests.length !== 4;
    const p1Err = h1UniqueP !== 4;
    const p2Err = h2UniqueP !== 4;

    if (matchErr || restErr || p1Err || p2Err || hasConsecutiveRest) {
      totalErrors++;
      console.log(`❌ ${p.name}:`);
      if (matchErr) console.log(`   - Matches: ${p.matches}/8`);
      if (restErr) console.log(`   - Rests: ${p.rests.length}/4 [Rounds: ${p.rests.join(', ')}]`);
      if (hasConsecutiveRest) console.log(`   - CONSECUTIVE RESTS: [Rounds: ${p.rests.join(', ')}]`);
      if (p1Err) console.log(`   - H1 Unique Partners: ${h1UniqueP}/4 (${p.h1Partners.join(', ')})`);
      if (p2Err) console.log(`   - H2 Unique Partners: ${h2UniqueP}/4 (${p.h2Partners.join(', ')})`);
    } else {
      console.log(`✅ ${p.name}: Matches=8/8, Rests=4/4, H1 Partners=4/4 (${p.h1Partners.join(', ')}), H2 Partners=4/4 (${p.h2Partners.join(', ')})`);
    }
  });

  console.log('\n====================================');
  console.log('TOTAL ISSUES FOUND ACROSS ALL 18 PLAYERS:', totalErrors);
  console.log('TOURNAMENT AUDIT STATUS:', totalErrors === 0 ? '100% PERFECT PASSED ✅' : 'ISSUES DETECTED ❌');
  console.log('====================================');
}

fullTournamentAudit().catch(console.error);
