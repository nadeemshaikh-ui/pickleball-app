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
  // 1. Fetch all rounds matching Deep
  const { data: rounds, error: rErr } = await supabase
    .from('rounds')
    .select('*');

  if (rErr) {
    console.error(rErr);
    return;
  }

  const deepSessionIds = new Set();
  rounds.forEach(r => {
    const hasDeep = (r.team_a && r.team_a.some(p => p.toLowerCase().includes('deep'))) ||
                    (r.team_b && r.team_b.some(p => p.toLowerCase().includes('deep')));
    if (hasDeep) {
      deepSessionIds.add(r.session_id);
    }
  });

  // 2. Fetch all sessions where Deep participated
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .in('id', Array.from(deepSessionIds));

  if (sErr) {
    console.error(sErr);
    return;
  }

  console.log(`=== FULL SEARCH FOR PLAYER 'DEEP' IN GUEST SESSIONS & HOTSHOTS ===\n`);

  for (const s of sessions) {
    // Determine if it is a Guest Session (no club_id) or a specific club session
    const isGuest = !s.club_id;
    let clubName = 'GUEST SESSION (No Club)';
    
    if (s.club_id) {
      const { data: club } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', s.club_id)
        .single();
      if (club) {
        clubName = `Club: ${club.name}`;
      }
    }

    const sessionRounds = rounds.filter(r => r.session_id === s.id);
    const deepRounds = sessionRounds.filter(r => 
      (r.team_a && r.team_a.some(p => p.toLowerCase().includes('deep'))) ||
      (r.team_b && r.team_b.some(p => p.toLowerCase().includes('deep')))
    );

    const formattedDate = s.event_date || new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    console.log(`--------------------------------------------------`);
    console.log(`Session Name: ${s.group_name || s.id}`);
    console.log(`Date: ${formattedDate}`);
    console.log(`Location/Venue: ${s.venue || 'Not Specified'}`);
    console.log(`Category: ${clubName}`);
    console.log(`Format: ${s.format}`);
    console.log(`Rounds Played by Deep: ${deepRounds.length}`);
  }
}

run().catch(console.error);
