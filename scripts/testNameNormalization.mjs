import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let serviceKey = '';

envLines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, serviceKey);

// Unified Canonical Name Map
const CANONICAL_MAP = {
  // Hemal
  'hemal': 'Hemal',
  'hemal shah': 'Hemal',
  'hetal': 'Hemal',

  // Karan
  'karan': 'Karan',
  'karan mastakar': 'Karan',

  // Tushar
  'tushar': 'Tushar',
  'tushar shah': 'Tushar',

  // Gopal
  'gopal': 'Gopal',
  'gopal parwal': 'Gopal',

  // Amit
  'amit': 'Amit',
  'amit doshi': 'Amit',

  // Rahul / 12
  '12': 'Rahul (12)',
  'rahul': 'Rahul (12)',
  'rahul maniar': 'Rahul (12)',

  // MBS / Miten
  'mbs': 'MBS (Miten)',
  'miten shah': 'MBS (Miten)',
  'miten': 'MBS (Miten)',

  // Hiten
  'hiten': 'Hiten',
  'hiten thakker': 'Hiten',

  // Vicky / Viki
  'vicky': 'Vicky',
  'viki': 'Vicky',
  'viki rajani': 'Vicky',

  // Sagar
  'sagar': 'Sagar',
  'sagar choksi': 'Sagar',

  // Saurabh
  'saurabh': 'Saurabh',
  'saurabh gandhi': 'Saurabh',

  // Deep
  'deep': 'Deep',
  'deep chhatlani': 'Deep',

  // Amresh Sahay
  'amresh': 'Amresh Sahay',
  'amresh sahay': 'Amresh Sahay',

  // Ambresh
  'ambresh': 'Ambresh',

  // Siddharth / Sid
  'sid': 'Siddharth',
  'siddharth': 'Siddharth',
  'siddharth gupta': 'Siddharth',

  // Sumit / Sumeet
  'sumit': 'Sumit',
  'sumeet': 'Sumit',
  'sumiit shettyy': 'Sumit',
  'sushe': 'Sumit',

  // Ankit
  'ankit': 'Ankit',

  // Aryan
  'aryan': 'Aryan',
  'aryan khanna': 'Aryan',

  // Vinit
  'vinit': 'Vinit',
  'vinit shanghvi': 'Vinit',

  // Nadeem
  'nadeem': 'Nadeem',
  'nadim shaikh': 'Nadeem',

  // Mrugesh
  'mrugesh': 'Mrugesh',

  // Chirag
  'chirag': 'Chirag',

  // Gaurav
  'gaurav': 'Gaurav',

  // Tejash / Tejas
  'tejash': 'Tejash',
  'tejas': 'Tejash',

  // Anish
  'anish': 'Anish',

  // DD
  'dd': 'DD',

  // Harsh
  'harsh': 'Harsh',

  // Ketan
  'ketan': 'Ketan',

  // Neel
  'neel': 'Neel',

  // Rahil
  'rahil': 'Rahil',

  // Smit
  'smit': 'Smit',

  // Kris
  'kris': 'Kris'
};

function normalize(name) {
  if (!name) return 'Unknown';
  const clean = name.trim().toLowerCase();
  return CANONICAL_MAP[clean] || name.trim();
}

async function testCombinedStats() {
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .in('session_id', ['mw_mavericks_season_2_2026', '1u03ob']);

  console.log(`=== TESTING UNIFIED CANONICAL NAME MAPPING ON ${rounds.length} ROUNDS ===\n`);

  const pStats = new Map();

  rounds.forEach(r => {
    const sa = r.score_a;
    const sb = r.score_b;
    if (sa === null || sb === null || (sa === 0 && sb === 0)) return;

    const tName = r.session_id === 'mw_mavericks_season_2_2026' ? 'Aug 12' : 'Jul 29';
    const aWon = sa > sb;
    const bWon = sb > sa;

    const teamA = (r.team_a || []).map(normalize).filter(p => !['MW MAVERICKS SQUAD', 'SVKM CHALLENGERS SQUAD'].includes(p));
    const teamB = (r.team_b || []).map(normalize).filter(p => !['MW MAVERICKS SQUAD', 'SVKM CHALLENGERS SQUAD'].includes(p));

    teamA.forEach(p => {
      if (!pStats.has(p)) pStats.set(p, { name: p, played: 0, wins: 0, losses: 0, jul29Played: 0, aug12Played: 0 });
      const st = pStats.get(p);
      st.played += 1;
      if (aWon) st.wins += 1; else st.losses += 1;
      if (tName === 'Jul 29') st.jul29Played += 1; else st.aug12Played += 1;
    });

    teamB.forEach(p => {
      if (!pStats.has(p)) pStats.set(p, { name: p, played: 0, wins: 0, losses: 0, jul29Played: 0, aug12Played: 0 });
      const st = pStats.get(p);
      st.played += 1;
      if (bWon) st.wins += 1; else st.losses += 1;
      if (tName === 'Jul 29') st.jul29Played += 1; else st.aug12Played += 1;
    });
  });

  const list = Array.from(pStats.values()).sort((a, b) => b.played - a.played);
  console.table(list.map(p => ({
    'Player Name': p.name,
    'Total Games': p.played,
    'Jul 29 Games': p.jul29Played,
    'Aug 12 Games': p.aug12Played,
    'Record (W-L)': `${p.wins}W - ${p.losses}L`,
    'Win %': `${Math.round((p.wins / p.played) * 100)}%`
  })));
}

testCombinedStats();
