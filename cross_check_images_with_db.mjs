import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

// Exact fixtures read from the user's uploaded images
const imageCourt1 = [
  { r: 1, time: '08:00 PM', t1: 'Deep & Shaan', t2: 'Priyesh & Hemal', rest: 'Ankit, Yule' },
  { r: 2, time: '08:10 PM', t1: 'Deep & Priyesh', t2: 'Ankit & Yule', rest: 'Shaan, Hemal' },
  { r: 3, time: '08:20 PM', t1: 'Deep & Hemal', t2: 'Shaan & Priyesh', rest: 'Ankit, Yule' },
  { r: 4, time: '08:30 PM', t1: 'Shaan & Ankit', t2: 'Hemal & Yule', rest: 'Deep, Priyesh' },
  { r: 5, time: '08:40 PM', t1: 'Deep & Ankit', t2: 'Priyesh & Yule', rest: 'Shaan, Hemal' },
  { r: 6, time: '08:50 PM', t1: 'Shaan & Yule', t2: 'Hemal & Ankit', rest: 'Deep, Priyesh' },
  { r: 7, time: '09:00 PM', t1: 'Nadeem & Anosh', t2: 'Amresh & Gopal', rest: 'Sumit, Karan' },
  { r: 8, time: '09:10 PM', t1: 'Nadeem & Sumit', t2: 'Anosh & Karan', rest: 'Amresh, Gopal' },
  { r: 9, time: '09:20 PM', t1: 'Nadeem & Amresh', t2: 'Anosh & Gopal', rest: 'Sumit, Karan' },
  { r: 10, time: '09:30 PM', t1: 'Sumit & Amresh', t2: 'Karan & Gopal', rest: 'Nadeem, Anosh' },
  { r: 11, time: '09:40 PM', t1: 'Nadeem & Karan', t2: 'Anosh & Sumit', rest: 'Amresh, Gopal' },
  { r: 12, time: '09:50 PM', t1: 'Sumit & Gopal', t2: 'Amresh & Karan', rest: 'Nadeem, Anosh' },
];

const imageCourt2 = [
  { r: 1, time: '08:00 PM', t1: 'Nadeem & Sid', t2: 'Gopal & Gulshan', rest: 'Anosh, Miten' },
  { r: 2, time: '08:10 PM', t1: 'Nadeem & Gopal', t2: 'Anosh & Miten', rest: 'Sid, Gulshan' },
  { r: 3, time: '08:20 PM', t1: 'Nadeem & Gulshan', t2: 'Sid & Gopal', rest: 'Anosh, Miten' },
  { r: 4, time: '08:30 PM', t1: 'Sid & Anosh', t2: 'Gulshan & Miten', rest: 'Nadeem, Gopal' },
  { r: 5, time: '08:40 PM', t1: 'Nadeem & Anosh', t2: 'Gopal & Miten', rest: 'Sid, Gulshan' },
  { r: 6, time: '08:50 PM', t1: 'Sid & Miten', t2: 'Gulshan & Anosh', rest: 'Nadeem, Gopal' },
  { r: 7, time: '09:00 PM', t1: 'Viki & Sid', t2: 'Miten & Priyesh', rest: 'Gulshan, Yule' },
  { r: 8, time: '09:10 PM', t1: 'Viki & Miten', t2: 'Gulshan & Yule', rest: 'Sid, Priyesh' },
  { r: 9, time: '09:20 PM', t1: 'Viki & Gulshan', t2: 'Sid & Priyesh', rest: 'Miten, Yule' },
  { r: 10, time: '09:30 PM', t1: 'Sid & Miten', t2: 'Yule & Priyesh', rest: 'Viki, Gulshan' },
  { r: 11, time: '09:40 PM', t1: 'Viki & Yule', t2: 'Sid & Gulshan', rest: 'Miten, Priyesh' },
  { r: 12, time: '09:50 PM', t1: 'Miten & Yule', t2: 'Gulshan & Priyesh', rest: 'Viki, Sid' },
];

