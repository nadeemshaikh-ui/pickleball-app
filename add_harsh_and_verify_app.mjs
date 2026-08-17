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

async function addHarshAndVerify() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';

  // 1. Check or Insert Harsh in players table
  const { data: existingPlayer } = await supabase.from('players').select('*').eq('name', 'Harsh');
  if (!existingPlayer || existingPlayer.length === 0) {
    const { data: pIns, error: pErr } = await supabase.from('players').insert({
      club_id: clubId,
      name: 'Harsh',
      phone: '+91 81088 02179',
      role: 'scorer'
    }).select();
    if (pErr) console.log('Player insert (players):', pErr.message);
    else console.log('✅ Added Harsh to players table:', pIns);
  } else {
    console.log('✅ Harsh already in players table:', existingPlayer[0]);
  }

  // 2. Check or Insert Harsh in club_members table if table exists
  try {
    const { data: existingMember } = await supabase.from('club_members').select('*').eq('phone', '+91 81088 02179');
    if (!existingMember || existingMember.length === 0) {
      const { data: mIns, error: mErr } = await supabase.from('club_members').insert({
        club_id: clubId,
        name: 'Harsh',
        phone: '+91 81088 02179',
        role: 'scorer'
      }).select();
      if (mErr) console.log('Club member insert:', mErr.message);
      else console.log('✅ Added Harsh to club_members table:', mIns);
    } else {
      console.log('✅ Harsh already in club_members table:', existingMember[0]);
    }
  } catch (err) {
    console.log('club_members check note:', err.message);
  }

  // 3. Verify session hot101 details
  const { data: session } = await supabase.from('sessions').select('*').eq('id', 'hot101');
  console.log('\n--- ACTIVE SESSION DETAILS ---');
  if (session && session.length > 0) {
    console.log('Session ID:', session[0].id);
    console.log('Session Name:', session[0].name);
    console.log('Share Token:', session[0].share_token);
    console.log('Status:', session[0].status);
    console.log('Round Count:', session[0].round_count);
  }

  // 4. Verify 36 rounds in DB
  const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', 'hot101');
  console.log(`Total active match cards in DB for hot101: ${rounds ? rounds.length : 0} / 36`);

  // 5. Verify Scorers / Admin roles for Nadeem, Sumit, Viki, Hemal, Harsh
  const scorers = ['Nadeem', 'Sumit', 'Viki', 'Hemal', 'Harsh'];
  console.log('\n--- VERIFYING SCORER ROLES FOR TOURNAMENT ORGANIZERS ---');
  for (const sName of scorers) {
    const { data: p } = await supabase.from('players').select('*').eq('name', sName);
    console.log(`Scorer/Admin [${sName}]:`, p && p.length > 0 ? `Active (${p[0].phone || 'No phone set'})` : 'Not in players table');
  }
}

addHarshAndVerify().catch(console.error);
