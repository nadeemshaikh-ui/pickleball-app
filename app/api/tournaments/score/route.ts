import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ltbnjtgzpwxulbczmzdr.supabase.co';
export async function POST(req: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: 'Server configuration error: missing service key.' }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { sessionId, roundNumber, court, teamA, teamB, scoreA, scoreB } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    const targetSessionId = sessionId;

    if (roundNumber === undefined || court === undefined) {
      return NextResponse.json({ error: 'Missing required match score fields.' }, { status: 400 });
    }

    const teamANames = Array.isArray(teamA) ? teamA : [String(teamA || 'Team A')];
    const teamBNames = Array.isArray(teamB) ? teamB : [String(teamB || 'Team B')];

    // 1. Ensure target session row exists non-destructively
    const { data: existingSession } = await supabaseAdmin
      .from('sessions')
      .select('id, club_id')
      .eq('id', targetSessionId)
      .single();

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found. Create the session first.' }, { status: 404 });
    }

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
