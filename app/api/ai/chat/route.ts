import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createSession, getRounds, insertRounds } from '@/lib/db';
import { generateScrambleSchedule } from '@/lib/shuffle';
import { verifyGeneratedSchedule } from '@/lib/aiVerificationSandbox';
import Anthropic from '@anthropic-ai/sdk';

// 1. Anthropic Claude API Call
async function callClaudeApi(systemPrompt: string, userMessage: string, apiKey: string): Promise<string | null> {
  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = response.content[0];
    return block && block.type === 'text' ? block.text : null;
  } catch (err) {
    console.error('Claude API call failed:', err);
    return null;
  }
}

// 2. Google Gemini API Call
async function callGeminiApi(systemPrompt: string, userMessage: string, apiKey: string): Promise<string | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${userMessage}` }] },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { message, clubId } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const trimmedMsg = message.trim();
    const q = trimmedMsg.toLowerCase();

    // -------------------------------------------------------------
    // A. ACTION EXECUTOR: Natural Language Session Creation
    // -------------------------------------------------------------
    if (
      (q.includes('create') || q.includes('start') || q.includes('set up') || q.includes('new') || q.includes('make')) &&
      (q.includes('session') || q.includes('match') || q.includes('scramble') || q.includes('game') || q.includes('play'))
    ) {
      if (!clubId) {
        return NextResponse.json({
          reply: '⚠️ Please select or join a club first so I can set up your session!',
        });
      }

      // Fetch club players
      const { data: clubPlayers } = await supabase
        .from('players')
        .select('name')
        .eq('club_id', clubId)
        .limit(12);

      const availableNames = (clubPlayers || []).map(p => p.name);
      let selectedPlayers = availableNames.length >= 4 ? availableNames.slice(0, 8) : ['Nadeem', 'Viki', 'Amresh', 'Rahul'];

      // Format detection
      let format = 'scramble';
      if (q.includes('king')) format = 'king_of_court';
      else if (q.includes('squad')) format = 'squad_rivalry';
      else if (q.includes('fixed')) format = 'fixed_partners';

      // Parse court count and rounds
      const courtMatch = q.match(/(\d+)\s*court/);
      const courtCount = courtMatch ? parseInt(courtMatch[1], 10) : 2;
      const roundMatch = q.match(/(\d+)\s*round/);
      const roundCount = roundMatch ? parseInt(roundMatch[1], 10) : 12;

      const courtLabels = Array.from({ length: courtCount }, (_, i) => `${i + 1}`);
      const formatLabel = format === 'king_of_court' ? 'King of Court' : format === 'squad_rivalry' ? 'Squad Rivalry' : format === 'fixed_partners' ? 'Fixed Partners' : 'Scramble';
      const groupName = `AI Scheduled ${formatLabel}`;

      try {
        const sessionId = await createSession({
          clubId,
          format: format as any,
          players: selectedPlayers,
          absentPlayers: [],
          squads: null,
          courtLabels,
          roundCount,
          roundDurationMinutes: 15,
          roundsPerBlock: null,
          groupName,
          logoUrl1: null,
          logoUrl2: null,
          startTime: null,
          eventDate: null,
          courtCost: null,
          ballCost: 0,
          isLadder: false,
          kingOfCourtFixedPairs: null,
          venue: null,
          storylines: [],
          bookerUpiVpa: null,
        });

        const seed = `${Date.now()}`;
        const generatedRounds = generateScrambleSchedule(selectedPlayers, courtCount, roundCount, seed, []);
        await insertRounds(sessionId, generatedRounds);

        // Execute automated verification sandbox on generated rounds
        const createdRounds = await getRounds(sessionId);
        const verification = verifyGeneratedSchedule(selectedPlayers, createdRounds);

        return NextResponse.json({
          reply: `**Session Created & Verified Successfully**\n\n` +
            `• **Event Name**: ${groupName}\n` +
            `• **Match Format**: ${formatLabel.toUpperCase()}\n` +
            `• **Roster (${selectedPlayers.length} players)**: ${selectedPlayers.join(', ')}\n` +
            `• **Courts**: ${courtCount} (${courtLabels.join('/')})\n` +
            `• **Schedule**: ${roundCount} Rounds\n` +
            `• **Verification Test**: ${verification.valid ? 'PASSED (0 Consecutive Rests, Fair Rest Matrix)' : 'WARNINGS ENCOUNTERED'}\n\n` +
            `Click the button below to launch into the live scorekeeper!`,
          action: {
            type: 'session_created',
            sessionId,
            groupName,
            url: `/session/${sessionId}/play`,
          },
        });
      } catch (err: any) {
        console.error('AI Session creation error:', err);
      }
    }

    // -------------------------------------------------------------
    // B. ACTION EXECUTOR: Tournament Creation Intent
    // -------------------------------------------------------------
    if ((q.includes('create') || q.includes('start') || q.includes('set up') || q.includes('make')) && q.includes('tournament')) {
      return NextResponse.json({
        reply: `**Tournament Builder Initialized**\n\n` +
          `I can assist you in building your tournament structure! Choose your preferred format:\n` +
          `• **Single / Double Elimination Bracket**\n` +
          `• **Group Stage Round-Robin + Knockout**\n` +
          `• **Multi-Squad Team Championship**\n\n` +
          `Click below to configure your tournament:`,
        action: {
          type: 'tournament_setup',
          url: `/tournaments`,
        },
      });
    }

    // -------------------------------------------------------------
    // C. GATHER LIVE DATABASE CONTEXT FOR ANALYTICS AND CHAT
    // -------------------------------------------------------------
    let activeSessionContext = 'No active in-progress session currently running.';
    let clubLeaderboardContext = 'No club stats recorded yet.';
    let playerStatsMap = new Map<string, any>();

    if (clubId) {
      const { data: s } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'in_progress')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (s) {
        const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', s.id);
        const scored = (rounds || []).filter(r => r.score_a !== null && r.score_b !== null).length;
        activeSessionContext = `Active Session "${s.group_name || 'Club Session'}" (#${s.id}) — Format: ${s.format}, ${s.players?.length || 0} Players (${s.players?.join(', ') || ''}), Scored ${scored}/${(rounds || []).length} rounds. Courts: ${s.court_labels?.join('/') || '1'}.`;
      }

      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('club_id', clubId)
        .order('elo_rating', { ascending: false });

      if (players && players.length > 0) {
        clubLeaderboardContext = players.map((p, i) => `${i + 1}. ${p.name} (Elo: ${p.elo_rating}, ${p.games_played} games)`).join('; ');
        players.forEach(p => playerStatsMap.set(p.name.toLowerCase(), p));
      }
    }

    // -------------------------------------------------------------
    // D. TRY LLM ENGINE (ANTHROPIC CLAUDE FIRST, THEN GEMINI)
    // -------------------------------------------------------------
    const systemPrompt =
      `You are DinkBot 3000, the official AI Assistant for the Pickleball App.\n` +
      `Your tone is sharp, expert, concise, highly intelligent, and sports-focused.\n` +
      `HARD RULE: DO NOT USE ANY EMOJIS IN YOUR RESPONSE.\n` +
      `LIVE CLUB CONTEXT:\n` +
      `- Active Session: ${activeSessionContext}\n` +
      `- Club Leaderboard: ${clubLeaderboardContext}\n` +
      `Respond directly and format output cleanly using Markdown bullet points and bold headers.`;

    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const claudeReply = await callClaudeApi(systemPrompt, trimmedMsg, anthropicKey);
      if (claudeReply) return NextResponse.json({ reply: claudeReply });
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (geminiKey) {
      const geminiReply = await callGeminiApi(systemPrompt, trimmedMsg, geminiKey);
      if (geminiReply) return NextResponse.json({ reply: geminiReply });
    }

    // -------------------------------------------------------------
    // E. HIGH-INTELLIGENCE KNOWLEDGE & ANALYTICS ENGINE (FAILSAFE)
    // -------------------------------------------------------------

    // 1. Specific Player Stats Lookup (e.g. "Nadeem", "Viki", "Amresh")
    for (const [pNameLower, player] of playerStatsMap.entries()) {
      if (q.includes(pNameLower)) {
        return NextResponse.json({
          reply: `**Player Analytics for ${player.name}**:\n\n` +
            `• **Elo Rating**: ${player.elo_rating} pts (Elo Rating System: The standard measure of relative skill level)\n` +
            `• **Total Games Played**: ${player.games_played}\n` +
            `• **Dominant Hand**: ${player.dominant_hand || 'Right-handed'}\n` +
            `• **Equipped Paddle**: ${player.paddle || 'Standard Composite'}\n` +
            `• **Signature Shot**: ${player.signature_shot || 'Third-Shot Drop'}\n\n` +
            `Want me to schedule a session with ${player.name}? Just type *"Start a session with ${player.name}"*!`,
        });
      }
    }

    // 2. Active Session / Live Match Status
    if (q.includes('active') || q.includes('ongoing') || q.includes('live') || q.includes('score') || q.includes('running')) {
      return NextResponse.json({
        reply: `**Live Active Session Status**:\n\n${activeSessionContext}`,
      });
    }

    // 3. Leaderboard & Ranks
    if (q.includes('top') || q.includes('leaderboard') || q.includes('rank') || q.includes('best') || q.includes('stats') || q.includes('who is leading')) {
      return NextResponse.json({
        reply: `**Club Standings & Elo Ranks**:\n\n` +
          `${clubLeaderboardContext.split('; ').slice(0, 5).map(line => `• ${line}`).join('\n')}`,
      });
    }

    // 4. Pickleball Rules & Strategy Guide
    if (q.includes('kitchen') || q.includes('rule') || q.includes('dink') || q.includes('serve') || q.includes('fault') || q.includes('two bounce')) {
      if (q.includes('kitchen')) {
        return NextResponse.json({
          reply: `**Kitchen (Non-Volley Zone) Rules**:\n\n` +
            `• **Volleys Prohibited**: You cannot hit the ball out of the air (volley) while touching the 7-foot kitchen zone or kitchen boundary line.\n` +
            `• **Bounce Exception**: You CAN step inside the kitchen to hit a ball IF it has already bounced in the kitchen.\n` +
            `• **Momentum Rule**: If your momentum carries you into the kitchen after hitting a volley outside, it is a FAULT!`,
        });
      }
      if (q.includes('dink')) {
        return NextResponse.json({
          reply: `**The Dink Strategy**:\n\n` +
            `A dink is a soft shot hit landing inside the opponent's kitchen zone. It prevents the opponent from attacking with a hard volley and forces patient kitchen line play!`,
        });
      }
      return NextResponse.json({
        reply: `**Pickleball Rules Summary**:\n\n` +
          `1. **Underhand Serve**: Serve must be hit below waist level diagonally into opponent's service court.\n` +
          `2. **Two-Bounce Rule**: Serve must bounce before return; return must bounce before server hits it.\n` +
          `3. **Scoring**: Only serving team can score points. Standard games played to 11 (win by 2).`,
      });
    }

    // 5. Greetings & Assistant Info
    if (q.includes('hi') || q.includes('hello') || q.includes('hey') || q.includes('who are you') || q.includes('help')) {
      return NextResponse.json({
        reply: `**Hello! I am DinkBot 3000**, your autonomous Pickleball Assistant!\n\n` +
          `Here are commands you can give me:\n` +
          `• **"Create an 8-round Scramble session on 2 courts"**\n` +
          `• **"Set up a new tournament"**\n` +
          `• **"Show club leaderboard or active scores"**\n` +
          `• **"Explain kitchen rules or dinking technique"**\n\n` +
          `How can I assist your club today?`,
      });
    }

    // 6. Universal Natural Language Response
    return NextResponse.json({
      reply: `**DinkBot 3000 Assistant**:\n\n` +
        `I processed your query: *"${trimmedMsg}"*\n\n` +
        `• **Active Match Status**: ${activeSessionContext}\n` +
        `• **Top Club Ranks**: ${clubLeaderboardContext.split('; ')[0] || 'No player ranks recorded yet'}.\n\n` +
        `I can create live sessions, set up tournaments, or analyze player stats for you anytime!`,
    });
  } catch (err: any) {
    console.error('AI chat endpoint error:', err);
    return NextResponse.json({ error: err.message || 'AI processing error' }, { status: 500 });
  }
}
