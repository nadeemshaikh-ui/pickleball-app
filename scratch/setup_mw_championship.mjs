import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

const sessionId = 'mw_mavericks_vs_hotshots_2026';
const clubId = 'd5b57890-3787-41bb-bf23-38bc95345011'; // Monday-Wednesday Club ID

// Group A (Blue Storm)
const mavericksA = ['Hemal', 'Karan', 'Nimish', 'Saurabh'];
// Group B (Red Strikers)
const mavericksB = ['Gopal', 'Miten', 'Hitesh', 'Chirag'];
// Group C (Green Force)
const mavericksC = ['Tushar', 'Hiten', 'Amit', 'Ketan'];

// Group A (Blue Blazers)
const hotshotsX = ['Sumiit', 'Viki', 'Nadeem', 'Sid G'];
// Group B (Red Firestorm)
const hotshotsY = ['Deep', 'Priyesh', 'Amreesh', 'Anosh'];
// Group C (Green Hurricanes)
const hotshotsZ = ['Shahnawaz', 'Arif', 'Ansh', 'Gulshan'];

const mavericksPlayers = [...mavericksA, ...mavericksB, ...mavericksC];
const hotshotsPlayers = [...hotshotsX, ...hotshotsY, ...hotshotsZ];

// Parent Squad configs without logos
const squadsConfig = [
  { id: 'mavericks', label: 'Mavericks', players: mavericksPlayers, logoUrl: null },
  { id: 'hotshots', label: 'Hotshots', players: hotshotsPlayers, logoUrl: null }
];

async function run() {
  console.log("Re-aligning session metadata to Monday-Wednesday Club & removing logo configurations...");
  
  const { error } = await supabase.from('sessions')
    .update({ 
      club_id: clubId,
      squads: squadsConfig,
      logo_url_1: null,
      logo_url_2: null
    })
    .eq('id', sessionId);

  if (error) {
    console.error("Error updating session parameters:", error);
  } else {
    console.log("Monday-Wednesday Club alignment completed, and all old team logos have been removed!");
  }
}

run().catch(console.error);
