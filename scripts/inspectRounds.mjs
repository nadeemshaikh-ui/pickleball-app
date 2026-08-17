import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltbnjtgzpwxulbczmzdr.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3OiOiJzdXBhYmFzZSIsInJlZiI6Imx0Ym5qdGd6cHd4dWxiY3ptemRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjkxOTY5NiwiZXhwIjoyMDk4NDk1Njk2fQ.diLng4z6awlkwTp4_IIAhJv4_Gzke5U0q2EGpDspdzQ';

const supabase = createClient(supabaseUrl, serviceKey);
const SESSION_ID = 'mw_mavericks_season_2_2026';

async function inspectAllRounds() {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', SESSION_ID);

  if (error) {
    console.error('Error fetching rounds:', error);
    return;
  }

  console.log(`Total rows in DB for ${SESSION_ID}: ${data.length}`);
  const nonNullRows = data.filter(r => r.score_a !== null || r.score_b !== null);
  console.log(`Non-null score rows count: ${nonNullRows.length}`);
  nonNullRows.forEach(r => {
    console.log(`Round ${r.round_number} Court ${r.court}: score_a=${r.score_a}, score_b=${r.score_b}`);
  });
}

inspectAllRounds();
