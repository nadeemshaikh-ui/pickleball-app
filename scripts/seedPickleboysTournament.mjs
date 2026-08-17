import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEAMS = [
  // Group A
  { id: 'A1', name: "Rao's Paltan", captain: 'Tarang', group: 'A', roster: ['Tarang', 'Aum', 'Devang', 'Pooja', 'veer', 'Saurabh Rathi'] },
  { id: 'A2', name: 'Dabang Dinkers', captain: 'Rohan D.', group: 'A', roster: ['Rohan D.', 'Nirbhay', 'Justin', 'Romi', 'Sarthak L', 'Kunal Demba'] },
  { id: 'A3', name: 'Munchilicious', captain: 'Himanshu', group: 'A', roster: ['Himanshu', 'Ravi', 'Alok', 'Divya', 'Gulshan', 'Aditya Desai'] },
  { id: 'A4', name: 'Pickleboys', captain: 'Arsh', group: 'A', roster: ['Arsh', 'Ishaan', 'Azim', 'Karishma', 'Ayush', 'Harshil'] },
  // Group B
  { id: 'B1', name: 'The Dink Floyd', captain: 'Amit Sir', group: 'B', roster: ['Amit Sir', 'Rewanth', 'Deepak G', 'Shivangi', 'Rushabh', 'Kunal shah'] },
  { id: 'B2', name: 'Airavat', captain: 'Udipt', group: 'B', roster: ['Udipt', 'Shivam Singh', 'Aman', 'Erin', 'Narry', 'Rahul W'] },
  { id: 'B3', name: 'Pickleboss', captain: 'Rajesh M.', group: 'B', roster: ['Rajesh M.', 'Karan S', 'Amresh', 'Anjali', 'Faisal Khan', 'Keyur'] },
  { id: 'B4', name: "Leo's SIX", captain: 'Aakash', group: 'B', roster: ['Aakash', 'Dev', 'Nadeem', 'Kavita', 'Hitesh bhai', 'Kaustubh'] },
];

const SCHEDULE = [
  // Round 1 (Group Round 1)
  { round: 1, court: 1, teamA: 'A1', teamB: 'A2', type: 'Group A' },
  { round: 1, court: 2, teamA: 'A3', teamB: 'A4', type: 'Group A' },
  { round: 1, court: 3, teamA: 'B1', teamB: 'B2', type: 'Group B' },
  { round: 1, court: 4, teamA: 'B3', teamB: 'B4', type: 'Group B' },
  // Round 2 (Group Round 2)
  { round: 2, court: 1, teamA: 'A1', teamB: 'A3', type: 'Group A' },
  { round: 2, court: 2, teamA: 'A2', teamB: 'A4', type: 'Group A' },
  { round: 2, court: 3, teamA: 'B1', teamB: 'B3', type: 'Group B' },
  { round: 2, court: 4, teamA: 'B2', teamB: 'B4', type: 'Group B' },
  // Round 3 (Group Round 3)
  { round: 3, court: 1, teamA: 'A1', teamB: 'A4', type: 'Group A' },
  { round: 3, court: 2, teamA: 'A2', teamB: 'A3', type: 'Group A' },
  { round: 3, court: 3, teamA: 'B1', teamB: 'B4', type: 'Group B' },
  { round: 3, court: 4, teamA: 'B2', teamB: 'B3', type: 'Group B' },
  // Round 4 (Cross-Group Seeding Match)
  { round: 4, court: 1, teamA: 'A1', teamB: 'B1', type: 'Cross-Group (1st vs 1st)' },
  { round: 4, court: 2, teamA: 'A2', teamB: 'B2', type: 'Cross-Group (2nd vs 2nd)' },
  { round: 4, court: 3, teamA: 'A3', teamB: 'B3', type: 'Cross-Group (3rd vs 3rd)' },
  { round: 4, court: 4, teamA: 'A4', teamB: 'B4', type: 'Cross-Group (4th vs 4th)' },
];

async function seed() {
  console.log('--- SEEDING PICKLEBOYS SUNDAY TOURNAMENT ---');

  // 1. Ensure Pickleboys / Pickle Boys Club exists
  let { data: club } = await supabase
    .from('clubs')
    .select('*')
    .or('id.eq.a99a150f-7bb8-4b4a-ab86-90f945dcbf36,name.ilike.%pickle%boys%')
    .limit(1)
    .maybeSingle();

  if (!club) {
    const { data: newClub, error } = await supabase
      .from('clubs')
      .insert({ name: 'Pickleboys', join_code: 'BOYS51', created_by: 'e2696790-a409-43cc-ad8d-931688fd2ac8' })
      .select('*')
      .single();
    if (error) throw error;
    club = newClub;
    console.log('Created Pickleboys Club:', club.id);
  } else {
    console.log('Found existing Pickleboys Club:', club.id);
  }

  // 2. Ensure all 48 players exist in player roster
  const allPlayerNames = Array.from(new Set(TEAMS.flatMap(t => t.roster)));
  for (const name of allPlayerNames) {
    const { data: p } = await supabase
      .from('players')
      .select('*')
      .eq('club_id', club.id)
      .eq('name', name)
      .maybeSingle();
    if (!p) {
      await supabase.from('players').insert({
        club_id: club.id,
        name,
        user_id: `user_seed_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        elo_rating: 1200,
        games_played: 0,
      });
    }
  }

  console.log(`Registered all ${allPlayerNames.length} players under Pickleboys Club.`);

  // 3. Create Tournament Session
  const sessionId = Math.random().toString(36).slice(2, 10);
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .insert({
      id: sessionId,
      club_id: club.id,
      group_name: 'Pickleboys Sunday 51-Point Championship',
      format: 'team_championship',
      players: allPlayerNames,
      court_labels: ['1', '2', '3', '4'],
      round_count: 4,
      status: 'in_progress',
    })
    .select('*')
    .single();

  if (sessErr) throw sessErr;
  console.log('Created Tournament Session:', session.id);

  // 4. Create Round Fixtures
  const roundRows = SCHEDULE.map(s => ({
    session_id: session.id,
    round_number: s.round,
    court: s.court,
    team_a: TEAMS.find(t => t.id === s.teamA)?.roster.slice(0, 2) || [],
    team_b: TEAMS.find(t => t.id === s.teamB)?.roster.slice(0, 2) || [],
    sitting_out: [],
    score_a: null,
    score_b: null,
  }));

  const { error: roundErr } = await supabase.from('rounds').insert(roundRows);
  if (roundErr) throw roundErr;

  console.log(`Successfully inserted 16 tournament match fixtures into session #${session.id}!`);
  console.log(`Live Tournament URL: /tournaments/pickleboys`);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
