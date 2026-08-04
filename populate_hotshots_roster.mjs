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

const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';

const playerNames = [
  "Viki", "Sid", "Deep", "Yule", "Shrinath", "Sumit",
  "Hemal", "Priyesh", "Gulshan", "Ankit", "Nadeem", "Karan",
  "Gopal", "Shaan", "Miten", "Anosh", "Amresh", "PK"
];

async function main() {
  console.log("Adding 18 players to HOTSHOTS club roster...");
  const rows = playerNames.map(name => ({
    club_id: clubId,
    name: name
  }));

  const { data, error } = await supabase.from('players').insert(rows).select();
  if (error) {
    console.error("Error inserting players:", error);
  } else {
    console.log(`SUCCESSFULLY ADDED ${data.length} PLAYERS TO HOTSHOTS ROSTER!`);
    console.log(data.map(p => p.name));
  }
}

main();
