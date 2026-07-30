import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { message, clubId } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const q = message.toLowerCase().trim();

    // 1. Live Active Session Query
    if (q.includes('active') || q.includes('ongoing') || q.includes('live') || q.includes('current session')) {
      let query = supabase.from('sessions').select('*').eq('status', 'in_progress').order('created_at', { ascending: false }).limit(1);
      if (clubId) query = query.eq('club_id', clubId);
      const { data: s } = await query.maybeSingle();

      if (!s) {
        return NextResponse.json({
          reply: "🟢 Active Session Check:\nThere are currently no active in-progress sessions for this club. You can tap 'Start a Session' on the home screen to launch a new session!",
        });
      }

      const { data: rounds } = await supabase.from('rounds').select('*').eq('session_id', s.id);
      const scored = (rounds || []).filter(r => r.score_a !== null && r.score_b !== null).length;

      return NextResponse.json({
        reply: `🟢 Active Session Found: "${s.group_name ?? 'Club Session'}" (#${s.id})\n` +
          `• Format: ${(s.format || 'scramble').toUpperCase()}\n` +
          `• Roster: ${s.players?.length || 0} Players\n` +
          `• Matches Scored: ${scored} / ${(rounds || []).length} Total Rounds\n` +
          `• Courts: ${(s.court_labels || ['1']).join(', ')}\n\n` +
          `You can view live scores or enter results on the active session card!`,
      });
    }

    // 2. Leaderboard & Top Players Query
    if (q.includes('top player') || q.includes('leaderboard') || q.includes('rank') || q.includes('best player') || q.includes('who is leading')) {
      if (!clubId) {
        return NextResponse.json({
          reply: '🏆 Club Standings:\nPlease select a club using the top club switcher to view top player statistics!',
        });
      }

      const { data: players } = await supabase.from('players').select('name, elo_rating, games_played').eq('club_id', clubId).order('elo_rating', { ascending: false }).limit(5);

      if (!players || players.length === 0) {
        return NextResponse.json({
          reply: '🏆 Club Standings:\nNo logged player statistics found for this club yet. Play your first session to start earning ELO ratings!',
        });
      }

      const topList = players.map((p, i) => `${i + 1}. ${p.name} — Rating: ${p.elo_rating} (${p.games_played} Games)`).join('\n');

      return NextResponse.json({
        reply: `🏆 Top Club Players:\n\n${topList}\n\nTap 'Stats' in the navigation menu for complete historical records!`,
      });
    }

    // 3. Rules & Kitchen Faults
    if (q.includes('kitchen') || q.includes('rule') || q.includes('double bounce') || q.includes('serve') || q.includes('scoring')) {
      if (q.includes('kitchen')) {
        return NextResponse.json({
          reply: `🏓 Kitchen (Non-Volley Zone) Rules:\n` +
            `• You CANNOT hit a volley (hitting the ball in the air before it bounces) while standing inside the 7-foot kitchen zone or stepping on the kitchen line.\n` +
            `• Your momentum cannot carry you into the kitchen after hitting a volley.\n` +
            `• You CAN enter the kitchen anytime if the ball bounces inside it first!`,
        });
      }
      if (q.includes('double bounce')) {
        return NextResponse.json({
          reply: `🎾 Two-Bounce (Double Bounce) Rule:\n` +
            `• When the ball is served, the receiving team MUST let it bounce before returning.\n` +
            `• The serving team MUST also let the return bounce before hitting it.\n` +
            `• After two bounces (one on each side), both teams can either volley or play off the bounce!`,
        });
      }
      return NextResponse.json({
        reply: `🏓 Pickleball Basic Rules:\n` +
          `• Serve underhand diagonally across court.\n` +
          `• Obey the Two-Bounce Rule on serves and returns.\n` +
          `• Stay out of the Kitchen when volleying!\n` +
          `• Matches are played to 11, 15, or 21 points (win by 2).`,
      });
    }

    // 4. WhatsApp Hype & Session Recap Generator
    if (q.includes('recap') || q.includes('whatsapp') || q.includes('hype') || q.includes('summary')) {
      return NextResponse.json({
        reply: `🔥 *PICKLEBALL RECAP* 🔥\n\n` +
          ` Great session tonight everyone! 🏓⚡\n` +
          `• Check live standings and detailed stats in the app!\n` +
          `• See you on court next time! 🏆`,
      });
    }

    // Default conversational AI answer
    return NextResponse.json({
      reply: `🤖 Atelier AI Assistant:\n` +
        `I am your intelligent Pickleball companion! Ask me about:\n` +
        `• 🟢 Live Active Sessions & Scores\n` +
        `• 🏆 Leaderboards & Player Stats\n` +
        `• 📝 WhatsApp Hype Summaries\n` +
        `• 🏓 Rules (Kitchen Faults, Two-Bounce, Serving)\n` +
        `• ⚡ Lineup & Court Rebalancing`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI processing error' }, { status: 500 });
  }
}
