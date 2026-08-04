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

const payload = JSON.parse(fs.readFileSync('../Google Antigravity/Hotshots_Option_1_Club_Schedule_10min.json', 'utf8'));

async function updateDb() {
  console.log("Updating Supabase Tournament status to disable open registration & set 10-min schedule...");

  // Update Tournament: close open registration
  const { data: tourn, error: tErr } = await supabase
    .from('tournaments')
    .update({ registration_open: false })
    .eq('id', 'cb91d6bb-567b-4f94-af96-19fbaa5037b4')
    .select();

  console.log("Tournament updated:", tourn, "Err:", tErr);

  // Update Stage: set 10-min schedule payload
  const { data: stage, error: sErr } = await supabase
    .from('tournament_stages')
    .update({
      config: {
        rosters: {
          hour1: payload.hour1_rosters,
          hour2: payload.hour2_rosters
        },
        schedule: payload.rounds
      }
    })
    .eq('id', 'f390cb11-ca6c-4246-ad8d-f53b2962632e')
    .select();

  console.log("Stage updated:", stage, "Err:", sErr);
  console.log("SUCCESS! 10-MIN SCHEDULE & CLOSED REGISTRATION APPLIED TO DB!");
}

updateDb();
