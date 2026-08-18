import { NextRequest, NextResponse } from 'next/server';

// In-memory cache map partitioned strictly by clubId
const hotshotsStateCache = new Map<string, any>();

function getDefaultState() {
  return {
    powerupsSelectionLive: false,
    step: 1,
    draftStarted: false,
    cards: Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      revealed: false,
      player: null,
      grade: null,
      teamIndex: null,
      shielded: false
    })),
    roundPicks: ['', '', '', ''],
    picksSaved: [false, false, false, false],
    powerupPile: (() => {
      const types = ['Steal', 'Shield', 'Spyglass', 'DeckSwap', 'Block', 'Joker'];
      // Perform a proper Durstenfeld shuffle on the card types array
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }
      return Array.from({ length: 6 }, (_, i) => ({
        slotIndex: i,
        type: types[i],
        claimedByTeamIndex: null
      }));
    })(),
    blockedTeamsThisRound: [false, false, false, false],
    chatLog: [
      { sender: 'System', text: 'Welcome to the Hotshots Live Draft chat channel!', time: '12:00 PM' }
    ]
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId') || 'default_club';
  
  if (!hotshotsStateCache.has(clubId)) {
    hotshotsStateCache.set(clubId, getDefaultState());
  }
  
  return NextResponse.json(hotshotsStateCache.get(clubId));
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId') || 'default_club';
    const body = await request.json();
    
    const currentState = hotshotsStateCache.get(clubId) || getDefaultState();
    const updatedState = {
      ...currentState,
      ...body
    };
    
    hotshotsStateCache.set(clubId, updatedState);
    return NextResponse.json({ success: true, state: updatedState });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get('clubId') || 'default_club';
  
  hotshotsStateCache.set(clubId, getDefaultState());
  return NextResponse.json({ success: true, message: 'Server draft state reset successfully for this club.' });
}
