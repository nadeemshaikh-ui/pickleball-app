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
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const { data: rounds } = await supabase.from('rounds').select('*');

  console.log("=== DIAGNOSTIC REPORT: ALL ACTIVE SESSIONS WITH ANOSH ===\n");

  for (const s of sessions) {
    const hasAnoshInList = s.players && s.players.some(p => p.toLowerCase().includes('anosh'));
    if (!hasAnoshInList) continue;

    const sRounds = rounds.filter(r => r.session_id === s.id && r.score_a !== null);
    
    let clubName = 'Guest Play';
    if (s.club_id) {
      const { data: club } = await supabase.from('clubs').select('name').eq('id', s.club_id).single();
      if (club) clubName = club.name;
    }

    console.log(`Session: ${s.group_name || s.id} (${s.id})`);
    console.log(`Club: ${clubName}`);
    console.log(`Date: ${s.event_date || s.created_at}`);
    console.log(`Rounds Scored: ${sRounds.length}`);

    if (sRounds.length > 0) {
      const wins = {};
      const matches = {};
      sRounds.forEach(r => {
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

      const sorted = Object.keys(wins).map(name => ({
        name,
        wins: wins[name],
        matches: matches[name],
        winPct: wins[name] / matches[name]
      })).sort((a, b) => b.wins - a.wins || b.winPct - a.winPct);

      console.log("Leaderboard standings:");
      sorted.forEach((x, rank) => {
        console.log(`  ${rank + 1}. ${x.name}: ${x.wins}W - ${x.matches - x.wins}L (${x.matches} matches)`);
      });
    } else {
      console.log("  No matches scored in this session yet.");
    }
    console.log(`--------------------------------------------------\n`);
  }
}

run().catch(console.error);
