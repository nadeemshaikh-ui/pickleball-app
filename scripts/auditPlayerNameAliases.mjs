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

async function auditAllPlayerNamesInRounds() {
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .in('session_id', ['mw_mavericks_season_2_2026', '1u03ob']);

  console.log(`=== AUDITING ALL PLAYER NAMES IN BOTH MW TOURNAMENTS (${rounds?.length || 0} ROUNDS) ===\n`);

  const rawNamesBySession = new Map();

  (rounds || []).forEach(r => {
    const sId = r.session_id;
    if (!rawNamesBySession.has(sId)) rawNamesBySession.set(sId, new Set());
    const set = rawNamesBySession.get(sId);

    (r.team_a || []).forEach(p => set.add(p));
    (r.team_b || []).forEach(p => set.add(p));
  });

  for (const [sId, set] of rawNamesBySession.entries()) {
    const tName = sId === 'mw_mavericks_season_2_2026' ? 'August 12 Tournament (mw_mavericks_season_2_2026)' : 'July 29 Tournament (1u03ob)';
    console.log(`\n================ ${tName} (${set.size} unique raw names) ================`);
    console.log(Array.from(set).sort().join(', '));
  }
}

auditAllPlayerNamesInRounds();
