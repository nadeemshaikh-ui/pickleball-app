import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Gather Live Database Context
    let activeSessionContext = 'No active in-progress session currently.';
    let clubLeaderboardContext = 'No club stats available.';

    if (clubId) {
      // 1. Fetch active session
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
        activeSessionContext = `Active Session "${s.group_name || 'Club Play'}" (#${s.id}) — Format: ${s.format}, ${s.players?.length || 0} Players (${s.players?.join(', ') || ''}), Scored ${scored}/${(rounds || []).length} rounds. Courts: ${s.court_labels?.join('/') || '1'}.`;
      }

      // 2. Fetch top club players
      const { data: players } = await supabase
        .from('players')
        .select('name, elo_rating, games_played')
        .eq('club_id', clubId)
        .order('elo_rating', { ascending: false })
        .limit(5);

      if (players && players.length > 0) {
        clubLeaderboardContext = players.map((p, i) => `${i + 1}. ${p.name} (Rating: ${p.elo_rating}, ${p.games_played} games)`).join('; ');
      }
    }

    // Try Gemini LLM if API Key is available
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (geminiKey) {
      const systemPrompt =
        `You are Atelier AI, the intelligent, friendly, and expert co-pilot for the Atelier Pickleball App.\n` +
        `Your job is to answer the user's questions clearly, accurately, and naturally.\n` +
        `CURRENT CONTEXT:\n` +
        `- ${activeSessionContext}\n` +
        `- Top Club Players: ${clubLeaderboardContext}\n` +
        `Respond concisely, cleanly, and helpfully. Keep your tone encouraging and sports-focused!`;

      const aiText = await callGeminiApi(systemPrompt, trimmedMsg, geminiKey);
      if (aiText) {
        return NextResponse.json({ reply: aiText });
      }
    }

    // Dynamic Fallback Engine (for conversational & general queries when LLM key is absent)
    // A. Yes/No or Binary Questions
    if (q === 'yes' || q === 'no' || q.includes('yes or no')) {
      if (q.includes('yes or no')) {
        return NextResponse.json({
          reply: `🤖 As your Pickleball AI assistant, that depends on what you are asking! For example:\n` +
            `• Can you step in the kitchen to hit a bounce? -> YES!\n` +
            `• Can you volley inside the kitchen? -> NO!\n` +
            `• Is an active session running right now? -> ${activeSessionContext.includes('Active Session') ? 'YES!' : 'NO!'}`,
        });
      }
      return NextResponse.json({
        reply: `Got it! Let me know how I can help you next with your sessions, pairings, or ratings.`,
      });
    }

    // B. Greetings / Casual Chat
    if (['hi', 'hello', 'hey', 'sup', 'yo', 'good morning', 'good evening', 'help'].includes(q)) {
      return NextResponse.json({
        reply: `Hey there! 🏓 How can I assist you today? You can ask me about live active scores, club ranks, player pairings, or rules!`,
      });
    }

    // C. Active Session Queries
    if (q.includes('active') || q.includes('ongoing') || q.includes('live') || q.includes('current session') || q.includes('score')) {
      return NextResponse.json({
        reply: `🟢 Live Session Update:\n${activeSessionContext}`,
      });
    }

    // D. Leaderboard Queries
    if (q.includes('top player') || q.includes('leaderboard') || q.includes('rank') || q.includes('best player') || q.includes('who is leading') || q.includes('stats')) {
      return NextResponse.json({
        reply: `🏆 Club Top Players:\n${clubLeaderboardContext}`,
      });
    }

    // E. Rules Queries
    if (q.includes('kitchen') || q.includes('rule') || q.includes('double bounce') || q.includes('serve') || q.includes('fault')) {
      if (q.includes('kitchen')) {
        return NextResponse.json({
          reply: `🏓 Kitchen (Non-Volley Zone) Rules:\n` +
            `• You CANNOT hit a volley (hitting the ball in the air) while touching the kitchen or kitchen line.\n` +
            `• You CAN step into the kitchen if the ball bounces inside it first!`,
        });
      }
      if (q.includes('double bounce') || q.includes('two bounce')) {
        return NextResponse.json({
          reply: `🎾 Two-Bounce Rule:\n` +
            `• The return of serve MUST bounce before hitting.\n` +
            `• The server's team MUST also let the return bounce before hitting.`,
        });
      }
      return NextResponse.json({
        reply: `🏓 Pickleball Scoring & Rules:\n` +
          `• Serve underhand diagonally.\n` +
          `• Follow the two-bounce rule.\n` +
          `• Matches are usually to 11 or 15 points (win by 2).`,
      });
    }

    // F. WhatsApp / Recap
    if (q.includes('recap') || q.includes('whatsapp') || q.includes('hype') || q.includes('summary')) {
      return NextResponse.json({
        reply: `🔥 *PICKLEBALL SESSION RECAP* 🔥\n\n` +
          `Great matches tonight! 🏓\n` +
          `• Check live standings and detailed stats in the app!\n` +
          `• See you all on court next session! ⚡`,
      });
    }

    // G. Intelligent General Answer (NO generic repeated block)
    return NextResponse.json({
      reply: `🤖 I understand you're asking about "${trimmedMsg}".\n` +
        `Here is what's happening right now in your club:\n` +
        `• ${activeSessionContext}\n` +
        `• Top Players: ${clubLeaderboardContext.split('; ')[0] || 'No ratings recorded yet'}.\n\n` +
        `Feel free to ask me anything specific about player stats, rules, schedule setups, or scorecards!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI processing error' }, { status: 500 });
  }
}
