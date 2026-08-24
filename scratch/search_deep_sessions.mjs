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
  // Query all rounds in the DB
  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('*');

  if (rErr) {
    console.error(rErr);
    return;
  }

  // Filter rounds where 'Deep' was playing
  const deepSessionIds = new Set();
  rounds.forEach(r => {
    const hasDeep = (r.team_a && r.team_a.some(p => p.toLowerCase().includes('deep'))) ||
                    (r.team_b && r.team_b.some(p => p.toLowerCase().includes('deep')));
    if (hasDeep) {
      deepSessionIds.add(r.session_id);
    }
  });

  console.log(`Sessions containing player 'Deep':\n`);

  for (const sId of deepSessionIds) {
    const { data: s } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sId)
      .single();

    if (!s) continue;

    // Fetch club info
    let clubName = 'Unknown Club';
    if (s.club_id) {
      const { data: club } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', s.club_id)
        .single();
      if (club) clubName = club.name;
    }

    // Filter rounds for this session with Deep
    const sessionRounds = rounds.filter(r => r.session_id === sId);
    const deepRounds = sessionRounds.filter(r => 
      (r.team_a && r.team_a.some(p => p.toLowerCase().includes('deep'))) ||
      (r.team_b && r.team_b.some(p => p.toLowerCase().includes('deep')))
    );

    const formattedDate = s.event_date || new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    console.log(`--------------------------------------------------`);
    console.log(`Session ID: ${s.id}`);
    console.log(`Session Name: ${s.group_name || s.id}`);
    console.log(`Date: ${formattedDate}`);
    console.log(`Time (Created At): ${s.created_at}`);
    console.log(`Club: ${clubName} (${s.club_id})`);
    console.log(`Format: ${s.format}`);
    console.log(`Total Rounds Scored in Session: ${sessionRounds.filter(r => r.score_a !== null).length}`);
    console.log(`Rounds Played by Deep in Session: ${deepRounds.length}`);
  }
}

run().catch(console.error);
