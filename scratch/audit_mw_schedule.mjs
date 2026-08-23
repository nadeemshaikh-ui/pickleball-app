import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('C:\\Users\\Nadeem\\Documents\\pickleball-app\\.env.local', 'utf8');
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

const sessionId = 'mw_mavericks_vs_hotshots_2026';

async function run() {
  const { data: rounds, error } = await supabase.from('rounds')
    .select('*')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true });

  if (error) {
    console.error("Error fetching rounds:", error);
    return;
  }

  // Filter out any empty placeholder rows (like Finals rounds which have blank team arrays)
  const activeRounds = rounds.filter(r => r.team_a[0] !== '' && r.team_b[0] !== '');

  const matchCounts = {};
  const partnersMap = {};

  // Initialize
  const initializePlayer = (p) => {
    if (!matchCounts[p]) matchCounts[p] = 0;
    if (!partnersMap[p]) partnersMap[p] = {};
  };

  activeRounds.forEach(r => {
    // Team A
    const [a1, a2] = r.team_a;
    if (a1 && a2) {
      initializePlayer(a1);
      initializePlayer(a2);
      matchCounts[a1]++;
      matchCounts[a2]++;
      partnersMap[a1][a2] = (partnersMap[a1][a2] || 0) + 1;
      partnersMap[a2][a1] = (partnersMap[a2][a1] || 0) + 1;
    }

    // Team B
    const [b1, b2] = r.team_b;
    if (b1 && b2) {
      initializePlayer(b1);
      initializePlayer(b2);
      matchCounts[b1]++;
      matchCounts[b2]++;
      partnersMap[b1][b2] = (partnersMap[b1][b2] || 0) + 1;
      partnersMap[b2][b1] = (partnersMap[b2][b1] || 0) + 1;
    }
  });

  console.log("\n=================== PLAYER MATCH & PARTNER AUDIT ===================");
  
  // Sort players alphabetically
  const sortedPlayers = Object.keys(matchCounts).sort();
  sortedPlayers.forEach(p => {
    const totalMatches = matchCounts[p];
    const partnersList = Object.entries(partnersMap[p])
      .map(([part, count]) => `${part} (${count}x)`)
      .join(', ');
    
    console.log(`\n👤 Player: ${p.padEnd(16)} | Total Matches: ${totalMatches}`);
    console.log(`   🤝 Partners: ${partnersList}`);
  });
}

run().catch(console.error);
