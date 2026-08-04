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

async function main() {
  const { data: clubs, error } = await supabase.from('clubs').select('*');
  if (error) {
    console.error("DB Error:", error);
    return;
  }
  console.log("Clubs in DB:", clubs);
  let hotshots = clubs.find(c => c.name && c.name.toLowerCase().includes('hotshots'));
  if (!hotshots) {
    console.log("Creating Hotshots Pickleball Club...");
    const { data: inserted, error: insertErr } = await supabase.from('clubs').insert([
      { name: 'Hotshots Pickleball Club', slug: 'hotshots' }
    ]).select();
    console.log("Inserted:", inserted, "Error:", insertErr);
  } else {
    console.log("Hotshots Club exists:", hotshots);
  }
}

main();
