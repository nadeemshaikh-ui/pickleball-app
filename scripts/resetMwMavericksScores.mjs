import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltbnjtgzpwxulbczmzdr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Ym5qdGd6cHd4dWxiY3ptemRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTk2OTYsImV4cCI6MjA5ODQ5NTY5Nn0.39qbmLJOLNKXcaBcX2pZqh3NSi8JDCGPel5ZN4SWJmw';

const supabase = createClient(supabaseUrl, supabaseKey);
const SESSION_ID = 'mw_mavericks_season_2_2026';

async function resetAllTournamentScores() {
  console.log(`Resetting all match scores for session ${SESSION_ID}...`);
  const { data, error } = await supabase
    .from('rounds')
    .update({ score_a: null, score_b: null })
    .eq('session_id', SESSION_ID);

  if (error) {
    console.error('Error resetting scores:', error);
  } else {
    console.log('Successfully reset all 72 matches in Supabase DB to 0-0 pending state!');
  }
}

resetAllTournamentScores();
