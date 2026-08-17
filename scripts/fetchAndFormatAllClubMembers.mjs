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

async function printMWAndPickleBoys() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const userMap = new Map();
  users.users.forEach(u => {
    const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || u.id;
    userMap.set(u.id, { name, email: u.email });
  });

  const { data: clubMembers } = await supabase.from('club_members').select('*');
  const { data: clubs } = await supabase.from('clubs').select('*');

  const targetClubs = clubs.filter(c => c.id === 'd5b57890-3787-41bb-bf23-38bc95345011' || c.id === 'a99a150f-7bb8-4b4a-ab86-90f945dcbf36' || c.id === 'fccd4a42-f3c7-4d93-9493-1e91828e66e2');

  for (const c of targetClubs) {
    const cms = clubMembers.filter(m => m.club_id === c.id);
    console.log(`\n================================================================================`);
    console.log(`CLUB: ${c.name.toUpperCase()} (ID: ${c.id}) - ${cms.length} Registered Members`);
    console.log(`================================================================================`);

    const memberList = cms.map((m, i) => {
      const u = userMap.get(m.user_id || m.player_id);
      return {
        '#': i + 1,
        'Member Name': u?.name || 'Registered Member',
        'Email Address': u?.email || 'N/A',
        'Role': (m.role || 'member').toUpperCase()
      };
    });

    console.table(memberList);
  }
}

printMWAndPickleBoys();
