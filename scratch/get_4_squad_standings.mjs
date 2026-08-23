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

const sessionId = 'hotshot_session_thursday';

async function run() {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  const { data: dbRounds } = await supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_number', { ascending: true });

  const finished = dbRounds.filter(r => r.score_a !== null && r.score_b !== null);

  const teamStats = {};
  session.squads.forEach(s => {
    teamStats[s.id] = {
      name: s.label || s.name,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      matches: 0
    };
  });

  const getPlayerTeamId = (player) => {
    const squad = session.squads.find(s => s.players.includes(player));
    return squad ? squad.id : null;
  };

  finished.forEach(r => {
    const teamAId = getPlayerTeamId(r.team_a[0]);
    const teamBId = getPlayerTeamId(r.team_b[0]);

    if (!teamAId || !teamBId) return;

    teamStats[teamAId].matches++;
    teamStats[teamBId].matches++;
    teamStats[teamAId].pointsFor += r.score_a;
    teamStats[teamAId].pointsAgainst += r.score_b;
    teamStats[teamBId].pointsFor += r.score_b;
    teamStats[teamBId].pointsAgainst += r.score_a;

    if (r.score_a > r.score_b) {
      teamStats[teamAId].wins++;
      teamStats[teamBId].losses++;
    } else {
      teamStats[teamBId].wins++;
      teamStats[teamAId].losses++;
    }
  });

  const sorted = Object.values(teamStats).sort((a, b) => b.wins - a.wins || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst));

  console.log('\n=================== 4-TEAM STANDINGS ===================');
  sorted.forEach((t, idx) => {
    const diff = t.pointsFor - t.pointsAgainst;
    console.log(`${idx + 1}. ${t.name.padEnd(25)} | Wins: ${t.wins} | Losses: ${t.losses} | Diff: ${diff > 0 ? '+' + diff : diff} (${t.pointsFor}-${t.pointsAgainst})`);
  });
  console.log('========================================================\n');
}

run().catch(console.error);
