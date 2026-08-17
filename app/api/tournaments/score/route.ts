import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ltbnjtgzpwxulbczmzdr.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Ym5qdGd6cHd4dWxiY3ptemRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjkxOTY5NiwiZXhwIjoyMDk4NDk1Njk2fQ.diLng4z6awlkwTp4_IIAhJv4_Gzke5U0q2EGpDspdzQ';

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export async function POST(req: Request) {
  try {
    const { sessionId, roundNumber, court, teamA, teamB, scoreA, scoreB } = await req.json();

    const targetSessionId = sessionId || 'mw_mavericks_season_2_2026';

    if (roundNumber === undefined || court === undefined) {
      return NextResponse.json({ error: 'Missing required match score fields.' }, { status: 400 });
    }

    const teamANames = Array.isArray(teamA) ? teamA : [String(teamA || 'Team A')];
    const teamBNames = Array.isArray(teamB) ? teamB : [String(teamB || 'Team B')];

    // 1. Ensure target session row exists in sessions table
    await supabaseAdmin.from('sessions').upsert({
      id: targetSessionId,
      club_id: 'mw_club_monday_wednesday',
      format: 'team_championship',
      players: [],
      round_count: 28
    }, { onConflict: 'id' });

    // 2. Direct Supabase DB upsert for exact session_id, round_number, court
    const { data, error } = await supabaseAdmin
      .from('rounds')
      .upsert({
        session_id: targetSessionId,
        round_number: roundNumber,
        court,
        team_a: teamANames,
        team_b: teamBNames,
        sitting_out: [],
        score_a: scoreA,
        score_b: scoreB
      }, { onConflict: 'session_id,round_number,court' })
      .select();

    if (error) {
      console.error('API Tournament Score Save Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('API Tournament Score Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save tournament score' }, { status: 500 });
  }
}
