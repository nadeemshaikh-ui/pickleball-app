const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ltbnjtgzpwxulbczmzdr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Ym5qdGd6cHd4dWxiY3ptemRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjkxOTY5NiwiZXhwIjoyMDk4NDk1Njk2fQ.diLng4z6awlkwTp4_IIAhJv4_Gzke5U0q2EGpDspdzQ'
);

const OWNER_USER_ID = 'e2696790-a409-43cc-ad8d-931688fd2ac8'; // nadeemshaikh@gmail.com
const PICKLE_BOYS_ID = 'a99a150f-7bb8-4b4a-ab86-90f945dcbf36';
const MONDAY_WEDNESDAY_ID = 'd5b57890-3787-41bb-bf23-38bc95345011';

async function executeReset() {
  console.log('=== STARTING SYSTEM DATA RESET ===');

  // 1. Clear activity and format tables
  const tablesToWipe = [
    'error_logs',
    'club_join_requests',
    'club_creation_requests',
    'tournament_matches',
    'tournament_teams',
    'tournament_stages',
    'tournaments',
    'auction_bids',
    'auction_teams',
    'auctions',
    'squad_rivalry_matches',
    'squad_members',
    'squads',
    'dues',
    'matches',
    'rounds',
    'sessions'
  ];

  for (const table of tablesToWipe) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) console.log(`Notice on clearing ${table}:`, error.message);
      else console.log(`Cleared table: ${table}`);
    } catch (e) {
      console.log(`Table ${table} skipped or empty:`, e.message);
    }
  }

  // 2. Delete any non-target clubs
  const { error: clubDeleteError } = await supabase
    .from('clubs')
    .delete()
    .not('id', 'in', `("${PICKLE_BOYS_ID}","${MONDAY_WEDNESDAY_ID}")`);
  if (clubDeleteError) console.log('Notice on extra clubs delete:', clubDeleteError.message);
  else console.log('Extra clubs deleted if any.');

  // Update ownership of both remaining clubs to nadeemshaikh@gmail.com
  await supabase.from('clubs').update({ created_by: OWNER_USER_ID }).in('id', [PICKLE_BOYS_ID, MONDAY_WEDNESDAY_ID]);
  console.log('Ownership of remaining 2 clubs updated to nadeemshaikh@gmail.com.');

  // 3. Clean players table (keep only nadeemshaikh@gmail.com)
  const { error: playersDeleteError } = await supabase
    .from('players')
    .delete()
    .neq('user_id', OWNER_USER_ID);
  if (playersDeleteError) console.log('Notice on players cleanup:', playersDeleteError.message);
  else console.log('Non-owner player rows deleted.');

  // Ensure nadeemshaikh@gmail.com has player rows in both clubs
  await supabase.from('players').upsert([
    { club_id: PICKLE_BOYS_ID, user_id: OWNER_USER_ID, name: 'nadim shaikh' },
    { club_id: MONDAY_WEDNESDAY_ID, user_id: OWNER_USER_ID, name: 'nadim shaikh' }
  ], { onConflict: 'club_id,user_id' });
  console.log('Player rows for nadeemshaikh@gmail.com verified in both clubs.');

  // 4. Clean club_members table (keep only nadeemshaikh@gmail.com as Admin)
  await supabase.from('club_members').delete().neq('user_id', OWNER_USER_ID);
  await supabase.from('club_members').upsert([
    { club_id: PICKLE_BOYS_ID, user_id: OWNER_USER_ID, role: 'admin', danger_zone_access: true, removed_at: null },
    { club_id: MONDAY_WEDNESDAY_ID, user_id: OWNER_USER_ID, role: 'admin', danger_zone_access: true, removed_at: null }
  ], { onConflict: 'club_id,user_id' });
  console.log('Club members table cleaned. nadeemshaikh@gmail.com set as sole Admin in both clubs.');

  // 5. Clean Auth Users
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('Error listing auth users:', usersError);
  } else {
    const toDelete = usersData.users.filter(u => u.id !== OWNER_USER_ID && u.email !== 'nadeemshaikh@gmail.com');
    console.log(`Found ${toDelete.length} non-owner auth user(s) to delete from Supabase Auth.`);
    for (const user of toDelete) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
      if (delErr) console.error(`Error deleting user ${user.id} (${user.email}):`, delErr.message);
      else console.log(`Deleted auth user: ${user.email || user.id}`);
    }
  }

  console.log('\n=== VERIFYING FINAL SYSTEM STATE ===');
  const { data: finalClubs } = await supabase.from('clubs').select('id, name, created_by, join_code');
  console.log('Remaining Clubs:', finalClubs);

  const { data: finalMembers } = await supabase.from('club_members').select('*');
  console.log('Remaining Club Members:', finalMembers);

  const { data: finalPlayers } = await supabase.from('players').select('id, club_id, user_id, name');
  console.log('Remaining Players:', finalPlayers);

  const { data: finalAuthUsers } = await supabase.auth.admin.listUsers();
  console.log('Remaining Auth Users count:', finalAuthUsers.users.length);
  finalAuthUsers.users.forEach(u => console.log(`- ${u.id} (${u.email})`));

  console.log('=== SYSTEM DATA RESET COMPLETED SUCCESSFULLY ===');
}

executeReset().catch(console.error);
