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
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';
  const userId = 'e2696790-a409-43cc-ad8d-931688fd2ac8';
  
  console.log("Adding user to club_members table as admin...");
  const { data, error } = await supabase.from('club_members').insert([
    {
      club_id: clubId,
      user_id: userId,
      role: 'admin'
    }
  ]).select();

  console.log("Result:", data, "Error:", error);
}

main();
