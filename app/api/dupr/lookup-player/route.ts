import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || '';

    if (!name) {
      return NextResponse.json({ error: 'Name parameter is required' }, { status: 400 });
    }

    // Mock/Live DUPR Profile Search
    const mockDuprId = `D${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const mockRating = parseFloat((3.2 + Math.random() * 1.5).toFixed(2));

    return NextResponse.json({
      success: true,
      profile: {
        name,
        duprId: mockDuprId,
        rating: mockRating,
        verified: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to lookup DUPR profile' }, { status: 500 });
  }
}
