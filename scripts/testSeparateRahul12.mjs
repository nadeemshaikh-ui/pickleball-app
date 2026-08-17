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

const SEPARATE_MAP = {
  '12': '12',
  'rahul': 'Rahul',
  'rahul maniar': 'Rahul',
  'hemal': 'Hemal',
  'hemal shah': 'Hemal',
  'karan': 'Karan',
  'karan mastakar': 'Karan',
  'tushar': 'Tushar',
  'tushar shah': 'Tushar',
  'gopal': 'Gopal',
  'gopal parwal': 'Gopal',
  'amit': 'Amit',
  'amit doshi': 'Amit',
  'mbs': 'MBS',
  'miten shah': 'MBS',
  'hiten': 'Hiten',
  'hiten thakker': 'Hiten',
  'vicky': 'Vicky',
  'viki': 'Vicky',
  'sagar': 'Sagar',
  'sagar choksi': 'Sagar',
  'saurabh': 'Saurabh',
  'saurabh gandhi': 'Saurabh',
  'deep': 'Deep',
  'deep chhatlani': 'Deep',
  'amresh sahay': 'Amresh Sahay',
  'amresh': 'Amresh Sahay',
  'ambresh': 'Ambresh',
  'sid': 'Siddharth',
  'siddharth': 'Siddharth',
  'sumit': 'Sumit',
  'sumeet': 'Sumit',
  'ankit': 'Ankit',
  'aryan': 'Aryan',
  'vinit': 'Vinit',
  'nadeem': 'Nadeem',
  'mrugesh': 'Mrugesh',
  'chirag': 'Chirag',
  'gaurav': 'Gaurav',
  'tejash': 'Tejash',
  'anish': 'Anish',
  'dd': 'DD',
  'harsh': 'Harsh',
  'ketan': 'Ketan',
  'neel': 'Neel',
  'rahil': 'Rahil',
  'smit': 'Smit',
  'kris': 'Kris'
};

function normalize(name) {
  if (!name) return 'Unknown';
  const clean = name.trim().toLowerCase();
  return SEPARATE_MAP[clean] || name.trim();
}

async function runTest() {
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .in('session_id', ['mw_mavericks_season_2_2026', '1u03ob']);

  const pStats = new Map();

  rounds.forEach(r => {
    const sa = r.score_a;
    const sb = r.score_b;
    if (sa === null || sb === null || (sa === 0 && sb === 0)) return;

    const aWon = sa > sb;
    const bWon = sb > sa;

    const teamA = (r.team_a || []).map(normalize).filter(p => !['MW MAVERICKS SQUAD', 'SVKM CHALLENGERS SQUAD'].includes(p));
    const teamB = (r.team_b || []).map(normalize).filter(p => !['MW MAVERICKS SQUAD', 'SVKM CHALLENGERS SQUAD'].includes(p));

    [...teamA, ...teamB].forEach(p => {
      if (!pStats.has(p)) pStats.set(p, { name: p, total: 0, wins: 0, losses: 0 });
    });

    teamA.forEach(p => {
      const st = pStats.get(p);
      st.total += 1;
      if (aWon) st.wins += 1; else st.losses += 1;
    });

    teamB.forEach(p => {
      const st = pStats.get(p);
      st.total += 1;
      if (bWon) st.wins += 1; else st.losses += 1;
    });
  });

  console.log('Rahul stat:', pStats.get('Rahul'));
  console.log('12 stat:', pStats.get('12'));
}

runTest();
