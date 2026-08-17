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

async function setScorers() {
  const scorers = ['Nadeem', 'Sumit', 'Viki', 'Hemal', 'Harsh'];
  const { data, error } = await supabase
    .from('sessions')
    .update({ designated_scorers: scorers })
    .eq('id', 'hot101')
    .select();

  if (error) console.error('Error setting designated scorers:', error);
  else console.log('🎉 Successfully updated designated scorers for session hot101:', data[0].designated_scorers);
}

setScorers().catch(console.error);
