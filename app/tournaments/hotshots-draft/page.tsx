'use client';

import React, { useState, useEffect } from 'react';

interface PlayerInfo {
  name: string;
  grade: 'A' | 'B' | 'C';
  logoUrl: string;
}

type PowerupType = 'Steal' | 'Shield' | 'Spyglass' | 'DeckSwap' | 'Block' | 'Joker' | '';

interface CardState {
  number: number;
  revealed: boolean;
  player: string | null;
  grade: 'A' | 'B' | 'C' | null;
  teamIndex: number | null;
  shielded: boolean;
}

interface PowerupPileCard {
  slotIndex: number;
  type: PowerupType;
  claimedByTeamIndex: number | null; // null if unclaimed
}

export default function HotshotsDraftAdmin() {
  const [mounted, setMounted] = useState(false);

  // Core Draft States
  const [allPlayers, setAllPlayers] = useState<PlayerInfo[]>([]);
  const [captainNames, setCaptainNames] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [teamLogos, setTeamLogos] = useState<string[]>([]);
  const [step, setStep] = useState(1); // 1: Setup, 2: Logos, 3: Powerup FCFS Pile, 4: Draft Board
  const [draftStarted, setDraftStarted] = useState(false);
  const [cards, setCards] = useState<CardState[]>([]);
  const [roundPicks, setRoundPicks] = useState<string[]>([]);
  const [picksSaved, setPicksSaved] = useState<boolean[]>([]);

  // Secret Powerup Pile States (FCFS)
  const [powerupPile, setPowerupPile] = useState<PowerupPileCard[]>([]);
  const [blockedTeamsThisRound, setBlockedTeamsThisRound] = useState<boolean[]>([]);
  const [activeCaptainSessionIdx, setActiveCaptainSessionIdx] = useState<number | null>(null); // Null = Admin, 0-3 = Captains
  
  // Phone Number simulated login states
  const [registeredPhones, setRegisteredPhones] = useState<string[]>(['9876543210', '9876543211', '9876543212', '9876543213']);
  const [loginPhoneInput, setLoginPhoneInput] = useState('');
  const [loggedInCaptainName, setLoggedInCaptainName] = useState<string | null>(null);

  // Pre-Round 10-Second Countdown States
  const [preRoundActive, setPreRoundActive] = useState(false);
  const [preRoundTimer, setPreRoundTimer] = useState(10);
  const [preRoundTimerInterval, setPreRoundTimerInterval] = useState<any>(null);

  // Powerups Interaction States
  const [spyglassResult, setSpyglassResult] = useState<{ cardNumber: number; playerName: string; logoUrl: string } | null>(null);
  const [jokerOptions, setJokerOptions] = useState<PlayerInfo[]>([]);
  const [jokerActiveTeamIndex, setJokerActiveTeamIndex] = useState<number | null>(null);

  // Animation Queues & Dramatic States
  const [activeRevealingCard, setActiveRevealingCard] = useState<number | null>(null);
  const [revealingTeamIndex, setRevealingTeamIndex] = useState<number | null>(null);
  const [revealPhase, setRevealPhase] = useState<'card-focus' | 'card-spin' | 'player-name' | 'reaction-window' | 'powerup-trigger' | 'shuffling-deck' | 'inactive'>('inactive');
  const [revealedPlayerText, setRevealedPlayerText] = useState('');
  const [reactionTimer, setReactionTimer] = useState(0);
  const [activeReactionTimerInterval, setActiveReactionTimerInterval] = useState<any>(null);
  const [powerupAnimationText, setPowerupAnimationText] = useState('');
  const [animatingPowerupTeamIdx, setAnimatingPowerupTeamIdx] = useState<number | null>(null);
  const [animatingPowerupName, setAnimatingPowerupName] = useState('');
  const [skipTimerTriggered, setSkipTimerTriggered] = useState(false);

  // General Notification Toast
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // In-App Chat Log States
  const [chatLog, setChatLog] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'System', text: 'Welcome to the Hotshots Live Draft chat channel!', time: '12:00 PM' }
  ]);
  const [chatInputVal, setChatInputVal] = useState('');

  useEffect(() => {
    const defaultPlayers: PlayerInfo[] = [
      { name: 'Gopal', grade: 'A', logoUrl: 'https://i.ibb.co/hCmt21t/gopal-meme.jpg' },
      { name: 'Karan', grade: 'A', logoUrl: 'https://i.ibb.co/L5Z5vQf/hotshots-logo.jpg' },
      { name: 'Sumit', grade: 'A', logoUrl: '/Hotsht profile pics/Sumit.jpeg' },
      { name: 'Amresh', grade: 'A', logoUrl: 'https://i.ibb.co/tbgZpqV/rakhi-sawant.jpg' },
      { name: 'Hemal', grade: 'B', logoUrl: '/Hotsht profile pics/Hemal.jpeg' },
      { name: 'Miten', grade: 'B', logoUrl: '/Hotsht profile pics/Miten.jpeg' },
      { name: 'Ankit', grade: 'B', logoUrl: 'https://i.ibb.co/FwsHn7N/funny-face.jpg' },
      { name: 'Sid G', grade: 'B', logoUrl: '/Hotsht profile pics/Sid G.jpeg' },
      { name: 'Sid K', grade: 'B', logoUrl: 'https://i.ibb.co/mhp3TjG/embarrassing-face.jpg' },
      { name: 'Arif', grade: 'B', logoUrl: 'https://i.ibb.co/mJk3pXG/screaming-cat.jpg' },
      { name: 'Ansh', grade: 'B', logoUrl: 'https://i.ibb.co/N1pZ73p/monkey-laugh.jpg' },
      { name: 'Deep', grade: 'B', logoUrl: '/Hotsht profile pics/Deep.jpeg' },
      { name: 'Nadeem', grade: 'C', logoUrl: '/Hotsht profile pics/Nadeem.jpeg' },
      { name: 'Gulshan', grade: 'C', logoUrl: 'https://i.ibb.co/tbgZpqV/rakhi-sawant.jpg' },
      { name: 'Shah', grade: 'C', logoUrl: 'https://i.ibb.co/hCmt21t/gopal-meme.jpg' },
      { name: 'Viki', grade: 'C', logoUrl: '/Hotsht profile pics/Viki .jpeg' }
    ];
    // Force reset default players list to apply local images path
    localStorage.removeItem('hotshots_all_players_v4');
    setAllPlayers(defaultPlayers);

    const savedCaptains = localStorage.getItem('hotshots_captain_names');
    setCaptainNames(savedCaptains ? JSON.parse(savedCaptains) : ['Sumit', 'Ankit', 'Miten', 'Deep']);

    const defaultTeamNames = [
      'Samosa Smashers',     // Sumit
      'Papad Punishers',      // Ankit
      'Dhokla Destroyers',    // Miten
      'Cheese Naan Warriors'  // Deep
    ];
    const defaultLogos = [
      '/Hotsht profile pics/Samosa Smashers Sumit.jpeg',
      '/Hotsht profile pics/papad_punishers_logo_1786964324414.jpg', // Ankit
      '/Hotsht profile pics/Dhokla Destroyers Deep.jpeg', // Miten (using Dhokla logo from directory)
      '/Hotsht profile pics/cheese_naan_logo_1786964038239.jpg'
    ];

    const savedNamesVal = localStorage.getItem('hotshots_team_names');
    const savedLogosVal = localStorage.getItem('hotshots_team_logos');

    setTeamNames(savedNamesVal ? JSON.parse(savedNamesVal) : defaultTeamNames);
    setTeamLogos(savedLogosVal ? JSON.parse(savedLogosVal) : defaultLogos);

    const savedStep = localStorage.getItem('hotshots_step');
    setStep(savedStep ? parseInt(savedStep, 10) : 1);

    const savedDraftStarted = localStorage.getItem('hotshots_draft_started');
    setDraftStarted(savedDraftStarted === 'true');

    const savedCards = localStorage.getItem('hotshots_cards_v4');
    const defaultCards: CardState[] = Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      revealed: false,
      player: null,
      grade: null,
      teamIndex: null,
      shielded: false
    }));
    setCards(savedCards ? JSON.parse(savedCards) : defaultCards);

    const savedRoundPicks = localStorage.getItem('hotshots_round_picks');
    setRoundPicks(savedRoundPicks ? JSON.parse(savedRoundPicks) : ['', '', '', '']);

    const savedPicksSaved = localStorage.getItem('hotshots_picks_saved');
    setPicksSaved(savedPicksSaved ? JSON.parse(savedPicksSaved) : [false, false, false, false]);

    const savedPile = localStorage.getItem('hotshots_powerup_pile_v2');
    const defaultTypes: PowerupType[] = ['Steal', 'Shield', 'Spyglass', 'DeckSwap', 'Block', 'Joker'];
    const shuffledTypes = defaultTypes.sort(() => Math.random() - 0.5);
    const defaultPile: PowerupPileCard[] = Array.from({ length: 6 }, (_, i) => ({
      slotIndex: i,
      type: shuffledTypes[i],
      claimedByTeamIndex: null
    }));
    setPowerupPile(savedPile ? JSON.parse(savedPile) : defaultPile);

    // Parse URL search parameters for dedicated links (e.g. ?captain=0/1/2/3 or ?role=viewer)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const capQuery = params.get('captain');
      const roleQuery = params.get('role');
      if (capQuery !== null) {
        const idx = parseInt(capQuery, 10);
        if (idx >= 0 && idx < 4) {
          setActiveCaptainSessionIdx(idx);
          setLoggedInCaptainName(captainNames[idx] || ['Sumit', 'Ankit', 'Miten', 'Deep'][idx]);
          
          // Check if this captain has already selected their powerup card
          const pile = savedPile ? JSON.parse(savedPile) : defaultPile;
          const alreadyClaimed = pile.some((c: any) => c.claimedByTeamIndex === idx);
          
          if (!alreadyClaimed) {
            setStep(3); // Direct to step 3 (powerup pile selection) first
            setDraftStarted(false);
          } else {
            setStep(4);
            setDraftStarted(true);
          }
        }
      } else if (roleQuery === 'viewer') {
        setActiveCaptainSessionIdx(-99); // -99 represents viewer mode
        setLoggedInCaptainName('Viewer');
      }
    }

    setMounted(true);
  }, []);

  // Synchronizers
  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_all_players_v4', JSON.stringify(allPlayers));
  }, [allPlayers, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_captain_names', JSON.stringify(captainNames));
  }, [captainNames, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_team_names', JSON.stringify(teamNames));
  }, [teamNames, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_team_logos', JSON.stringify(teamLogos));
  }, [teamLogos, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_step', step.toString());
  }, [step, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_draft_started', draftStarted.toString());
  }, [draftStarted, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_cards_v4', JSON.stringify(cards));
  }, [cards, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_round_picks', JSON.stringify(roundPicks));
  }, [roundPicks, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_picks_saved', JSON.stringify(picksSaved));
  }, [picksSaved, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem('hotshots_powerup_pile_v2', JSON.stringify(powerupPile));
  }, [powerupPile, mounted]);

  const showFeedback = (text: string, type: 'error' | 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleLogoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const updated = [...teamLogos];
      updated[index] = url;
      setTeamLogos(updated);
    }
  };

  const handlePlayerPicUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const updated = [...allPlayers];
      updated[index].logoUrl = url;
      setAllPlayers(updated);
    }
  };

  const getDraftablePool = (tempCardsState = cards): PlayerInfo[] => {
    return allPlayers.filter(
      p => !captainNames.some(capName => capName.trim().toLowerCase() === p.name.trim().toLowerCase()) &&
           !tempCardsState.some(c => c.revealed && c.player === p.name)
    );
  };

  const drawCardSilently = (teamIdx: number, tempCardsState = cards): PlayerInfo => {
    const captainName = captainNames[teamIdx];
    const captainPlayer = allPlayers.find(p => p.name.trim().toLowerCase() === captainName.trim().toLowerCase());
    const captainGrade = captainPlayer?.grade || 'C';

    const teamPicks = tempCardsState.filter(c => c.teamIndex === teamIdx && c.revealed);
    const countA = teamPicks.filter(p => p.grade === 'A').length;
    const countB = teamPicks.filter(p => p.grade === 'B').length;
    const countC = teamPicks.filter(p => p.grade === 'C').length;

    const draftableRemaining = getDraftablePool(tempCardsState);

    let allowedGrades: Array<'A' | 'B' | 'C'> = [];
    if (captainGrade === 'A') {
      if (countB < 2 && countC < 1) allowedGrades = ['B', 'C'];
      else if (countB >= 2) allowedGrades = ['C'];
      else if (countC >= 1) allowedGrades = ['B'];
    } else if (captainGrade === 'B') {
      const needsA = countA < 1;
      const needsB = countB < 1;
      const needsC = countC < 1;

      if (needsA) allowedGrades.push('A');
      if (needsB) allowedGrades.push('B');
      if (needsC) allowedGrades.push('C');
    } else {
      const needsA = countA < 1;
      const needsB = countB < 2;

      if (needsA) allowedGrades.push('A');
      if (needsB) allowedGrades.push('B');
    }

    if (allowedGrades.length === 0) allowedGrades = ['A', 'B', 'C'];

    const eligiblePlayers = draftableRemaining.filter(p => allowedGrades.includes(p.grade));
    const targetPool = eligiblePlayers.length > 0 ? eligiblePlayers : draftableRemaining;
    return targetPool[Math.floor(Math.random() * targetPool.length)];
  };

  const handleCardClickFailsafe = (cardIdx: number) => {
    showFeedback(`Direct grid selection is disabled. Save the captain's entry box selection below.`, 'error');
  };

  // FCFS Secret Selection Click Handler
  const handleSelectFaceDownPowerup = (teamIdx: number, slotIdx: number) => {
    const alreadyHas = powerupPile.some(c => c.claimedByTeamIndex === teamIdx);
    if (alreadyHas) {
      showFeedback('You have already claimed a powerup card!', 'error');
      return;
    }

    if (powerupPile[slotIdx].claimedByTeamIndex !== null) {
      showFeedback('This card has already been claimed by another captain!', 'error');
      return;
    }

    const updatedPile = [...powerupPile];
    updatedPile[slotIdx].claimedByTeamIndex = teamIdx;
    setPowerupPile(updatedPile);
    showFeedback(`Card claimed secretly! Redirecting to draft board...`, 'success');
    
    // Auto redirect to Step 4
    setTimeout(() => {
      setStep(4);
      setDraftStarted(true);
    }, 1500);
  };

  // Trigger Play Reveal with Fullscreen Hype Animation
  const triggerPlayedRevealAnimation = (teamIdx: number, powerupName: string, extraDetails: string) => {
    setAnimatingPowerupTeamIdx(teamIdx);
    setAnimatingPowerupName(powerupName);
    setPowerupAnimationText(extraDetails);
    setRevealPhase('powerup-trigger');

    setTimeout(() => {
      setRevealPhase('inactive');
      setAnimatingPowerupTeamIdx(null);
      setAnimatingPowerupName('');
      setPowerupAnimationText('');
    }, 4500);
  };

  // PRE-ROUND 10s COUNTDOWN
  const startPreRoundPhase = () => {
    setPreRoundActive(true);
    setPreRoundTimer(10);
    
    const interval = setInterval(() => {
      setPreRoundTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setPreRoundActive(false);
          showFeedback('Pre-round time finished! Enter chosen card numbers below.', 'success');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setPreRoundTimerInterval(interval);
  };

  // Powerups Actions
  const handleUseSpyglass = (teamIdx: number) => {
    const unrevealedCards = cards.filter(c => !c.revealed);
    if (unrevealedCards.length <= 1) {
      showFeedback('Spyglass cannot be used when only one card remains.', 'error');
      return;
    }

    const randomCard = unrevealedCards[Math.floor(Math.random() * unrevealedCards.length)];
    const chosenPlayer = drawCardSilently(teamIdx);

    setSpyglassResult({
      cardNumber: randomCard.number,
      playerName: chosenPlayer.name,
      logoUrl: chosenPlayer.logoUrl
    });

    const updatedPile = [...powerupPile];
    const claimedIdx = updatedPile.findIndex(c => c.claimedByTeamIndex === teamIdx);
    if (claimedIdx !== -1) {
      updatedPile[claimedIdx].claimedByTeamIndex = -99; // mark used
    }
    setPowerupPile(updatedPile);

    triggerPlayedRevealAnimation(teamIdx, 'Spyglass', 'Peeking at a face-down card number to gain drafting foresight!');
  };

  const handleConfirmSpyglassDraft = (teamIdx: number, cardNumber: number, playerName: string) => {
    const cardIdx = cardNumber - 1;
    const playerItem = allPlayers.find(p => p.name === playerName);
    const updatedCards = [...cards];
    updatedCards[cardIdx] = {
      number: cardNumber,
      revealed: true,
      player: playerName,
      grade: playerItem?.grade || 'C',
      teamIndex: teamIdx,
      shielded: false
    };

    setCards(updatedCards);
    setSpyglassResult(null);
    showFeedback(`Successfully drafted ${playerName} from Spyglass!`, 'success');
  };

  const handleUseJoker = (teamIdx: number) => {
    const captainName = captainNames[teamIdx];
    const captainPlayer = allPlayers.find(p => p.name.trim().toLowerCase() === captainName.trim().toLowerCase());
    const captainGrade = captainPlayer?.grade || 'C';

    const teamPicks = cards.filter(c => c.teamIndex === teamIdx && c.revealed);
    const countA = teamPicks.filter(p => p.grade === 'A').length;
    const countB = teamPicks.filter(p => p.grade === 'B').length;
    const countC = teamPicks.filter(p => p.grade === 'C').length;

    let targetGrade: 'A' | 'B' | 'C' = 'C';
    if (captainGrade === 'A') {
      targetGrade = countB < 2 ? 'B' : 'C';
    } else if (captainGrade === 'B') {
      if (countA < 1) targetGrade = 'A';
      else if (countB < 1) targetGrade = 'B';
      else targetGrade = 'C';
    } else {
      targetGrade = countA < 1 ? 'A' : 'B';
    }

    const matchingPool = getDraftablePool().filter(p => p.grade === targetGrade);
    
    const finalOptions = [...matchingPool];
    while (finalOptions.length < 3) {
      finalOptions.push({ name: `Mystery Player ${finalOptions.length + 1}`, grade: targetGrade, logoUrl: '' });
    }

    setJokerOptions(finalOptions.slice(0, 3));
    setJokerActiveTeamIndex(teamIdx);

    const updatedPile = [...powerupPile];
    const claimedIdx = updatedPile.findIndex(c => c.claimedByTeamIndex === teamIdx);
    if (claimedIdx !== -1) {
      updatedPile[claimedIdx].claimedByTeamIndex = -99;
    }
    setPowerupPile(updatedPile);

    triggerPlayedRevealAnimation(teamIdx, 'The Joker', 'Summoned a Joker wildcard list to choose an exact grade player!');
  };

  const handleConfirmJokerDraft = (teamIdx: number, player: PlayerInfo) => {
    const unrevealedIdx = cards.findIndex(c => !c.revealed);
    if (unrevealedIdx === -1) return;

    const updatedCards = [...cards];
    updatedCards[unrevealedIdx] = {
      ...updatedCards[unrevealedIdx],
      revealed: true,
      player: player.name,
      grade: player.grade,
      teamIndex: teamIdx
    };

    setCards(updatedCards);
    setJokerOptions([]);
    setJokerActiveTeamIndex(null);

    // Bypass number entry requirements for this round
    const updatedRoundPicks = [...roundPicks];
    updatedRoundPicks[teamIdx] = 'Joker';
    setRoundPicks(updatedRoundPicks);

    const updatedSaved = [...picksSaved];
    updatedSaved[teamIdx] = true;
    setPicksSaved(updatedSaved);

    showFeedback(`Joker used to recruit ${player.name}!`, 'success');
  };

  const handleToggleShield = (teamIdx: number, cardIdx: number) => {
    const updatedCards = [...cards];
    updatedCards[cardIdx].shielded = true;
    setCards(updatedCards);

    const updatedPile = [...powerupPile];
    const claimedIdx = updatedPile.findIndex(c => c.claimedByTeamIndex === teamIdx);
    if (claimedIdx !== -1) {
      updatedPile[claimedIdx].claimedByTeamIndex = -99;
    }
    setPowerupPile(updatedPile);

    triggerPlayedRevealAnimation(teamIdx, 'Secret Shield', `Placed an invisible forcefield on ${cards[cardIdx].player}!`);
  };

  const handleUseBlock = (teamIdx: number, targetIdx: number) => {
    const updatedBlocks = [...blockedTeamsThisRound];
    updatedBlocks[targetIdx] = true;
    setBlockedTeamsThisRound(updatedBlocks);

    const updatedPile = [...powerupPile];
    const claimedIdx = updatedPile.findIndex(c => c.claimedByTeamIndex === teamIdx);
    if (claimedIdx !== -1) {
      updatedPile[claimedIdx].claimedByTeamIndex = -99;
    }
    setPowerupPile(updatedPile);

    triggerPlayedRevealAnimation(teamIdx, 'The Block', `Blocked ${teamNames[targetIdx] || 'opponent'} from picking first next round!`);
  };

  const handleUseSteal = (teamIdx: number, targetCardIdx: number) => {
    const stolenCard = cards[targetCardIdx];
    if (!stolenCard.player || stolenCard.teamIndex === null) return;

    const victimIdx = stolenCard.teamIndex;

    // Check if the victim team has multiple revealed players. If so, choose the targeted one.
    const updatedPile = [...powerupPile];
    const claimedIdx = updatedPile.findIndex(c => c.claimedByTeamIndex === teamIdx);
    if (claimedIdx !== -1) {
      updatedPile[claimedIdx].claimedByTeamIndex = -99;
    }
    setPowerupPile(updatedPile);

    if (stolenCard.shielded) {
      const updatedCards = [...cards];
      updatedCards[targetCardIdx].shielded = false;
      setCards(updatedCards);

      triggerPlayedRevealAnimation(teamIdx, 'Steal Blocked', `Attempted to steal ${stolenCard.player}, but hit a SECRET SHIELD! The shield is consumed and the steal failed.`);
      return;
    }

    const stolenPlayerName = stolenCard.player;

    const updatedCards = [...cards];
    updatedCards[targetCardIdx] = {
      ...stolenCard,
      teamIndex: teamIdx
    };

    const replacementPlayer = drawCardSilently(victimIdx, updatedCards);
    const unrevealedIdx = updatedCards.findIndex(c => !c.revealed);
    if (unrevealedIdx !== -1) {
      updatedCards[unrevealedIdx] = {
        ...updatedCards[unrevealedIdx],
        revealed: true,
        player: replacementPlayer.name,
        grade: replacementPlayer.grade,
        teamIndex: victimIdx,
        shielded: false
      };
    }

    setCards(updatedCards);
    triggerPlayedRevealAnimation(teamIdx, 'The Steal', `Hijacked ${stolenPlayerName} from ${teamNames[victimIdx]}!`);
  };

  // Deck Swap Action (Reroll with visual deck recycle and shuffle protection)
  const handleUseDeckSwap = async (teamIdx: number, cardIdx: number) => {
    const originalPlayer = cards[cardIdx].player;
    if (!originalPlayer) return;

    // Trigger Deck Recycle phase
    setRevealPhase('shuffling-deck');
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    await delay(3000); // 3 seconds shuffling animation

    // Draw the replacement
    const replacementPlayer = drawCardSilently(teamIdx);
    
    const updatedCards = [...cards];
    updatedCards[cardIdx] = {
      ...updatedCards[cardIdx],
      player: replacementPlayer.name,
      grade: replacementPlayer.grade
    };

    setCards(updatedCards);

    const updatedPile = [...powerupPile];
    const claimedIdx = updatedPile.findIndex(c => c.claimedByTeamIndex === teamIdx);
    if (claimedIdx !== -1) {
      updatedPile[claimedIdx].claimedByTeamIndex = -99;
    }
    setPowerupPile(updatedPile);

    triggerPlayedRevealAnimation(teamIdx, 'Deck Swap', `Deck shuffled! Drew replacement member: ${replacementPlayer.name}!`);
  };

  // Sequential Reveal Pipeline
  const executeSequentialReveal = async () => {
    const activeRoundIndices = [0, 1, 2, 3].filter(idx => picksSaved[idx]);
    
    if (activeRoundIndices.length === 0) {
      showFeedback('No card numbers have been saved yet!', 'error');
      return;
    }

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let tempCardsState = [...cards];

    for (const teamIdx of activeRoundIndices) {
      // If they used the Joker, they skipped standard card selection
      if (roundPicks[teamIdx] === 'Joker') {
        // Clear round placeholders
        setRoundPicks(prev => {
          const updated = [...prev];
          updated[teamIdx] = '';
          return updated;
        });
        setPicksSaved(prev => {
          const updated = [...prev];
          updated[teamIdx] = false;
          return updated;
        });
        continue;
      }

      if (blockedTeamsThisRound[teamIdx]) {
        showFeedback(`${teamNames[teamIdx]} is blocked this round and will be revealed last!`, 'success');
        continue;
      }

      const num = parseInt(roundPicks[teamIdx], 10);
      const cardIdx = num - 1;
      const chosenPlayer = drawCardSilently(teamIdx, tempCardsState);

      tempCardsState[cardIdx] = {
        ...tempCardsState[cardIdx],
        revealed: true,
        player: chosenPlayer.name,
        grade: chosenPlayer.grade,
        teamIndex: teamIdx,
        shielded: false
      };

      setActiveRevealingCard(cardIdx);
      setRevealingTeamIndex(teamIdx);
      setRevealPhase('card-focus');
      await delay(1000); // Stay still for 1 second

      setRevealPhase('card-spin');
      await delay(1800);

      setRevealedPlayerText(chosenPlayer.name);
      setRevealPhase('player-name');
      await delay(2500);

      setCards([...tempCardsState]);
      localStorage.setItem('hotshots_cards_v4', JSON.stringify(tempCardsState));

      // 15-Second Reaction countdown
      setRevealPhase('reaction-window');
      setReactionTimer(15);

      let count = 15;
      const interval = setInterval(() => {
        count--;
        setReactionTimer(count);
        if (count <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      setActiveReactionTimerInterval(interval);
      
      // Wait dynamic check loop listening to manual skips
      for (let i = 0; i < 60; i++) {
        await delay(250);
        // Access global state via window or custom hook
        const isBypassed = (window as any)._skipActiveTimer;
        if (isBypassed) {
          (window as any)._skipActiveTimer = false;
          break;
        }
      }
      clearInterval(interval);

      setRevealPhase('inactive');
      setActiveRevealingCard(null);
      setRevealingTeamIndex(null);
      setRevealedPlayerText('');

      setRoundPicks(prev => {
        const updated = [...prev];
        updated[teamIdx] = '';
        localStorage.setItem('hotshots_round_picks', JSON.stringify(updated));
        return updated;
      });

      setPicksSaved(prev => {
        const updated = [...prev];
        updated[teamIdx] = false;
        localStorage.setItem('hotshots_picks_saved', JSON.stringify(updated));
        return updated;
      });

      await delay(1500);
    }

    for (const teamIdx of activeRoundIndices) {
      if (blockedTeamsThisRound[teamIdx] && roundPicks[teamIdx] !== 'Joker') {
        const num = parseInt(roundPicks[teamIdx], 10);
        const cardIdx = num - 1;
        const chosenPlayer = drawCardSilently(teamIdx, tempCardsState);

        tempCardsState[cardIdx] = {
          ...tempCardsState[cardIdx],
          revealed: true,
          player: chosenPlayer.name,
          grade: chosenPlayer.grade,
          teamIndex: teamIdx,
          shielded: false
        };

        setActiveRevealingCard(cardIdx);
        setRevealingTeamIndex(teamIdx);
        setRevealPhase('card-focus');
        await delay(2000);

        setRevealPhase('card-spin');
        await delay(1800);

        setRevealedPlayerText(chosenPlayer.name);
        setRevealPhase('player-name');
        await delay(2500);

        setCards([...tempCardsState]);
        localStorage.setItem('hotshots_cards_v4', JSON.stringify(tempCardsState));

        setRevealPhase('inactive');
        setActiveRevealingCard(null);
        setRevealingTeamIndex(null);
        setRevealedPlayerText('');

        setRoundPicks(prev => {
          const updated = [...prev];
          updated[teamIdx] = '';
          return updated;
        });

        setPicksSaved(prev => {
          const updated = [...prev];
          updated[teamIdx] = false;
          return updated;
        });

        await delay(1000);
      }
    }

    setBlockedTeamsThisRound([false, false, false, false]);
  };

  const getShareFinalRosterText = () => {
    let text = `🏆 HOTSHOTS DRAFT: FINAL ROSTERS 🏆\n===============================\n`;
    captainNames.forEach((capName, idx) => {
      const teamPicks = cards.filter(c => c.teamIndex === idx && c.revealed);
      text += `♣️ ${(teamNames[idx] || 'Team').toUpperCase()} (${capName})\n`;
      teamPicks.forEach(p => {
        text += `- [Card #${cards.find(c => c.player === p.player)?.number}] ${p.player}\n`;
      });
      text += `-------------------------------\n`;
    });
    return encodeURIComponent(text);
  };

  const handleSavePickNumber = (teamIdx: number) => {
    const val = roundPicks[teamIdx];
    const num = parseInt(val, 10);
    
    if (isNaN(num) || num < 1 || num > 12) {
      showFeedback('Please enter a valid card number between 1 and 12.', 'error');
      return;
    }

    if (cards[num - 1].revealed) {
      showFeedback(`Card #${num} has already been revealed! Choose a different number.`, 'error');
      return;
    }

    const duplicateIdx = roundPicks.findIndex((p, idx) => idx !== teamIdx && parseInt(p, 10) === num);
    if (duplicateIdx !== -1) {
      showFeedback(`Card #${num} has already been chosen by ${teamNames[duplicateIdx]} for this round!`, 'error');
      return;
    }

    const updatedSaved = [...picksSaved];
    updatedSaved[teamIdx] = true;
    setPicksSaved(updatedSaved);
    showFeedback(`Selection for ${teamNames[teamIdx] || 'Team'} saved successfully!`, 'success');
  };

  const handleClearPickNumber = (teamIdx: number) => {
    const updatedPicks = [...roundPicks];
    updatedPicks[teamIdx] = '';
    setRoundPicks(updatedPicks);

    const updatedSaved = [...picksSaved];
    updatedSaved[teamIdx] = false;
    setPicksSaved(updatedSaved);
  };

  if (!mounted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ color: '#0f2922', fontWeight: 800, fontSize: 16 }}>Loading Hotshots Setup...</div>
      </div>
    );
  }

  const isStep1Valid = captainNames.every(name => name.trim() !== '');
  const isStep2Valid = teamNames.every(name => name.trim() !== '');
  const isDraftComplete = cards.every(c => c.revealed);
  const hasSavedPicks = picksSaved.some(s => s);

  return (
    <main className="page" style={{ paddingBottom: 80, background: '#f8fafc', minHeight: '100vh' }}>
      
      {feedbackMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: feedbackMessage.type === 'error' ? '#ef4444' : '#16a34a',
          color: '#ffffff',
          padding: '14px 24px',
          borderRadius: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          zIndex: 1000,
          fontWeight: 700,
          fontSize: 14,
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {feedbackMessage.type === 'error' ? '⚠️ ' : '✅ '} {feedbackMessage.text}
        </div>
      )}

      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, maxWidth: 1000, margin: '40px auto', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f2922', fontFamily: 'serif', margin: 0 }}>HOTSHOTS</h1>
            <p style={{ fontSize: 13, color: '#aa8529', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 800, marginBottom: 30 }}>Draft & Setup Console</p>
          </div>
          {activeCaptainSessionIdx === null && (
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }} 
              style={{ background: '#ef4444', border: 'none', color: '#ffffff', fontWeight: 700, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
            >
              Reset Draft State
            </button>
          )}
        </div>

        {/* STEP 1: PRE-REGISTER ALL 16 PLAYERS & ASSIGN CAPTAINS */}
        {step === 1 && !draftStarted && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Step 1: Player Roster & Captains Selection</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
              Verify the 16 players pool, upload their profile pics, and select who the 4 captains are for tonight.
            </p>

            <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', padding: 20, borderRadius: 12, marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f2922', marginBottom: 12, textTransform: 'uppercase' }}>Select 4 Captains</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {captainNames.map((name, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>Captain {idx + 1}</label>
                    <select 
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 13 }}
                      value={name}
                      onChange={(e) => {
                        const updated = [...captainNames];
                        updated[idx] = e.target.value;
                        setCaptainNames(updated);
                      }}
                    >
                      <option value="">-- Choose Player --</option>
                      {allPlayers.map((p, pIdx) => (
                        <option key={pIdx} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Roster Photo Management</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', padding: 16, borderRadius: 10, marginBottom: 24 }}>
              {allPlayers.map((player, idx) => {
                const isCaptain = captainNames.some(c => c === player.name);
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: isCaptain ? 'rgba(212,175,55,0.1)' : '#ffffff', border: isCaptain ? '1px solid #d4af37' : '1px solid #f1f5f9', padding: 8, borderRadius: 8 }}>
                    {player.logoUrl ? (
                      <img src={player.logoUrl} alt="Pic" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>No Pic</div>
                    )}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{player.name}</div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ fontSize: 9, width: '100%', marginTop: 2 }} 
                        onChange={(e) => handlePlayerPicUpload(idx, e)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              disabled={!isStep1Valid}
              onClick={() => setStep(2)}
              style={{ background: isStep1Valid ? '#0f2922' : '#cbd5e1', color: '#ffffff', border: 'none', padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: isStep1Valid ? 'pointer' : 'not-allowed', width: '100%' }}
            >
              Continue to Team Details & Logos
            </button>
          </div>
        )}

        {/* STEP 2: TEAMS & LOGOS */}
        {step === 2 && !draftStarted && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Step 2: Team Names & Logos</h2>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>← Back</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
              {captainNames.map((capName, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#fafafa', padding: 16, borderRadius: 10, border: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{capName}'s Team Name</label>
                    <input 
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#ffffff' }}
                      placeholder="e.g. Hotshots Ace"
                      value={teamNames[idx]}
                      onChange={(e) => {
                        const updated = [...teamNames];
                        updated[idx] = e.target.value;
                        setTeamNames(updated);
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Team Logo</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {teamLogos[idx] ? (
                        <img src={teamLogos[idx]} alt="Logo" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4af37' }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyItems: 'center' }} />
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleLogoUpload(idx, e)}
                        style={{ fontSize: 12, maxWidth: 150 }} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              disabled={!isStep2Valid}
              onClick={() => setStep(3)}
              style={{ background: isStep2Valid ? '#0f2922' : '#cbd5e1', color: '#ffffff', border: 'none', padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: isStep2Valid ? 'pointer' : 'not-allowed', width: '100%' }}
            >
              Continue to Face-Down Powerups Board
            </button>
          </div>
        )}

        {/* STEP 3: FACE-DOWN POWERUPS board (FCFS) */}
        {step === 3 && !draftStarted && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f2922', fontFamily: 'serif', margin: 0 }}>Step 3: Powerup Cards Pile</h2>
                <p style={{ fontSize: 13, color: '#aa8529', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>
                  First-Come, First-Served Secret Allocation
                </p>
              </div>
              <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>← Back</button>
            </div>

            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 30, lineHeight: 1.5 }}>
              The 6 powerup cards are placed face-down. Captains select one card each.
              The assignment remains completely secret from other players until played!
            </p>

            {/* Log-In Simulation Bar via Dedicated Links */}
            <div style={{ background: '#fafafa', border: '1px solid #cbd5e1', padding: '16px 24px', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#0f2922', textTransform: 'uppercase' }}>Captain Session Status:</span>
                {loggedInCaptainName && (
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 800 }}>
                    Active Dedicated Link Session: **{loggedInCaptainName}** (Captain {activeCaptainSessionIdx! + 1})
                  </span>
                )}
              </div>
              
              {!loggedInCaptainName ? (
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                  ⚠️ Accessing via Viewer Mode. Use your dedicated captain's link to select a powerup card.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                  Logged in as captain. Click on any card below to allocate your secret powerup.
                </div>
              )}
            </div>

            {/* FACE-DOWN PILE GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 40 }}>
              {powerupPile.map((card, idx) => {
                const isClaimed = card.claimedByTeamIndex !== null;
                const isClaimedByMe = activeCaptainSessionIdx !== null && card.claimedByTeamIndex === activeCaptainSessionIdx;

                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (activeCaptainSessionIdx !== null && activeCaptainSessionIdx >= 0) {
                        handleSelectFaceDownPowerup(activeCaptainSessionIdx, idx);
                      } else {
                        showFeedback('Dedicated captain access link is required to select card.', 'error');
                      }
                    }}
                    style={{
                      height: 200,
                      background: isClaimed ? '#0f2922' : '#ffffff',
                      border: isClaimed ? '2px solid #cbd5e1' : '2px solid #d4af37',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: isClaimed ? 'none' : '0 10px 20px rgba(212,175,55,0.08)',
                      transition: 'all 0.3s ease',
                      opacity: isClaimed && !isClaimedByMe ? 0.4 : 1,
                      cursor: isClaimed ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isClaimed ? (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: 12,
                        width: '100%',
                        height: '100%',
                        backgroundImage: isClaimedByMe ? 'url(/hotshots_empty_white_1786961957195.jpg)' : 'url(/hotshots_clean_back_1786954882257.jpg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius: 10,
                        border: '2px solid #d4af37',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        {isClaimedByMe ? (
                          <>
                            <div style={{ height: 10 }} />
                            <div style={{ 
                              width: 50, 
                              height: 50, 
                              borderRadius: '50%', 
                              background: 'rgba(212,175,55,0.1)', 
                              border: '1.5px solid #d4af37', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              fontSize: 22,
                              boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
                            }}>
                              {(() => {
                                if (card.type === 'Steal') return '🎭';
                                if (card.type === 'Shield') return '🛡️';
                                if (card.type === 'Spyglass') return '🔮';
                                if (card.type === 'DeckSwap') return '🔄';
                                if (card.type === 'Block') return '⏳';
                                return '🃏';
                              })()}
                            </div>
                            
                            <div style={{ 
                              background: '#ffffff', 
                              border: '1px solid #d4af37', 
                              borderRadius: 4, 
                              padding: '4px 2px', 
                              width: '90%',
                              textAlign: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                              <div style={{ fontSize: 9, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {card.type}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ height: 10 }} />
                            <span style={{ fontSize: 16 }}>🔒</span>
                            <div style={{ 
                              background: '#ffffff', 
                              border: '1px solid #d4af37', 
                              borderRadius: 4, 
                              padding: '4px 2px', 
                              width: '90%',
                              textAlign: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                              <div style={{ fontSize: 9, fontWeight: 900, color: '#0f2922', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                CLAIMED
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: 'url(/hotshots_clean_back_1786954882257.jpg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius: 10,
                        border: '2px solid #d4af37',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 12,
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ height: 10 }} />
                        <div style={{ 
                          width: 44, 
                          height: 44, 
                          borderRadius: '50%', 
                          background: 'rgba(255,255,255,0.9)', 
                          border: '2px solid #d4af37', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: 16,
                          fontWeight: 900,
                          color: '#aa8529',
                          fontFamily: 'serif'
                        }}>
                          HS
                        </div>
                        <div style={{ 
                          background: '#ffffff', 
                          border: '1px solid #d4af37', 
                          borderRadius: 4, 
                          padding: '4px 2px', 
                          width: '90%',
                          textAlign: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ fontSize: 9, fontWeight: 900, color: '#0f2922', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            CARD {idx + 1}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setDraftStarted(true)}
              style={{
                background: '#0f2922',
                color: '#ffffff',
                border: '1px solid #d4af37',
                padding: '14px 28px',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 900,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Start Blind Card Draw Board
            </button>
          </div>
        )}

        {/* ACTIVE DRAFT BOARD (STEP 4) */}
        {draftStarted && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f2922', fontFamily: 'serif', margin: 0 }}>Step 4: Active Blind Draft Board</h2>
                <div style={{ fontSize: 12, color: '#aa8529', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
                  Status: <span style={{ color: '#0f2922', fontWeight: 900 }}>{isDraftComplete ? 'Draft Complete' : 'Captains Selection Phase'}</span>
                </div>
              </div>

              {/* SIMULTANEOUS SCREEN VIEW SIMULATOR TOGGLE */}
              {activeCaptainSessionIdx === null && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#aa8529' }}>🖥️ SIMULATOR VIEW:</span>
                  <button 
                    onClick={() => {
                      setActiveCaptainSessionIdx(null);
                      setLoggedInCaptainName(null);
                      showFeedback('Switched to spectator view', 'success');
                    }}
                    style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, background: activeCaptainSessionIdx === null ? '#0f2922' : '#ffffff', color: activeCaptainSessionIdx === null ? '#ffffff' : '#0f2922', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Admin View
                  </button>
                  {captainNames.map((name, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveCaptainSessionIdx(idx);
                        setLoggedInCaptainName(name);
                        showFeedback(`Simulating Captain ${name}'s Screen`, 'success');
                      }}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: 11, 
                        fontWeight: 700, 
                        background: activeCaptainSessionIdx === idx ? '#d4af37' : '#ffffff', 
                        color: '#0f2922', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: 4, 
                        cursor: 'pointer' 
                      }}
                    >
                      {name}'s Screen
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PRE-ROUND PHASE AUTO TRIGGER BAR */}
            {activeCaptainSessionIdx === null && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 20, borderRadius: 12, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#0f2922' }}>Pre-Round Action Phase</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Triggers the 15-second auto-countdown overlay on all screens for captains to play Block, Shield, Spyglass, or Joker.</div>
                </div>
                <button
                  onClick={() => {
                    setPreRoundActive(true);
                    setPreRoundTimer(15);
                    
                    const interval = setInterval(() => {
                      setPreRoundTimer(prev => {
                        if (prev <= 1) {
                          clearInterval(interval);
                          setPreRoundActive(false);
                          showFeedback('Pre-round phase finished! Captains submit your blind choices below.', 'success');
                          return 0;
                        }
                        return prev - 1;
                      });
                    }, 1000);
                    
                    setPreRoundTimerInterval(interval);
                  }}
                  disabled={preRoundActive}
                  style={{
                    background: preRoundActive ? '#cbd5e1' : '#0f2922',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: preRoundActive ? 'not-allowed' : 'pointer'
                  }}
                >
                  {preRoundActive ? 'Pre-Round Active...' : '🚀 Start Next Round (15s Auto Countdown)'}
                </button>
              </div>
            )}

            {/* PRE-ROUND INTERACTIVE COUNTDOWN MODAL */}
            {preRoundActive && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 41, 34, 0.98)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                backdropFilter: 'blur(12px)'
              }}>
                <div style={{
                  background: '#ffffff',
                  border: '4px solid #d4af37',
                  borderRadius: 24,
                  padding: 40,
                  width: 460,
                  textAlign: 'center',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
                  position: 'relative'
                }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, background: '#ef4444', color: '#ffffff', padding: '4px 10px', borderRadius: 4, display: 'inline-block', fontWeight: 800 }}>
                    Pre-Round Phase Active
                  </div>
                  <div style={{ fontSize: 60, fontWeight: 900, color: '#0f2922', margin: '20px 0' }}>{preRoundTimer}s</div>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Captains: Select your Simulated View to activate pre-draw powerups now!</p>
                  
                  {/* Simulate Captain drop down inside modal */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', background: '#fafafa', padding: 16, borderRadius: 10, border: '1px solid #cbd5e1' }}>
                    {/* Simulate Captain view selection dropdown mapped with login state helper */}
                    <label style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8' }}>ACTIVE USER INTERFACE:</label>
                    <select
                      style={{ padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff', fontWeight: 700 }}
                      value={activeCaptainSessionIdx === null ? 'admin' : activeCaptainSessionIdx.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'admin') {
                          setActiveCaptainSessionIdx(null);
                          setLoggedInCaptainName(null);
                        } else {
                          const idx = parseInt(val, 10);
                          setActiveCaptainSessionIdx(idx);
                          setLoggedInCaptainName(captainNames[idx]);
                        }
                      }}
                    >
                      <option value="admin">Administrator View (Spectator)</option>
                      {captainNames.map((name, idx) => (
                        <option key={idx} value={idx.toString()}>{name}</option>
                      ))}
                    </select>

                    {activeCaptainSessionIdx !== null && (() => {
                      const claimedCard = powerupPile.find(c => c.claimedByTeamIndex === activeCaptainSessionIdx);
                      const assignedPicks = cards.filter(c => c.teamIndex === activeCaptainSessionIdx && c.revealed);
                      
                      if (!claimedCard) {
                        return <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>No unused powerup card found in inventory.</span>;
                      }

                      return (
                        <div style={{ marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f2922' }}>Your Secret Powerup: <span style={{ color: '#aa8529' }}>{claimedCard.type}</span></div>
                          
                          {/* Play Buttons for Pre-Round Actions */}
                          <div style={{ marginTop: 12 }}>
                            {claimedCard.type === 'Joker' && (
                              <button 
                                onClick={() => handleUseJoker(activeCaptainSessionIdx)}
                                style={{ width: '100%', padding: '10px', background: '#d4af37', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 800, color: '#0f2922', cursor: 'pointer' }}
                              >
                                Play Joker (Select Grade List)
                              </button>
                            )}
                            {claimedCard.type === 'Spyglass' && (
                              <button 
                                onClick={() => handleUseSpyglass(activeCaptainSessionIdx)}
                                style={{ width: '100%', padding: '10px', background: '#d4af37', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 800, color: '#0f2922', cursor: 'pointer' }}
                              >
                                Play Spyglass (Peek Card)
                              </button>
                            )}
                            {claimedCard.type === 'Block' && (
                              <select 
                                onChange={(e) => {
                                  if (e.target.value) handleUseBlock(activeCaptainSessionIdx, parseInt(e.target.value, 10));
                                }}
                                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700 }}
                              >
                                <option value="">Select Captain to Block...</option>
                                {captainNames.map((n, i) => i !== activeCaptainSessionIdx && <option key={i} value={i}>{n}</option>)}
                              </select>
                            )}
                            {claimedCard.type === 'Shield' && assignedPicks.length > 0 ? (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) handleToggleShield(activeCaptainSessionIdx, parseInt(e.target.value, 10));
                                }}
                                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700 }}
                              >
                                <option value="">Select Player to Shield...</option>
                                {assignedPicks.map((p, i) => {
                                  const cIdx = cards.findIndex(c => c.player === p.player);
                                  return <option key={i} value={cIdx}>{p.player}</option>;
                                })}
                              </select>
                            ) : claimedCard.type === 'Shield' && (
                              <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>You must have drafted at least 1 player to use Secret Shield.</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* BATCH REVEAL TRIGGER */}
            {hasSavedPicks && (
              <div style={{ background: '#0f2922', border: '2px solid #d4af37', padding: 16, borderRadius: 12, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#ffffff' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#d4af37' }}>Selections Ready to Reveal!</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Captains choice numbers have been saved. Ready to run sequential reveals.</div>
                </div>
                <button 
                  onClick={executeSequentialReveal}
                  style={{ background: '#d4af37', color: '#0f2922', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 900, cursor: 'pointer' }}
                >
                  🚀 Run Dramatic Reveals 1-by-1
                </button>
              </div>
            )}

            {/* SPYGLASS MODAL OVERLAY */}
            {spyglassResult && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,41,34,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
                <div style={{ background: '#ffffff', padding: 32, borderRadius: 16, maxWidth: 360, width: '100%', textAlign: 'center', border: '3px solid #d4af37' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f2922', margin: '0 0 10px 0', fontFamily: 'serif' }}>Spyglass Peek Result</h3>
                  <p style={{ fontSize: 13, color: '#64748b' }}>Inside Card #{spyglassResult.cardNumber} you found:</p>
                  
                  <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {spyglassResult.logoUrl ? (
                      <img src={spyglassResult.logoUrl} alt="Player" style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid #d4af37', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
                    )}
                    <h4 style={{ fontSize: 20, fontWeight: 800, color: '#0f2922', marginTop: 10, fontFamily: 'serif' }}>{spyglassResult.playerName}</h4>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      onClick={() => handleConfirmSpyglassDraft(jokerActiveTeamIndex || 0, spyglassResult.cardNumber, spyglassResult.playerName)}
                      style={{ flex: 1, padding: '10px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Keep & Draft
                    </button>
                    <button 
                      onClick={() => setSpyglassResult(null)}
                      style={{ flex: 1, padding: '10px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Put Back & Pick Else
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* JOKER POPUP CHOICE OVERLAY */}
            {jokerOptions.length > 0 && jokerActiveTeamIndex !== null && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,41,34,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
                <div style={{ background: '#ffffff', padding: 32, borderRadius: 16, maxWidth: 440, width: '100%', textAlign: 'center', border: '3px solid #d4af37' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f2922', margin: '0 0 6px 0', fontFamily: 'serif' }}>Joker Card: Choose Your Player</h3>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Select exactly 1 player from the unrevealed pool of your required grade tier:</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {jokerOptions.map((player, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleConfirmJokerDraft(jokerActiveTeamIndex, player)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: '#ffffff',
                          transition: 'all 0.2s ease',
                          fontWeight: 700
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                      >
                        {player.logoUrl ? (
                          <img src={player.logoUrl} alt="Pic" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>👤</div>
                        )}
                        <span style={{ fontSize: 14, color: '#0f2922' }}>{player.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN-WIDE SHUFFLING DECK ANIMATION OVERLAY */}
            {revealPhase === 'shuffling-deck' && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15,41,34,0.98)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                backdropFilter: 'blur(16px)'
              }}>
                <div style={{ textAlign: 'center', color: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 30 }}>
                    <div style={{ width: 60, height: 90, background: '#0f2922', border: '2px solid #d4af37', borderRadius: 8, animation: 'cardShuffleLeft 1.2s infinite ease-in-out' }} />
                    <div style={{ width: 60, height: 90, background: '#0f2922', border: '2px solid #d4af37', borderRadius: 8, animation: 'cardShuffleRight 1.2s infinite ease-in-out' }} />
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, fontFamily: 'serif', color: '#d4af37' }}>DECK SWAP ACTIVATED</h3>
                  <p style={{ fontSize: 14, color: '#cbd5e1', marginTop: 8 }}>Recycling player and shuffling remaining card pool...</p>
                </div>
              </div>
            )}

            {/* SCREEN-WIDE POWERUP REVEAL ANIMATION OVERLAY */}
            {revealPhase === 'powerup-trigger' && animatingPowerupTeamIdx !== null && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15,41,34,0.98)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                backdropFilter: 'blur(16px)'
              }}>
                <div style={{
                  background: '#ffffff',
                  border: '5px solid #d4af37',
                  borderRadius: 24,
                  padding: 50,
                  textAlign: 'center',
                  maxWidth: 480,
                  boxShadow: '0 30px 80px rgba(212,175,55,0.4)',
                  animation: 'zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative'
                }}>
                  <div style={{ fontSize: 50, marginBottom: 12 }}>⚡</div>
                  <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0f2922', fontFamily: 'serif', margin: '0 0 8px 0' }}>POWERUP TRIGGERED!</h2>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '20px 0' }}>
                    {teamLogos[animatingPowerupTeamIdx] ? (
                      <img src={teamLogos[animatingPowerupTeamIdx]} alt="Team" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4af37' }} />
                    ) : (
                      <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#0f2922' }} />
                    )}
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#0f2922' }}>{teamNames[animatingPowerupTeamIdx]}</div>
                      <div style={{ fontSize: 12, color: '#aa8529', fontWeight: 700 }}>Captain: {captainNames[animatingPowerupTeamIdx]}</div>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: 12, border: '1px solid #e2e8f0', margin: '24px 0' }}>
                    <div style={{ fontSize: 12, color: '#aa8529', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>CARD ACTIVATED</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0f2922', margin: '6px 0', fontFamily: 'serif' }}>{animatingPowerupName}</div>
                    <div style={{ fontSize: 14, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{powerupAnimationText}</div>
                  </div>
                </div>
              </div>
            )}

            {/* HIGH DRAMA SEQUENCE OVERLAY SCREEN */}
            {activeRevealingCard !== null && revealingTeamIndex !== null && revealPhase !== 'powerup-trigger' && revealPhase !== 'shuffling-deck' && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 41, 34, 0.98)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999,
                backdropFilter: 'blur(12px)'
              }}>
                <div style={{
                  background: '#f8f9fa',
                  border: '4px solid #d4af37',
                  borderRadius: 20,
                  padding: '30px 20px',
                  width: '90%',
                  maxWidth: 320,
                  maxHeight: '90vh',
                  textAlign: 'center',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflowY: 'auto'
                }}>
                  <div style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, border: '1px solid rgba(212,175,55,0.4)', borderRadius: 12, pointerEvents: 'none' }} />

                  {revealPhase === 'card-focus' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 160, height: 230,
                        backgroundImage: 'url(/hotshots_clean_back_1786954882257.jpg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '3px solid #d4af37',
                        borderRadius: 12,
                        boxShadow: '0 0 30px rgba(212,175,55,0.4)'
                      }} />
                      <div style={{ fontSize: 13, color: '#aa8529', textTransform: 'uppercase', letterSpacing: 2, marginTop: 30, fontWeight: 900 }}>
                        Card #{activeRevealingCard + 1}
                      </div>
                    </div>
                  )}

                  {revealPhase === 'card-spin' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 160, height: 230,
                        backgroundImage: 'url(/hotshots_clean_back_1786954882257.jpg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '3px solid #d4af37',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'spin 0.4s linear infinite',
                        boxShadow: '0 0 30px rgba(212,175,55,0.6)'
                      }} />
                      <div style={{ fontSize: 13, color: '#aa8529', textTransform: 'uppercase', letterSpacing: 2, marginTop: 30, fontWeight: 900, animation: 'pulse 1s infinite' }}>
                        DRAFTING SPOT...
                      </div>
                    </div>
                  )}

                  {revealPhase === 'player-name' && (
                    <div style={{ 
                      animation: 'zoomIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      width: 200,
                      height: 280,
                      backgroundImage: 'url(/hotshots_empty_white_1786961957195.jpg)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '3px solid #d4af37',
                      borderRadius: 12,
                      position: 'relative',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                      margin: '10px auto'
                    }}>
                      {/* Profile Image Center Backdrop */}
                      <div style={{ 
                        position: 'absolute', 
                        top: 55, 
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 108, 
                        height: 108, 
                        borderRadius: '50%', 
                        overflow: 'hidden', 
                        zIndex: 2,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '2.5px solid #d4af37',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                      }}>
                        {(() => {
                          const playerItem = allPlayers.find(p => p.name === revealedPlayerText);
                          if (playerItem?.logoUrl) {
                            return <img src={playerItem.logoUrl} alt="Player" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                          }
                          return <div style={{ fontSize: 36, color: '#cbd5e1' }}>👤</div>;
                        })()}
                      </div>

                      {/* Bottom Name Plate Overlay */}
                      <div style={{ 
                        position: 'absolute',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '78%',
                        background: '#ffffff', 
                        border: '2px solid #d4af37', 
                        borderRadius: 8, 
                        padding: '8px 4px', 
                        textAlign: 'center', 
                        zIndex: 3,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {revealedPlayerText}
                        </div>
                      </div>
                    </div>
                  )}

                  {revealPhase === 'reaction-window' && (
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, background: '#ef4444', color: '#ffffff', padding: '4px 10px', borderRadius: 4, display: 'inline-block', fontWeight: 800 }}>
                        Reaction Window Open
                      </div>
                      
                      <div style={{ fontSize: 50, fontWeight: 900, color: '#0f2922', margin: '20px 0' }}>
                        {reactionTimer}s
                      </div>

                      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, margin: '0 0 20px 0' }}>
                        Shout on chat to play **Steal**, **Shield**, or **Deck Swap** now!
                      </p>

                      {/* Display Owner's Current Powerup Info if available */}
                      {(() => {
                        const testCapIdx = activeCaptainSessionIdx !== null ? activeCaptainSessionIdx : revealingTeamIndex;
                        const card = powerupPile.find(c => c.claimedByTeamIndex === testCapIdx);

                        const details: Record<string, string> = {
                          'Steal': '🎭 Steal: Take a revealed player from another team (Round 1 & 2).',
                          'Shield': '🛡️ Shield: Protect a drafted player from being stolen.',
                          'Spyglass': '🔮 Spyglass: Peek at a face-down card number before picking.',
                          'DeckSwap': '🔄 Deck Swap: Reroll this revealed card for a new random player of the same grade.',
                          'Block': '⏳ Block: Force an opponent to pick last next round.',
                          'Joker': '🃏 Joker: Select your next player directly from a choice list.'
                        };

                        // Let the Admin simulate play on behalf of ANY captain during the reaction window
                        const captainsWithSteal = powerupPile.filter(c => c.type === 'Steal' && c.claimedByTeamIndex !== null && c.claimedByTeamIndex !== revealingTeamIndex && c.claimedByTeamIndex !== -99);
                        const currentDrawerHasDeckSwap = card && card.type === 'DeckSwap';
                        
                        // Check if the current drawer (revealingTeamIndex) holds a Shield card to execute counter-play
                        const drawerHasShield = powerupPile.some(c => c.type === 'Shield' && c.claimedByTeamIndex === revealingTeamIndex);

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                            {/* Shield Defensive Option for Current Drawer */}
                            {drawerHasShield && (
                              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 10, borderRadius: 8, textAlign: 'left' }}>
                                <div style={{ fontSize: 10, fontWeight: 900, color: '#059669', textTransform: 'uppercase' }}>Shield Available:</div>
                                <p style={{ fontSize: 11, color: '#047857', margin: '4px 0 8px 0' }}>{details['Shield']}</p>
                                <button
                                  onClick={() => handleToggleShield(revealingTeamIndex, activeRevealingCard)}
                                  style={{ width: '100%', padding: '8px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                                >
                                  🛡️ Play Shield (Block Steals)
                                </button>
                              </div>
                            )}

                            {/* Deck Swap Option for Current Drawer */}
                            {currentDrawerHasDeckSwap && (
                              <div style={{ background: '#fffbeb', border: '1px solid #fef08a', padding: 10, borderRadius: 8, textAlign: 'left' }}>
                                <div style={{ fontSize: 10, fontWeight: 900, color: '#ca8a04', textTransform: 'uppercase' }}>Deck Swap Available:</div>
                                <p style={{ fontSize: 11, color: '#71717a', margin: '4px 0 8px 0' }}>{details['DeckSwap']}</p>
                                <button
                                  onClick={() => handleUseDeckSwap(testCapIdx!, activeRevealingCard!)}
                                  style={{ width: '100%', padding: '8px', background: '#0f2922', color: '#d4af37', border: '1px solid #d4af37', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                                >
                                  Play Deck Swap (Reroll)
                                </button>
                              </div>
                            )}

                            {/* Steal Simulation Box for Admin Testing */}
                            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: 10, borderRadius: 8, textAlign: 'left' }}>
                              <div style={{ fontSize: 10, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>Admin Steal Tester:</div>
                              {captainsWithSteal.length > 0 ? (
                                <div style={{ marginTop: 6 }}>
                                  <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 4 }}>Simulate captain hijack:</label>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {captainsWithSteal.map((c, i) => {
                                      // If the card is shielded, show warning
                                      const isShielded = cards[activeRevealingCard!].shielded;
                                      return (
                                        <button
                                          key={i}
                                          disabled={isShielded}
                                          onClick={() => handleUseSteal(c.claimedByTeamIndex!, activeRevealingCard!)}
                                          style={{ 
                                            width: '100%', 
                                            padding: '6px', 
                                            fontSize: 11, 
                                            background: isShielded ? '#cbd5e1' : '#ef4444', 
                                            color: '#ffffff', 
                                            border: 'none', 
                                            borderRadius: 4, 
                                            fontWeight: 700, 
                                            cursor: isShielded ? 'not-allowed' : 'pointer' 
                                          }}
                                        >
                                          🎭 {captainNames[c.claimedByTeamIndex!]} steals this card! {isShielded && '(Blocked by Shield)'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0 0' }}>No captains currently hold an unused Steal powerup.</p>
                              )}
                            </div>
                            
                            {/* Admin Countdown Bypass Action */}
                            <button
                              onClick={() => {
                                (window as any)._skipActiveTimer = true;
                                showFeedback('Bypassing countdown timer...', 'success');
                              }}
                              style={{
                                width: '100%',
                                padding: '10px',
                                background: '#ef4444',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: 'pointer',
                                marginTop: 6
                              }}
                            >
                              ⏩ Skip Countdown Timer
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* THE CARD GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 20, justifyContent: 'center', marginBottom: 30 }}>
              {cards.map((card, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleCardClickFailsafe(idx)}
                  style={{
                    width: 160, height: 230,
                    background: card.revealed ? '#0f2922' : '#f8f9fa',
                    border: card.revealed ? '2px solid #d4af37' : '2px solid #e2e8f0',
                    borderRadius: 12,
                    boxShadow: card.revealed ? '0 5px 15px rgba(212, 175, 55, 0.15)' : '0 5px 10px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'not-allowed',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: card.revealed ? '#ffffff' : '#0f2922',
                    transform: 'none'
                  }}
                >
                  {card.revealed ? (
                    <div style={{ 
                      width: '100%', 
                      height: '100%', 
                      borderRadius: 10,
                      backgroundImage: 'url(/hotshots_empty_white_1786961957195.jpg)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '3px solid #d4af37', 
                      position: 'relative', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between', 
                      padding: 10,
                      boxSizing: 'border-box',
                      color: '#0f172a'
                    }}>
                      {/* Empty Top Bar */}
                      <div style={{ height: 20 }} />

                      {/* Profile Image Center Backdrop */}
                      <div style={{ 
                        position: 'absolute', 
                        top: 50, 
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 96, 
                        height: 96, 
                        borderRadius: '50%', 
                        overflow: 'hidden', 
                        zIndex: 2,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '2.5px solid #d4af37',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                      }}>
                        {(() => {
                          const playerItem = allPlayers.find(p => p.name === card.player);
                          if (playerItem?.logoUrl) {
                            return <img src={playerItem.logoUrl} alt="Player" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                          }
                          return <div style={{ fontSize: 32, color: '#cbd5e1' }}>👤</div>;
                        })()}
                      </div>

                      {/* Bottom Name Plate Overlay */}
                      <div style={{ 
                        position: 'absolute',
                        bottom: 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '78%',
                        background: '#ffffff', 
                        border: '2px solid #d4af37', 
                        borderRadius: 8, 
                        padding: '8px 4px', 
                        textAlign: 'center', 
                        zIndex: 3,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {card.player}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      width: '100%', 
                      height: '100%', 
                      borderRadius: 10, 
                      backgroundImage: 'url(/hotshots_clean_back_1786954882257.jpg)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '3px solid #d4af37', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* LIVE SQUAD LISTS PREVIEW WITH INPUT REVEAL BOXES & POWERUP BUTTONS */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Live Squad Rosters</h3>
                {isDraftComplete && (
                  <a 
                    href={`https://api.whatsapp.com/send?text=${getShareFinalRosterText()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: '#0f2922', color: '#ffffff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 800, textDecoration: 'none', border: '1px solid #d4af37' }}
                  >
                    Share Final Rosters to WhatsApp
                  </a>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {captainNames.map((capName, idx) => {
                  const assignedPicks = cards.filter(c => c.teamIndex === idx && c.revealed);
                  const isSaved = picksSaved[idx];
                  const captainPlayer = allPlayers.find(p => p.name === capName);
                  
                  const claimedCard = powerupPile.find(c => c.claimedByTeamIndex === idx);
                  const isUsed = claimedCard === undefined; 

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        backgroundImage: 'url(/hotshots_empty_white_1786961957195.jpg)',
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        padding: '30px 24px', 
                        borderRadius: 16, 
                        border: '3px solid #d4af37', 
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, pointerEvents: 'none' }} />
                      <div style={{ position: 'relative', zIndex: 2 }}>
                        {/* Team Info Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 10, marginBottom: 10 }}>
                          {teamLogos[idx] ? (
                            <img src={teamLogos[idx]} alt="Logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid #d4af37' }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0' }} />
                          )}
                          <div style={{ fontWeight: 800, color: '#0f2922', fontSize: 14 }}>{teamNames[idx] || `Team ${idx + 1}`}</div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                          {captainPlayer?.logoUrl ? (
                            <img src={captainPlayer.logoUrl} alt="Cap" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>👤</div>
                          )}
                          <div style={{ fontSize: 12, color: '#aa8529', fontWeight: 800 }}>Captain: {capName}</div>
                        </div>


                        
                        <div style={{ marginTop: 12, marginBottom: 20 }}>
                          {assignedPicks.map((pick, pIdx) => {
                            const playerItem = allPlayers.find(p => p.name === pick.player);
                            const gradeColors = {
                              'A': '#d4af37',
                              'B': '#94a3b8',
                              'C': '#cd7f32'
                            };
                            return (
                              <div 
                                key={pIdx} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: pick.shielded ? 'rgba(5, 150, 105, 0.05)' : '#ffffff', 
                                  padding: '10px 12px', 
                                  borderRadius: 10, 
                                  border: pick.shielded ? '2px solid #059669' : '1px solid #e2e8f0', 
                                  marginBottom: 10,
                                  boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {playerItem?.logoUrl ? (
                                    <img src={playerItem.logoUrl} alt="Pic" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                                  ) : (
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                                  )}
                                  <div>
                                    <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 900 }}>{pick.player}</div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Card #{pick.number}</div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {pick.shielded && (
                                    <span style={{ fontSize: 12 }} title="Shield Protected">🛡️</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* INPUT BOX */}
                      {!isDraftComplete && (
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, position: 'relative', zIndex: 3 }}>
                          <label style={{ fontSize: 10, fontWeight: 800, color: isSaved ? '#16a34a' : '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                            {isSaved ? '✅ CHOICE SAVED' : '🎯 ENTER CHOSEN CARD'}
                          </label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input 
                              type="number"
                              disabled={isSaved}
                              style={{ 
                                width: '100%', 
                                padding: '8px 10px', 
                                borderRadius: 6, 
                                border: isSaved ? '1px solid #16a34a' : '1px solid #cbd5e1', 
                                fontSize: 12, 
                                background: isSaved ? '#f0fdf4' : '#ffffff',
                                cursor: isSaved ? 'not-allowed' : 'text'
                              }}
                              placeholder="e.g. 5"
                              value={roundPicks[idx]}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = [...roundPicks];
                                updated[idx] = val;
                                setRoundPicks(updated);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && handleSavePickNumber(idx)}
                            />
                            {isSaved ? (
                              <button 
                                onClick={() => handleClearPickNumber(idx)}
                                style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleSavePickNumber(idx)}
                                style={{ background: '#0f2922', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            {/* SANDBOX TESTING OVERRIDE PANEL (ADMIN DEV ONLY) */}
            {activeCaptainSessionIdx === null && (
              <div style={{ marginTop: 40, borderTop: '2px dashed #d4af37', paddingTop: 30 }}>
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: 24, borderRadius: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#92400e', margin: '0 0 4px 0', fontFamily: 'serif' }}>🛠️ Hotshots Sandbox Developer Testing Console</h3>
                  <p style={{ fontSize: 12, color: '#b45309', marginBottom: 20 }}>Use these overrides to instantly test all powerup paths without waiting for live countdown timers.</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    {captainNames.map((capName, idx) => {
                      const claimedCard = powerupPile.find(c => c.claimedByTeamIndex === idx);
                      const assignedPicks = cards.filter(c => c.teamIndex === idx && c.revealed);
                      
                      return (
                        <div key={idx} style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid #fcd34d' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f2922', marginBottom: 8 }}>{capName} (Team {idx+1})</div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 12 }}>
                            Card: <strong style={{ color: '#d97706' }}>{claimedCard ? claimedCard.type : 'None'}</strong>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button 
                              onClick={() => handleUseJoker(idx)}
                              style={{ width: '100%', padding: '6px', fontSize: 11, fontWeight: 700, background: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Force Joker Trigger
                            </button>
                            
                            <button 
                              onClick={() => handleUseSpyglass(idx)}
                              style={{ width: '100%', padding: '6px', fontSize: 11, fontWeight: 700, background: '#10b981', color: '#ffffff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Force Spyglass Trigger
                            </button>

                            {assignedPicks.length > 0 && (
                              <button 
                                onClick={() => handleToggleShield(idx, cards.findIndex(c => c.player === assignedPicks[0].player))}
                                style={{ width: '100%', padding: '6px', fontSize: 11, fontWeight: 700, background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Shield: {assignedPicks[0].player}
                              </button>
                            )}
                            
                            <select 
                              onChange={(e) => {
                                if (e.target.value) handleUseBlock(idx, parseInt(e.target.value, 10));
                              }}
                              style={{ width: '100%', padding: '4px', fontSize: 10, fontWeight: 700 }}
                            >
                              <option value="">Block...</option>
                              {captainNames.map((n, i) => i !== idx && <option key={i} value={i}>{n}</option>)}
                            </select>

                            <select 
                              onChange={(e) => {
                                if (e.target.value) handleUseSteal(idx, parseInt(e.target.value, 10));
                              }}
                              style={{ width: '100%', padding: '4px', fontSize: 10, fontWeight: 700 }}
                            >
                              <option value="">Steal...</option>
                              {cards.filter(c => c.revealed && c.teamIndex !== idx).map((c, i) => {
                                const cIdx = cards.findIndex(card => card.player === c.player);
                                return <option key={i} value={cIdx}>{c.player}</option>;
                              })}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* FLOATING COLLAPSIBLE REAL-TIME CHAT WIDGET */}
            <div style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              width: 'calc(100% - 40px)',
              maxWidth: 320,
              background: '#ffffff',
              border: '2px solid #d4af37',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              zIndex: 99999,
              overflow: 'hidden'
            }}>
              {/* Header Toggle */}
              <div 
                onClick={() => {
                  const state = (window as any)._chatMinimized;
                  (window as any)._chatMinimized = !state;
                  const targetEl = document.getElementById('floating-chat-container');
                  if (targetEl) {
                    targetEl.style.display = !state ? 'none' : 'block';
                  }
                  const arrowEl = document.getElementById('chat-toggle-arrow');
                  if (arrowEl) {
                    arrowEl.innerText = !state ? '🔼' : '🔽';
                  }
                }}
                style={{ 
                  background: '#0f2922', 
                  color: '#ffffff', 
                  padding: '10px 14px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 12
                }}
              >
                <span>💬 Draft Chat Channel</span>
                <span id="chat-toggle-arrow">🔽</span>
              </div>

              {/* Chat Body Container */}
              <div id="floating-chat-container">
                <div style={{ height: 160, overflowY: 'auto', padding: 12, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chatLog.map((msg, i) => (
                    <div key={i} style={{ fontSize: 11, lineHeight: 1.3 }}>
                      <strong style={{ color: msg.sender === 'System' ? '#64748b' : '#aa8529', marginRight: 4 }}>
                        [{msg.sender}]
                      </strong>
                      <span style={{ color: '#334155' }}>{msg.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', borderTop: '1px solid #cbd5e1', background: '#ffffff' }}>
                  <input 
                    type="text" 
                    placeholder="Message..."
                    style={{ flex: 1, padding: '10px', border: 'none', outline: 'none', fontSize: 12 }}
                    value={chatInputVal}
                    onChange={(e) => setChatInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && chatInputVal.trim()) {
                        const senderName = loggedInCaptainName || 'Admin';
                        const newMsg = {
                          sender: senderName,
                          text: chatInputVal.trim(),
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                        setChatLog(prev => [...prev, newMsg]);
                        setChatInputVal('');
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (chatInputVal.trim()) {
                        const senderName = loggedInCaptainName || 'Admin';
                        const newMsg = {
                          sender: senderName,
                          text: chatInputVal.trim(),
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                        setChatLog(prev => [...prev, newMsg]);
                        setChatInputVal('');
                      }
                    }}
                    style={{ padding: '0 14px', background: '#0f2922', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes zoomIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes cardShuffleLeft {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(-35px) rotate(-15deg); z-index: 10; }
        }
        @keyframes cardShuffleRight {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(35px) rotate(15deg); z-index: -10; }
        }
      `}</style>

    </main>
  );
}
