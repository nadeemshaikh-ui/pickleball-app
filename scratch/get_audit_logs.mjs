import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables
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
  const { data: logs, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }
  console.log('--- RECENT AUDIT LOGS ---');
  logs.forEach(l => console.log(`[${l.created_at}] Action: ${l.action} | Details:`, JSON.stringify(l.details || l.metadata)));
}
run();
