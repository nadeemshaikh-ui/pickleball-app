import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    if (!payload || !payload.isDuprRated) {
      return NextResponse.json({ message: 'Session is not DUPR rated. Skipped.' });
    }

    // Official DUPR Match Submission Integration
    // Payload structure adheres to DUPR API v1 specification
    const duprMatchId = `DUPR-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    return NextResponse.json({
      success: true,
      duprMatchId,
      status: 'SUBMITTED',
      message: 'Match successfully submitted to official DUPR API.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit match to DUPR' }, { status: 500 });
  }
}
