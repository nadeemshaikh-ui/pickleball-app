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

async function inspectMWTournaments() {
  const sessionIds = ['mw_mavericks_season_2_2026', 'pb_sunday_2026', '1u03ob'];

  const { data: sessions } = await supabase.from('sessions').select('*').in('id', sessionIds);
  const { data: rounds } = await supabase.from('rounds').select('*').in('session_id', sessionIds);

  console.log('=== MONDAY-WEDNESDAY CLUB TOURNAMENTS BREAKDOWN ===\n');

  sessionIds.forEach((sid, idx) => {
    const s = sessions.find(sess => sess.id === sid);
    const sRounds = rounds.filter(r => r.session_id === sid);

    const playersInTournament = new Set();
    sRounds.forEach(r => {
      (r.team_a || []).forEach(p => playersInTournament.add(p));
      (r.team_b || []).forEach(p => playersInTournament.add(p));
    });

    // Also check session.players if available
    if (s?.players) {
      s.players.forEach(p => {
        if (typeof p === 'string') playersInTournament.add(p);
        else if (p?.name) playersInTournament.add(p.name);
      });
    }

    const tName = sid === 'mw_mavericks_season_2_2026'
      ? 'MW Mavericks Season II (Aug 10, 2026)'
      : sid === 'pb_sunday_2026'
      ? 'MW Mavericks Season I / Sunday Tournament (Aug 9, 2026)'
      : 'Home Team vs Challengers (Jul 27, 2026)';

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`TOURNAMENT #${idx + 1}: ${tName}`);
    console.log(`Session ID: ${sid}`);
    console.log(`Total Scored Rounds/Matches: ${sRounds.length}`);
    console.log(`Total Unique Players: ${playersInTournament.size}`);
    console.log(`Players Roster:`);
    console.log(Array.from(playersInTournament).filter(p => !['Airavat', 'Pickleboss', 'Pickleboys', 'Leos SIX'].includes(p)).sort().join(', '));
    console.log(`--------------------------------------------------------------------------------\n`);
  });
}

inspectMWTournaments();
