import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read environment variables from .env.local
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

const url = env.NEXT_PUBLIC_SUPABASE_URL || 'https://ltbnjtgzpwxulbczmzdr.supabase.co';
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

// 1. Session Metadata Definition
const SESSION_ID = 'mw_mavericks_season_2_2026';
const CLUB_ID = 'mw_club_monday_wednesday';
const EVENT_NAME = 'MW Mavericks vs SVKM Challengers Season II';
const EVENT_DATE = '2026-08-12';

// Player rosters
const MW_MAVERICKS_PLAYERS = [
  'KARAN', 'AMBRESH', 'CHIRAG', 'HEMAL', 'SAGAR', 'AMIT', 'TUSHAR', 'GOPAL', 'KETAN', 'HITEN', 'MBS', 'SAURABH'
];

const SVKM_CHALLENGERS_PLAYERS = [
  '12', 'RAHIL', 'NEEL', 'ANISH', 'GAURAV', 'MRUGESH', 'HARSH', 'SMIT', 'TEJASH', 'VICKY', 'DD', 'AKSHAY'
];

const ALL_PLAYERS = [...MW_MAVERICKS_PLAYERS, ...SVKM_CHALLENGERS_PLAYERS];

// 22 League Rounds Schedule (66 Matches across Courts 1, 2, 3)
const LEAGUE_ROUNDS_DATA = [
  // SESSION 1 (R1 - R8, 1 pt each)
  {
    round_number: 1,
    time: '8:00 - 8:08 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['KARAN', 'AMBRESH'], team_b: ['12', 'RAHIL'] },
      { court: 2, team_a: ['GOPAL', 'SAGAR'], team_b: ['MRUGESH', 'HARSH'] },
      { court: 3, team_a: ['KETAN', 'MBS'], team_b: ['ANKIT', 'GAURAV'] }
    ]
  },
  {
    round_number: 2,
    time: '8:08 - 8:16 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['CHIRAG', 'HEMAL'], team_b: ['NEEL', 'ANISH'] },
      { court: 2, team_a: ['AMIT', 'TUSHAR'], team_b: ['SMIT', 'TEJASH'] },
      { court: 3, team_a: ['HITEN', 'SAURABH'], team_b: ['VICKY', 'RAHIL'] }
    ]
  },
  {
    round_number: 3,
    time: '8:16 - 8:24 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['KARAN', 'SAGAR'], team_b: ['12', 'GAURAV'] },
      { court: 2, team_a: ['GOPAL', 'KETAN'], team_b: ['MRUGESH', 'DD'] },
      { court: 3, team_a: ['CHIRAG', 'MBS'], team_b: ['ANKIT', 'ANISH'] }
    ]
  },
  {
    round_number: 4,
    time: '8:24 - 8:32 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['AMIT', 'HEMAL'], team_b: ['DD', 'RAHIL'] },
      { court: 2, team_a: ['HITEN', 'TUSHAR'], team_b: ['VICKY', 'GAURAV'] },
      { court: 3, team_a: ['AMBRESH', 'SAURABH'], team_b: ['NEEL', 'SMIT'] }
    ]
  },
  {
    round_number: 5,
    time: '8:32 - 8:40 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['KARAN', 'KETAN'], team_b: ['12', 'HARSH'] },
      { court: 2, team_a: ['CHIRAG', 'GOPAL'], team_b: ['ANKIT', 'MRUGESH'] },
      { court: 3, team_a: ['AMIT', 'MBS'], team_b: ['ANISH', 'TEJASH'] }
    ]
  },
  {
    round_number: 6,
    time: '8:40 - 8:48 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['HEMAL', 'HITEN'], team_b: ['GAURAV', 'SMIT'] },
      { court: 2, team_a: ['AMBRESH', 'TUSHAR'], team_b: ['NEEL', 'HARSH'] },
      { court: 3, team_a: ['SAGAR', 'SAURABH'], team_b: ['12', 'DD'] }
    ]
  },
  {
    round_number: 7,
    time: '8:48 - 8:56 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['CHIRAG', 'KARAN'], team_b: ['TEJASH', 'VICKY'] },
      { court: 2, team_a: ['AMIT', 'GOPAL'], team_b: ['DD', 'SMIT'] },
      { court: 3, team_a: ['HITEN', 'MBS'], team_b: ['ANKIT', 'HARSH'] }
    ]
  },
  {
    round_number: 8,
    time: '8:56 - 9:04 PM',
    session_phase: 1,
    points_weight: 1,
    matches: [
      { court: 1, team_a: ['HEMAL', 'AMBRESH'], team_b: ['MRUGESH', 'TEJASH'] },
      { court: 2, team_a: ['SAGAR', 'TUSHAR'], team_b: ['VICKY', 'ANISH'] },
      { court: 3, team_a: ['KETAN', 'SAURABH'], team_b: ['NEEL', 'RAHIL'] }
    ]
  },

  // SESSION 2 (R9 - R14, 2 pts each)
  {
    round_number: 9,
    time: '9:04 - 9:12 PM',
    session_phase: 2,
    points_weight: 2,
    matches: [
      { court: 1, team_a: ['GOPAL', 'TUSHAR'], team_b: ['12', 'ANKIT'] },
      { court: 2, team_a: ['HEMAL', 'SAURABH'], team_b: ['NEEL', 'MRUGESH'] },
      { court: 3, team_a: ['KARAN', 'MBS'], team_b: ['SMIT', 'ANISH'] }
    ]
  },
  {
    round_number: 10,
    time: '9:12 - 9:20 PM',
    session_phase: 2,
    points_weight: 2,
    matches: [
      { court: 1, team_a: ['AMIT', 'SAGAR'], team_b: ['HARSH', 'TEJASH'] },
      { court: 2, team_a: ['CHIRAG', 'AMBRESH'], team_b: ['NEEL', 'VICKY'] },
      { court: 3, team_a: ['HITEN', 'KETAN'], team_b: ['MRUGESH', 'RAHIL'] }
    ]
  },
  {
    round_number: 11,
    time: '9:20 - 9:28 PM',
    session_phase: 2,
    points_weight: 2,
    matches: [
      { court: 1, team_a: ['GOPAL', 'SAURABH'], team_b: ['DD', 'VICKY'] },
      { court: 2, team_a: ['MBS', 'TUSHAR'], team_b: ['TEJASH', 'GAURAV'] },
      { court: 3, team_a: ['HEMAL', 'KARAN'], team_b: ['ANKIT', 'SMIT'] }
    ]
  },
  {
    round_number: 12,
    time: '9:28 - 9:36 PM',
    session_phase: 2,
    points_weight: 2,
    matches: [
      { court: 1, team_a: ['AMIT', 'AMBRESH'], team_b: ['HARSH', 'DD'] },
      { court: 2, team_a: ['KETAN', 'SAGAR'], team_b: ['12', 'ANISH'] },
      { court: 3, team_a: ['CHIRAG', 'HITEN'], team_b: ['NEEL', 'GAURAV'] }
    ]
  },
  {
    round_number: 13,
    time: '9:36 - 9:44 PM',
    session_phase: 2,
    points_weight: 2,
    matches: [
      { court: 1, team_a: ['GOPAL', 'MBS'], team_b: ['ANKIT', 'VICKY'] },
      { court: 2, team_a: ['KARAN', 'SAURABH'], team_b: ['12', 'MRUGESH'] },
      { court: 3, team_a: ['HEMAL', 'TUSHAR'], team_b: ['SMIT', 'RAHIL'] }
    ]
  },
  {
    round_number: 14,
    time: '9:44 - 9:52 PM',
    session_phase: 2,
    points_weight: 2,
    matches: [
      { court: 1, team_a: ['AMIT', 'KETAN'], team_b: ['ANISH', 'DD'] },
      { court: 2, team_a: ['HITEN', 'AMBRESH'], team_b: ['TEJASH', 'RAHIL'] },
      { court: 3, team_a: ['CHIRAG', 'SAGAR'], team_b: ['HARSH', 'GAURAV'] }
    ]
  },

  // SESSION 3 (R15 - R22, 3 pts each)
  {
    round_number: 15,
    time: '10:00 - 10:08 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['HEMAL', 'KETAN'], team_b: ['12', 'NEEL'] },
      { court: 2, team_a: ['AMIT', 'HITEN'], team_b: ['DD', 'TEJASH'] },
      { court: 3, team_a: ['CHIRAG', 'TUSHAR'], team_b: ['ANKIT', 'RAHIL'] }
    ]
  },
  {
    round_number: 16,
    time: '10:08 - 10:16 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['AMIT', 'SAURABH'], team_b: ['ANISH', 'MRUGESH'] },
      { court: 2, team_a: ['CHIRAG', 'KETAN'], team_b: ['VICKY', 'HARSH'] },
      { court: 3, team_a: ['AMBRESH', 'SAGAR'], team_b: ['SMIT', '12'] }
    ]
  },
  {
    round_number: 17,
    time: '10:16 - 10:24 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['GOPAL', 'HEMAL'], team_b: ['NEEL', 'TEJASH'] },
      { court: 2, team_a: ['HITEN', 'KARAN'], team_b: ['RAHIL', 'ANISH'] },
      { court: 3, team_a: ['MBS', 'SAURABH'], team_b: ['DD', 'ANKIT'] }
    ]
  },
  {
    round_number: 18,
    time: '10:24 - 10:32 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['AMIT', 'CHIRAG'], team_b: ['MRUGESH', 'GAURAV'] },
      { court: 2, team_a: ['HITEN', 'SAGAR'], team_b: ['SMIT', 'VICKY'] },
      { court: 3, team_a: ['KETAN', 'AMBRESH'], team_b: ['RAHIL', 'HARSH'] }
    ]
  },
  {
    round_number: 19,
    time: '10:32 - 10:40 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['AMIT', 'KARAN'], team_b: ['12', 'TEJAS'] },
      { court: 2, team_a: ['GOPAL', 'HITEN'], team_b: ['NEEL', 'ANKIT'] },
      { court: 3, team_a: ['MBS', 'AMBRESH'], team_b: ['DD', 'GAURAV'] }
    ]
  },
  {
    round_number: 20,
    time: '10:40 - 10:48 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['HEMAL', 'SAGAR'], team_b: ['ANISH', 'HARSH'] },
      { court: 2, team_a: ['KETAN', 'TUSHAR'], team_b: ['MRUGESH', 'SMIT'] },
      { court: 3, team_a: ['CHIRAG', 'SAURABH'], team_b: ['12', 'VICKY'] }
    ]
  },
  {
    round_number: 21,
    time: '10:48 - 10:56 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['KARAN', 'TUSHAR'], team_b: ['NEEL', 'DD'] },
      { court: 2, team_a: ['GOPAL', 'AMBRESH'], team_b: ['RAHIL', 'GAURAV'] },
      { court: 3, team_a: ['MBS', 'SAGAR'], team_b: ['ANKIT', 'TEJAS'] }
    ]
  },
  {
    round_number: 22,
    time: '10:56 - 11:04 PM',
    session_phase: 3,
    points_weight: 3,
    matches: [
      { court: 1, team_a: ['GOPAL', 'KARAN'], team_b: ['ANISH', 'GAURAV'] },
      { court: 2, team_a: ['HEMAL', 'MBS'], team_b: ['VICKY', 'MRUGESH'] },
      { court: 3, team_a: ['SAURABH', 'TUSHAR'], team_b: ['SMIT', 'HARSH'] }
    ]
  }
];

