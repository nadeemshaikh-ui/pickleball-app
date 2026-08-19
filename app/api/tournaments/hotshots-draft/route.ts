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
  const role = searchParams.get('role');
  const captainIdx = parseInt(searchParams.get('captain') || '-1', 10);
  
  if (!hotshotsStateCache.has(clubId)) {
    hotshotsStateCache.set(clubId, getDefaultState());
  }
  
  const state = hotshotsStateCache.get(clubId);
  const sanitizedState = JSON.parse(JSON.stringify(state));
  
  // Prevent Network Tab Snooping
  if (sanitizedState.powerupPile) {
    sanitizedState.powerupPile = sanitizedState.powerupPile.map((card: any) => {
      // Hide type unless you are the admin, or you are the captain who claimed it
      const isAdmin = role !== 'viewer' && captainIdx === -1;
      const isOwner = card.claimedByTeamIndex === captainIdx;
      if (!isAdmin && !isOwner) {
        return { ...card, type: 'Hidden' };
      }
      return card;
    });
  }
  
  return NextResponse.json(sanitizedState);
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId') || 'default_club';
    const body = await request.json();
    
    const currentState = hotshotsStateCache.get(clubId) || getDefaultState();
    let updatedState = { ...currentState };
    
    if (body.action === 'UPDATE_PICK') {
      updatedState.roundPicks = [...updatedState.roundPicks];
      updatedState.picksSaved = [...updatedState.picksSaved];
      updatedState.roundPicks[body.teamIdx] = body.val;
      updatedState.picksSaved[body.teamIdx] = body.saved;
    } else if (body.action === 'JOKER_DRAFT') {
      updatedState.roundPicks = [...updatedState.roundPicks];
      updatedState.picksSaved = [...updatedState.picksSaved];
      updatedState.cards = [...updatedState.cards];
      
      const unrevealedIdx = updatedState.cards.findIndex((c: any) => !c.revealed);
      if (unrevealedIdx !== -1) {
        updatedState.cards[unrevealedIdx] = {
          ...updatedState.cards[unrevealedIdx],
          revealed: true,
          player: body.player,
          grade: body.grade,
          teamIndex: body.teamIdx
        };
      }
      updatedState.roundPicks[body.teamIdx] = 'Joker';
      updatedState.picksSaved[body.teamIdx] = true;
    } else if (body.action === 'BLOCK_TEAM') {
      updatedState.blockedTeamsThisRound = [...updatedState.blockedTeamsThisRound];
      updatedState.blockedTeamsThisRound[body.targetIdx] = true;
    } else if (body.action === 'CLAIM_POWERUP') {
      updatedState.powerupPile = [...updatedState.powerupPile];
      if (updatedState.powerupPile[body.slotIdx].claimedByTeamIndex === null) {
        updatedState.powerupPile[body.slotIdx].claimedByTeamIndex = body.teamIdx;
      } else {
        throw new Error('Card already claimed');
      }
    } else if (body.action === 'USE_POWERUP') {
      updatedState.powerupPile = [...updatedState.powerupPile];
      const claimedIdx = updatedState.powerupPile.findIndex((c: any) => c.claimedByTeamIndex === body.teamIdx);
      if (claimedIdx !== -1) {
         updatedState.powerupPile[claimedIdx].claimedByTeamIndex = -99;
      }
    } else {
      updatedState = { ...updatedState, ...body };
    }
    
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
