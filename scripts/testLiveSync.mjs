import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltbnjtgzpwxulbczmzdr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Ym5qdGd6cHd4dWxiY3ptemRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTk2OTYsImV4cCI6MjA5ODQ5NTY5Nn0.39qbmLJOLNKXcaBcX2pZqh3NSi8JDCGPel5ZN4SWJmw';

const supabase = createClient(supabaseUrl, supabaseKey);
const SESSION_ID = 'mw_mavericks_season_2_2026';

async function testSync() {
  console.log('Testing live DB read for session:', SESSION_ID);
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', SESSION_ID)
    .not('score_a', 'is', null);

  if (error) {
    console.error('Error fetching rounds:', error);
  } else {
    console.log(`Found ${data.length} scored rounds in central DB for ${SESSION_ID}.`);
    data.forEach(r => {
      console.log(`Round ${r.round_number} Court ${r.court}: ${r.team_a.join('&')} (${r.score_a}) vs ${r.team_b.join('&')} (${r.score_b})`);
    });
  }
}

testSync();