// Rapid Fire Grand Finale Matches (6 matches, +10 bonus pts for winner)
const RAPID_FIRE_MATCHES_DATA = [
  { round_number: 23, rapid_fire_match: 1, court: 1, team_a: ['KARAN', 'GOPAL'], team_b: ['12', 'TEJAS'] },
  { round_number: 24, rapid_fire_match: 2, court: 1, team_a: ['HEMAL', 'TUSHAR'], team_b: ['ANKIT', 'RAHIL'] },
  { round_number: 25, rapid_fire_match: 3, court: 1, team_a: ['MBS', 'AMBRESH'], team_b: ['GAURAV', 'VICKY'] },
  { round_number: 26, rapid_fire_match: 4, court: 1, team_a: ['SAURABH', 'SAGAR'], team_b: ['DD', 'SMIT'] },
  { round_number: 27, rapid_fire_match: 5, court: 1, team_a: ['KETAN', 'CHIRAG'], team_b: ['NEEL', 'MRUGESH'] },
  { round_number: 28, rapid_fire_match: 6, court: 1, team_a: ['HITEN', 'AMIT'], team_b: ['ANISH', 'HARSH'] }
];

async function seedMwMavericksTournament() {
  console.log('========================================================================');
  console.log('   MW MAVERICKS VS SVKM CHALLENGERS SEASON II - TOURNAMENT SEEDER');
  console.log('========================================================================\n');

  // 1. Check or Create Club
  console.log(`1. Checking club "${CLUB_ID}"...`);
  const { data: existingClub } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', CLUB_ID)
    .single();

  let club = existingClub;
  if (!club) {
    console.log(`   Club "${CLUB_ID}" not found. Inserting club record...`);
    const { data: newClub, error: cErr } = await supabase
      .from('clubs')
      .insert([{
        id: CLUB_ID,
        name: 'Monday-Wednesday Club'
      }])
      .select()
      .single();

    if (cErr) {
      console.warn('   Could not insert club with custom ID:', cErr.message);
      // Fallback: check by name or create default
      const { data: nameClub } = await supabase.from('clubs').select('*').ilike('name', '%Monday-Wednesday%').limit(1);
      if (nameClub && nameClub.length > 0) {
        club = nameClub[0];
      }
    } else {
      club = newClub;
    }
  }

  const effectiveClubId = club ? club.id : CLUB_ID;
  console.log(`   Active Club ID: ${effectiveClubId}`);

  // 2. Insert or Upsert Session Row into `sessions`
  console.log(`\n2. Upserting session row for ID: "${SESSION_ID}"...`);

  const sessionPayload = {
    id: SESSION_ID,
    club_id: effectiveClubId,
    group_name: EVENT_NAME,
    format: 'team_championship',
    status: 'setup',
    event_date: EVENT_DATE,
    start_time: '8:00 PM',
    round_count: 22,
    court_labels: ['1', '2', '3'],
    round_duration_minutes: 8,
    rounds_per_block: 8,
    players: ALL_PLAYERS,
    squads: [
      {
        id: 'mw_mavericks',
        label: 'MW MAVERICKS',
        logoUrl: null,
        players: MW_MAVERICKS_PLAYERS
      },
      {
        id: 'svkm_challengers',
        label: 'SVKM CHALLENGERS',
        logoUrl: null,
        players: SVKM_CHALLENGERS_PLAYERS
      }
    ],
    stage_config: [
      { stageLabel: 'SESSION 1 - OPENING BATTLE', roundStart: 1, roundEnd: 8, pointsPerWin: 1, totalMatches: 24, totalPoints: 24 },
      { stageLabel: 'SESSION 2 - MOMENTUM SHIFT', roundStart: 9, roundEnd: 14, pointsPerWin: 2, totalMatches: 18, totalPoints: 36 },
      { stageLabel: 'SESSION 3 - FINAL CHARGE', roundStart: 15, roundEnd: 22, pointsPerWin: 3, totalMatches: 24, totalPoints: 72 }
    ],
    rapid_fire_config: {
      bonusPoints: 10,
      totalMatches: 6,
      matches: RAPID_FIRE_MATCHES_DATA
    },
    designated_scorers: ALL_PLAYERS
  };

  const { data: sessionRes, error: sessionErr } = await supabase
    .from('sessions')
    .upsert(sessionPayload, { onConflict: 'id' })
    .select()
    .single();

  if (sessionErr) {
    console.error('FAILED to upsert session row:', sessionErr);
    process.exit(1);
  }
  console.log(`   Successfully inserted/updated session row: ${sessionRes.id} (${sessionRes.group_name})`);

  // 3. Clean existing rounds for this session to ensure clean seed
  console.log(`\n3. Cleaning existing rounds for session "${SESSION_ID}"...`);
  const { error: delErr } = await supabase
    .from('rounds')
    .delete()
    .eq('session_id', SESSION_ID);

  if (delErr) {
    console.warn('   Warning while deleting existing rounds:', delErr.message);
  } else {
    console.log('   Old rounds cleared successfully.');
  }

  // 4. Build array of rounds to insert into `rounds` table
  console.log('\n4. Preparing rounds rows insertion (66 League + 6 Rapid Fire)...');

  const roundRowsToInsert = [];

  // 4a. 66 League Matches (22 Rounds x 3 Courts)
  LEAGUE_ROUNDS_DATA.forEach(r => {
    r.matches.forEach(m => {
      roundRowsToInsert.push({
        session_id: SESSION_ID,
        round_number: r.round_number,
        court: m.court,
        team_a: m.team_a,
        team_b: m.team_b,
        sitting_out: []
      });
    });
  });

  // 4b. 6 Rapid Fire Grand Finale Matches
  RAPID_FIRE_MATCHES_DATA.forEach(rf => {
    roundRowsToInsert.push({
      session_id: SESSION_ID,
      round_number: rf.round_number,
      court: rf.court,
      team_a: rf.team_a,
      team_b: rf.team_b,
      sitting_out: []
    });
  });

  console.log(`   Total round records to insert: ${roundRowsToInsert.length}`);

  // Insert into DB
  const { data: insertedRounds, error: roundsErr } = await supabase
    .from('rounds')
    .insert(roundRowsToInsert)
    .select();

  if (roundsErr) {
    console.error('FAILED to insert rounds rows:', roundsErr);
    process.exit(1);
  }

  // Count breakdown
  const leagueCount = insertedRounds.filter(r => r.round_number <= 22).length;
  const rapidFireCount = insertedRounds.filter(r => r.round_number >= 23).length;

  console.log('\n========================================================================');
  console.log('   DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('========================================================================');
  console.log(`   Session ID                 : ${SESSION_ID}`);
  console.log(`   Session Name               : ${EVENT_NAME}`);
  console.log(`   Event Date                 : ${EVENT_DATE}`);
  console.log(`   Club ID                    : ${effectiveClubId}`);
  console.log(`   Sessions Inserted/Updated  : 1`);
  console.log(`   Total Rounds Inserted      : ${insertedRounds.length}`);
  console.log(`     - Session 1 (R1-R8)      : 24 matches (8 rounds x 3 courts)`);
  console.log(`     - Session 2 (R9-R14)     : 18 matches (6 rounds x 3 courts)`);
  console.log(`     - Session 3 (R15-R22)    : 24 matches (8 rounds x 3 courts)`);
  console.log(`     - Rapid Fire Grand Finale : 6 matches (R23-R28)`);
  console.log(`   Total League Matches Verified: ${leagueCount} / 66`);
  console.log(`   Total Rapid Fire Verified   : ${rapidFireCount} / 6`);
  console.log('========================================================================\n');
}

seedMwMavericksTournament().catch(err => {
  console.error('Fatal error during database seeding:', err);
  process.exit(1);
});
