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

async function findSession() {
  console.log('=== SEARCHING FOR PICKLEBOYS CLUB & SESSIONS ===\n');

  // 1. Search clubs table
  const { data: clubs, error: cErr } = await supabase.from('clubs').select('*');
  console.log('Clubs found:', clubs ? clubs.map(c => ({ id: c.id, name: c.name, slug: c.slug })) : cErr);

  // 2. Search recent sessions
  const { data: sessions, error: sErr } = await supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(10);
  console.log('\nRecent Sessions found in DB:');
  if (sessions) {
    sessions.forEach(s => {
      console.log(`- ID: ${s.id} | Name: ${s.group_name || s.name} | ClubID: ${s.club_id} | Status: ${s.status} | CreatedAt: ${s.created_at} | EventDate: ${s.event_date}`);
    });
  } else {
    console.error('Error fetching sessions:', sErr);
  }

  // 3. Search rounds table for completed/active matches for recent sessions
  const { data: rounds } = await supabase.from('rounds').select('session_id, count').limit(10);
  console.log('\nRounds summary:', rounds);
}

findSession().catch(console.error);