const imageCourt3 = [
  { r: 1, time: '08:00 PM', t1: 'Viki & Sumit', t2: 'Amresh & PK', rest: 'Shrinath, Karan' },
  { r: 2, time: '08:10 PM', t1: 'Viki & Amresh', t2: 'Shrinath & Karan', rest: 'Sumit, PK' },
  { r: 3, time: '08:20 PM', t1: 'Viki & PK', t2: 'Sumit & Amresh', rest: 'Shrinath, Karan' },
  { r: 4, time: '08:30 PM', t1: 'Sumit & Shrinath', t2: 'PK & Karan', rest: 'Viki, Amresh' },
  { r: 5, time: '08:40 PM', t1: 'Viki & Shrinath', t2: 'Amresh & Karan', rest: 'Sumit, PK' },
  { r: 6, time: '08:50 PM', t1: 'Sumit & Karan', t2: 'PK & Shrinath', rest: 'Viki, Amresh' },
  { r: 7, time: '09:00 PM', t1: 'Deep & Shaan', t2: 'Ankit & PK', rest: 'Shrinath, Hemal' },
  { r: 8, time: '09:10 PM', t1: 'Deep & Ankit', t2: 'Shrinath & Hemal', rest: 'Shaan, PK' },
  { r: 9, time: '09:20 PM', t1: 'Deep & PK', t2: 'Shaan & Ankit', rest: 'Shrinath, Hemal' },
  { r: 10, time: '09:30 PM', t1: 'Shaan & Shrinath', t2: 'PK & Hemal', rest: 'Deep, Ankit' },
  { r: 11, time: '09:40 PM', t1: 'Deep & Shrinath', t2: 'Ankit & Hemal', rest: 'Shaan, PK' },
  { r: 12, time: '09:50 PM', t1: 'Shaan & Hemal', t2: 'PK & Shrinath', rest: 'Deep, Ankit' },
];

async function crossCheckImagesWithDb() {
  const clubId = 'fccd4a42-f3c7-4d93-9493-1e91828e66e2';
  const { data: stages } = await supabase.from('tournament_stages').select('*').eq('club_id', clubId);
  const stage = stages[0];
  const dbSchedule = stage.config.schedule;
  const dbRosters = stage.config.rosters;

  console.log('=== CROSS-CHECKING UPLOADED IMAGES AGAINST DATABASE SCHEDULE ===\n');

  let mismatches = 0;

  const compareCourt = (courtLabel, imageArray, courtKey) => {
    console.log(`--- CROSS CHECKING ${courtLabel} ---`);
    imageArray.forEach((imgRow, idx) => {
      const dbRow = dbSchedule[idx];
      const dbMatch = dbRow[courtKey];
      const dbT1 = dbMatch.team_1;
      const dbT2 = dbMatch.team_2;

      // Normalize string pairings for comparison
      const norm = s => s.split('&').map(x => x.trim()).sort().join(' & ');

      const imgPair1 = norm(imgRow.t1);
      const imgPair2 = norm(imgRow.t2);
      const dbPair1 = norm(dbT1);
      const dbPair2 = norm(dbT2);

      const matchOk = (imgPair1 === dbPair1 && imgPair2 === dbPair2) || (imgPair1 === dbPair2 && imgPair2 === dbPair1);

      if (!matchOk) {
        mismatches++;
        console.log(`❌ R${idx+1} Mismatch:`);
        console.log(`   IMAGE: ${imgRow.t1} vs ${imgRow.t2}`);
        console.log(`   DB:    ${dbT1} vs ${dbT2}`);
      } else {
        console.log(`✅ R${idx+1} MATCH: ${imgRow.t1} vs ${imgRow.t2} (Rest: ${imgRow.rest})`);
      }
    });
    console.log('');
  };

  compareCourt('COURT 1', imageCourt1, 'court_1');
  compareCourt('COURT 2', imageCourt2, 'court_2');
  compareCourt('COURT 3', imageCourt3, 'court_3');

  console.log('====================================');
  console.log('TOTAL MISMATCHES FOUND:', mismatches);
  console.log('CROSS-CHECK STATUS:', mismatches === 0 ? '100% PERFECT MATCH! ALL IMAGES ALIGN WITH DATABASE ✅' : 'MISMATCHES FOUND ❌');
  console.log('====================================');

  if (mismatches > 0) {
    console.log('\nSyncing database to match the exact image schedule...');
    // Sync database schedule to match the exact image fixtures
    const newDbSchedule = dbSchedule.map((r, idx) => {
      return {
        ...r,
        court_1: { team_1: imageCourt1[idx].t1, team_2: imageCourt1[idx].t2 },
        court_2: { team_1: imageCourt2[idx].t1, team_2: imageCourt2[idx].t2 },
        court_3: { team_1: imageCourt3[idx].t1, team_2: imageCourt3[idx].t2 }
      };
    });

    await supabase
      .from('tournament_stages')
      .update({ config: { schedule: newDbSchedule, rosters: dbRosters } })
      .eq('club_id', clubId);

    console.log('Database synced to exact image schedule!');
  }
}

crossCheckImagesWithDb().catch(console.error);
