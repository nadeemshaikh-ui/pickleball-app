'use client';

import { supabase } from './supabase';
import { getLatestActiveSession, listSessions, getRounds, type SessionRow, type RoundRow } from './db';
import { fetchLifetimeLeaderboard } from './leagueStats';
import { computeLeaderboard, type PlayerStats } from './analytics';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  quickActions?: { label: string; action: string }[];
}

export async function processAiQuery(query: string, clubId?: string | null): Promise<string> {
  const q = query.toLowerCase().trim();

  try {
    // 1. Active Session & Live Status
    if (q.includes('active') || q.includes('ongoing') || q.includes('current session') || q.includes('live score')) {
      const active = await getLatestActiveSession(clubId);
      if (!active) {
        return "There are currently no active in-progress sessions for this club. You can tap 'Start a Session' to create a new session!";
      }
      const rounds = await getRounds(active.id);
      const scored = rounds.filter(r => r.score_a !== null && r.score_b !== null).length;
      return `🟢 Active Session Found: "${active.group_name ?? 'Club Session'}" (#${active.id})\n` +
        `• Format: ${active.format.toUpperCase()}\n` +
        `• Players: ${active.players.length} | Rounds Scored: ${scored}/${rounds.length}\n` +
        `• Courts: ${active.court_labels.join(', ')}\n\n` +
        `You can log scores or view rankings on the active session card!`;
    }

    // 2. Leaderboard & Top Players
    if (q.includes('top player') || q.includes('leaderboard') || q.includes('rank') || q.includes('best player') || q.includes('who is leading')) {
      if (!clubId) return "Please select a club to view top player statistics and standings!";
      const leaderboard = await fetchLifetimeLeaderboard(clubId);
      if (!leaderboard || leaderboard.length === 0) {
        return "No match scores logged yet for this club to calculate leaderboard ranks.";
      }
      const top3 = leaderboard.slice(0, 5).map((p, i) => 
        `${i + 1}. ${p.name} — ${p.wins}W-${p.losses}L (${(p.winPct * 100).toFixed(0)}% Win Rate) | PD: ${p.pointsFor - p.pointsAgainst > 0 ? '+' : ''}${p.pointsFor - p.pointsAgainst}`
      ).join('\n');
      return `🏆 Club Leaderboard Standings:\n\n${top3}\n\nTap 'Stats' in the main menu for complete historical stats!`;
    }

    // 3. Rules & Kitchen Faults
    if (q.includes('kitchen') || q.includes('rule') || q.includes('double bounce') || q.includes('serve') || q.includes('scoring')) {
      if (q.includes('kitchen')) {
        return "🏓 Kitchen (Non-Volley Zone) Rules:\n" +
          "• You cannot volley (hit the ball in the air before it bounces) while standing inside the 7-foot kitchen zone or touching the kitchen line.\n" +
          "• Your momentum cannot carry you into the kitchen after hitting a volley.\n" +
          "• You CAN enter the kitchen anytime if the ball bounces inside it first!";
      }
      if (q.includes('double bounce')) {
        return "🎾 Two-Bounce (Double Bounce) Rule:\n" +
          "• When the ball is served, the receiving team MUST let it bounce before returning.\n" +
          "• The serving team MUST also let the return bounce before hitting it.\n" +
          "• After two bounces (one on each side), both teams can either volley or play off the bounce!";
      }
      return "🏓 Pickleball Basic Rules:\n" +
        "• Serve underhand into the diagonal court.\n" +
        "• Obey the Two-Bounce Rule on serves and returns.\n" +
        "• Stay out of the Kitchen when volleying!\n" +
        "• Games are played to 11, 15, or 21 points (win by 2).";
    }

    // 4. Lineup & Court Rebalancing Suggestion
    if (q.includes('rebalance') || q.includes('lineup') || q.includes('pair') || q.includes('how to split') || q.includes('courts')) {
      return "💡 Court Setup & Lineup Recommendation:\n" +
        "• For 4 Players: 1 Court (Scramble / 6 Rounds).\n" +
        "• For 6 Players: 1 Court (4 active, 2 sitting out per round, 9 Rounds total).\n" +
        "• For 8 Players: 2 Courts (4 per court, fair rotational partner shuffle).\n" +
        "• For 10+ Players: Use Court Swap / Squad Rivalry to ensure equal play time!";
    }

    // 5. WhatsApp Hype & Session Recap Generator
    if (q.includes('recap') || q.includes('whatsapp') || q.includes('hype') || q.includes('summary')) {
      if (!clubId) return "Select your active club first to generate a WhatsApp recap.";
      const active = await getLatestActiveSession(clubId);
      if (active) {
        const rounds = await getRounds(active.id);
        const stats = computeLeaderboard(rounds);
        const top = stats[0];
        return `🔥 *PICKLEBALL RECAP — ${active.group_name ?? 'CLUB SESSION'}* 🔥\n\n` +
          `🏆 Top Performer: ${top ? top.name : 'TBD'} (${top ? top.wins : 0} Wins)\n` +
          `📊 Format: ${active.format.toUpperCase()}\n` +
          `🎾 Total Games Completed: ${rounds.filter(r => r.score_a !== null).length}\n\n` +
          `Great games tonight everyone! 🏓⚡`;
      }
      return "No recent completed session found to generate a recap for. Start a session to log scores!";
    }

    // General AI Companion response
    return `🤖 Atelier AI Assistant:\n` +
      `I can help you with:\n` +
      `• Checking active session scores & standings\n` +
      `• Querying club leaderboards & player stats\n` +
      `• Generating WhatsApp recaps\n` +
      `• Explaining Pickleball rules (Kitchen, Two-Bounce, Serving)\n` +
      `• Rebalancing court lineups`;
  } catch (err) {
    return "I couldn't complete that query right now. Try asking about active sessions, leaderboards, or rules!";
  }
}
