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

function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function main() {
  const joinCode = generateJoinCode();
  console.log("Inserting Hotshots Pickleball Club with join code:", joinCode);
  
  const { data, error } = await supabase.from('clubs').insert([
    {
      name: 'Hotshots Pickleball Club',
      join_code: joinCode,
      created_by: 'e2696790-a409-43cc-ad8d-931688fd2ac8'
    }
  ]).select();

  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("SUCCESS! Created Hotshots Club:", data);
  }
}

main();
