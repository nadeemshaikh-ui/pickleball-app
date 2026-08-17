import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let serviceKey = '';

envLines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, serviceKey);

const july29Rounds = [
  // Session 1
  { round_number: 1, court: 1, team_a: ['Karan', 'Tushar'], team_b: ['Viki', 'Deep'], score_a: 15, score_b: 13 },
  { round_number: 1, court: 2, team_a: ['Gopal', 'Amit'], team_b: ['Sid', 'Aryan'], score_a: 12, score_b: 15 },
  { round_number: 1, court: 3, team_a: ['MBS', 'Rahul'], team_b: ['Nadeem', 'Amresh'], score_a: 14, score_b: 15 },

  { round_number: 2, court: 1, team_a: ['Saurabh', 'Sagar'], team_b: ['Amresh', 'Vinit'], score_a: 8, score_b: 15 },
  { round_number: 2, court: 2, team_a: ['Hemal', 'Hiten'], team_b: ['Sumeet', 'Aryan'], score_a: 14, score_b: 15 },
  { round_number: 2, court: 3, team_a: ['Karan', 'Rahul'], team_b: ['Sid', 'Ankit'], score_a: 15, score_b: 13 },

  { round_number: 3, court: 1, team_a: ['Hemal', 'Tushar'], team_b: ['Sumeet', 'Kris'], score_a: 15, score_b: 11 },
  { round_number: 3, court: 2, team_a: ['MBS', 'Sagar'], team_b: ['Deep', 'Vinit'], score_a: 15, score_b: 9 },
  { round_number: 3, court: 3, team_a: ['Saurabh', 'Amit'], team_b: ['Viki', 'Ankit'], score_a: 14, score_b: 15 },

  { round_number: 4, court: 1, team_a: ['Karan', 'Amit'], team_b: ['Nadeem', 'Kris'], score_a: 15, score_b: 12 },
  { round_number: 4, court: 2, team_a: ['Gopal', 'Rahul'], team_b: ['Deep', 'Amresh'], score_a: 5, score_b: 15 },
  { round_number: 4, court: 3, team_a: ['MBS', 'Hiten'], team_b: ['Viki', 'Aryan'], score_a: 14, score_b: 15 },

  { round_number: 5, court: 1, team_a: ['Gopal', 'Hiten'], team_b: ['Kris', 'Vinit'], score_a: 15, score_b: 7 },
  { round_number: 5, court: 2, team_a: ['Hemal', 'Sagar'], team_b: ['Nadeem', 'Ankit'], score_a: 15, score_b: 8 },
  { round_number: 5, court: 3, team_a: ['Saurabh', 'Tushar'], team_b: ['Sid', 'Sumeet'], score_a: 11, score_b: 15 },

  // Session 2
  { round_number: 6, court: 1, team_a: ['MBS', 'Saurabh'], team_b: ['Viki', 'Sumeet'], score_a: 14, score_b: 15 },
  { round_number: 6, court: 2, team_a: ['Hemal', 'Karan'], team_b: ['Deep', 'Sid'], score_a: 15, score_b: 8 },
  { round_number: 6, court: 3, team_a: ['Rahul', 'Sagar'], team_b: ['Vinit', 'Nadeem'], score_a: 15, score_b: 9 },

  { round_number: 7, court: 1, team_a: ['Sagar', 'Amit'], team_b: ['Amresh', 'Sumeet'], score_a: 10, score_b: 15 },
  { round_number: 7, court: 2, team_a: ['Hiten', 'Tushar'], team_b: ['Kris', 'Viki'], score_a: 7, score_b: 15 },
  { round_number: 7, court: 3, team_a: ['Saurabh', 'Gopal'], team_b: ['Aryan', 'Ankit'], score_a: 15, score_b: 12 },

  { round_number: 8, court: 1, team_a: ['Gopal', 'Hemal'], team_b: ['Sid', 'Vinit'], score_a: 15, score_b: 9 },
  { round_number: 8, court: 2, team_a: ['Karan', 'MBS'], team_b: ['Deep', 'Nadeem'], score_a: 15, score_b: 9 },
  { round_number: 8, court: 3, team_a: ['Tushar', 'Rahul'], team_b: ['Amresh', 'Aryan'], score_a: 15, score_b: 13 },

  { round_number: 9, court: 1, team_a: ['Karan', 'Hiten'], team_b: ['Sid', 'Kris'], score_a: 14, score_b: 15 },
  { round_number: 9, court: 2, team_a: ['Saurabh', 'Rahul'], team_b: ['Sumeet', 'Ankit'], score_a: 11, score_b: 15 },
  { round_number: 9, court: 3, team_a: ['Hemal', 'Amit'], team_b: ['Viki', 'Vinit'], score_a: 15, score_b: 8 },

  { round_number: 10, court: 1, team_a: ['Amit', 'Hiten'], team_b: ['Nadeem', 'Aryan'], score_a: 9, score_b: 15 },
  { round_number: 10, court: 2, team_a: ['Gopal', 'Sagar'], team_b: ['Amresh', 'Ankit'], score_a: 11, score_b: 15 },
  { round_number: 10, court: 3, team_a: ['MBS', 'Tushar'], team_b: ['Deep', 'Kris'], score_a: 9, score_b: 15 },

  // Session 3
  { round_number: 11, court: 1, team_a: ['Hemal', 'Rahul'], team_b: ['Sumeet', 'Nadeem'], score_a: 13, score_b: 15 },
  { round_number: 11, court: 2, team_a: ['Tushar', 'Amit'], team_b: ['Sid', 'Viki'], score_a: 15, score_b: 13 },
  { round_number: 11, court: 3, team_a: ['Karan', 'Sagar'], team_b: ['Amresh', 'Kris'], score_a: 11, score_b: 15 },

  { round_number: 12, court: 1, team_a: ['Rahul', 'Hiten'], team_b: ['Aryan', 'Vinit'], score_a: 13, score_b: 15 },
  { round_number: 12, court: 2, team_a: ['Saurabh', 'Karan'], team_b: ['Deep', 'Ankit'], score_a: 15, score_b: 8 },
  { round_number: 12, court: 3, team_a: ['Gopal', 'MBS'], team_b: ['Sid', 'Nadeem'], score_a: 15, score_b: 14 },

  { round_number: 13, court: 1, team_a: ['Amit', 'Rahul'], team_b: ['Viki', 'Amresh'], score_a: 14, score_b: 15 },
  { round_number: 13, court: 2, team_a: ['Hemal', 'Saurabh'], team_b: ['Aryan', 'Kris'], score_a: 11, score_b: 15 },
  { round_number: 13, court: 3, team_a: ['Sagar', 'Tushar'], team_b: ['Ankit', 'Vinit'], score_a: 15, score_b: 12 },

  { round_number: 14, court: 1, team_a: ['Gopal', 'Tushar'], team_b: ['Deep', 'Sumeet'], score_a: 15, score_b: 6 },
  { round_number: 14, court: 2, team_a: ['Hiten', 'Sagar'], team_b: ['Viki', 'Nadeem'], score_a: 10, score_b: 15 },
  { round_number: 14, court: 3, team_a: ['MBS', 'Amit'], team_b: ['Ankit', 'Kris'], score_a: 12, score_b: 15 },

  { round_number: 15, court: 1, team_a: ['Karan', 'Gopal'], team_b: ['Deep', 'Aryan'], score_a: 15, score_b: 8 },
  { round_number: 15, court: 2, team_a: ['MBS', 'Hemal'], team_b: ['Sid', 'Amresh'], score_a: 15, score_b: 6 },
  { round_number: 15, court: 3, team_a: ['Saurabh', 'Hiten'], team_b: ['Sumeet', 'Vinit'], score_a: 15, score_b: 13 },
];

async function populateJuly29Rounds() {
  console.log('=== POPULATING ALL 45 STAGE MATCHES FOR JULY 29TH EVENT (1u03ob) ===');
  
  // Clear any existing rows for 1u03ob first
  await supabase.from('rounds').delete().eq('session_id', '1u03ob');

  const rowsToInsert = july29Rounds.map(r => ({
    session_id: '1u03ob',
    round_number: r.round_number,
    court: r.court,
    team_a: r.team_a,
    team_b: r.team_b,
    score_a: r.score_a,
    score_b: r.score_b,
    sitting_out: []
  }));

  const { data, error } = await supabase.from('rounds').insert(rowsToInsert).select();
  if (error) {
    console.error('Error inserting July 29th rounds:', error);
  } else {
    console.log(`✅ SUCCESSFULLY INSERTED ${data.length} STAGE MATCHES & SCORES FOR JULY 29TH EVENT!`);
  }
}

populateJuly29Rounds();
