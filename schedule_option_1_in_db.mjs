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

const payload = JSON.parse(fs.readFileSync('../Google Antigravity/Hotshots_Option_1_Club_Schedule.json', 'utf8'));

async function main() {
  console.log("Locating HOTSHOTS club...");
  const { data: clubs, error: clubErr } = await supabase.from('clubs').select('*');
  if (clubErr) {
    console.error("Club fetch error:", clubErr);
    return;
  }
  
  let hotshots = clubs.find(c => c.name && c.name.toUpperCase().includes('HOTSHOTS'));
  if (!hotshots) {
    console.log("Creating HOTSHOTS club...");
    const { data: newClub, error: createErr } = await supabase.from('clubs').insert([
      { name: 'HOTSHOTS', slug: 'hotshots' }
    ]).select().single();
    hotshots = newClub;
  }
  
  console.log("HOTSHOTS Club ID:", hotshots.id);
  
  // Insert or Update Tournament
  const { data: existingTournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('club_id', hotshots.id)
    .eq('name', payload.tournament_name);
    
  let tournament;
  if (existingTournaments && existingTournaments.length > 0) {
    tournament = existingTournaments[0];
    console.log("Found existing tournament:", tournament.id);
  } else {
    console.log("Creating new tournament in HOTSHOTS club...");
    const shareToken = 'HOTSHOTS-OPT1-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: newTourn, error: tErr } = await supabase
      .from('tournaments')
      .insert([{
        club_id: hotshots.id,
        name: payload.tournament_name,
        status: 'active',
        share_token: shareToken,
        created_by: hotshots.created_by || 'e2696790-a409-43cc-ad8d-931688fd2ac8'
      }])
      .select()
      .single();
    if (tErr) {
      console.error("Tournament creation error:", tErr);
      return;
    }
    tournament = newTourn;
    console.log("Created tournament:", tournament.id, "Share Token:", shareToken);
  }

  // Create Stage
  const { data: existingStages } = await supabase
    .from('tournament_stages')
    .select('*')
    .eq('tournament_id', tournament.id);
    
  let stage;
  if (existingStages && existingStages.length > 0) {
    stage = existingStages[0];
    console.log("Found existing stage:", stage.id);
  } else {
    const { data: newStage, error: sErr } = await supabase
      .from('tournament_stages')
      .insert([{
        tournament_id: tournament.id,
        club_id: hotshots.id,
        stage_order: 1,
        stage_type: 'group',
        name: '3-Group 12-Round Championship (Option 1)',
        status: 'active',
        config: {
          rosters: {
            hour1: payload.hour1_rosters,
            hour2: payload.hour2_rosters
          },
          schedule: payload.rounds
        }
      }])
      .select()
      .single();
    if (sErr) {
      console.error("Stage creation error:", sErr);
      return;
    }
    stage = newStage;
    console.log("Created stage:", stage.id);
  }

  console.log("SUCCESS! Option 1 schedule created and assigned to HOTSHOTS club!");
}

main();
