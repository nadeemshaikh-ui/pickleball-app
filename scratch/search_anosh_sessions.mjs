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

async function run() {
  // 1. Fetch all rounds
  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('*');

  if (rErr) {
    console.error(rErr);
    return;
  }

  // Find all unique session IDs where "Anosh" played
  const anoshSessions = new Set();
  rounds.forEach(r => {
    const hasAnosh = (r.team_a && r.team_a.some(p => p.toLowerCase().includes('anosh'))) ||
                     (r.team_b && r.team_b.some(p => p.toLowerCase().includes('anosh')));
    if (hasAnosh) {
      anoshSessions.add(r.session_id);
    }
  });

  // 2. Fetch those sessions
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .in('id', Array.from(anoshSessions));

  if (sErr) {
    console.error(sErr);
    return;
  }

  console.log(`=== SESSIONS CONTAINING PLAYER 'ANOSH' ===\n`);

  for (const s of sessions) {
    let clubName = 'Guest Session';
    if (s.club_id) {
      const { data: club } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', s.club_id)
        .single();
      if (club) clubName = club.name;
    }

    const sessionRounds = rounds.filter(r => r.session_id === s.id && r.score_a !== null);
    
    // Simple leaderboard calculation for this session
    const wins = {};
    const matches = {};
    sessionRounds.forEach(r => {
      const allPlayers = [...r.team_a, ...r.team_b];
      allPlayers.forEach(p => {
        matches[p] = (matches[p] || 0) + 1;
      });
      const aWon = r.score_a > r.score_b;
      const winners = aWon ? r.team_a : r.team_b;
      winners.forEach(p => {
        wins[p] = (wins[p] || 0) + 1;
      });
    });

    // Sort by wins
    const leaderboard = Object.keys(wins).map(name => ({
      name,
      wins: wins[name],
      matches: matches[name],
      winPct: wins[name] / matches[name]
    })).sort((a, b) => b.wins - a.wins || b.winPct - a.winPct);

    const mvp = leaderboard[0];

    const formattedDate = s.event_date || new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    console.log(`--------------------------------------------------`);
    console.log(`Session ID: ${s.id}`);
    console.log(`Session Name: ${s.group_name || s.id}`);
    console.log(`Date: ${formattedDate}`);
    console.log(`Club: ${clubName}`);
    console.log(`Calculated MVP of Session: ${mvp ? `${mvp.name} (${mvp.wins} Wins)` : 'None'}`);
    console.log(`Anosh's Record in Session: ${wins['Anosh'] || 0} Wins out of ${matches['Anosh'] || 0} Matches`);
  }
}

run().catch(console.error);
