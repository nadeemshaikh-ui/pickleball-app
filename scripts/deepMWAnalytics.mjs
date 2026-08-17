import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let serviceKey = '';

envLines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = line.split('=')[1].trim();
  }
});

const supabase = createClient(supabaseUrl, serviceKey);

const MW_CLUB_IDS = [
  'd5b57890-3787-41bb-bf23-38bc95345011',
  '6dce71c2-afce-4940-bebf-45955dd36dc2',
  '53bc94a5-a7b6-4383-9b27-2ea2a32a7eae'
];

async function runDeepAnalysis() {
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .in('club_id', MW_CLUB_IDS);

  console.log(`Found ${sessions.length} sessions for Monday-Wednesday Club.`);
  
  const sessionIds = sessions.map(s => s.id);
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .in('session_id', sessionIds);

  const scoredRounds = rounds.filter(r => r.score_a !== null && r.score_b !== null);
  console.log(`Total Scored Rounds for MW Club: ${scoredRounds.length}`);

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .in('club_id', MW_CLUB_IDS);

  console.log(`Total Registered Players for MW Club: ${players.length}`);

  // Build Player Stats Data Structure
  const playerStats = {};
  const partnershipStats = {}; // key: "p1|p2"
  const h2hStats = {}; // key: "p1|p2"

  function ensurePlayer(name) {
    if (!playerStats[name]) {
      playerStats[name] = {
        name,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsConceded: 0,
        pointDiff: 0,
        clutchMatches: 0,
        clutchWins: 0,
        blowoutWins: 0,
        blowoutLosses: 0,
        recentResults: [],
        partners: {},
        opponents: {},
      };
    }
  }

  scoredRounds.forEach(r => {
    const scoreA = r.score_a;
    const scoreB = r.score_b;
    const teamA = r.team_a;
    const teamB = r.team_b;
    const diff = Math.abs(scoreA - scoreB);
    const isClutch = diff <= 2;
    const isBlowout = diff >= 6;

    const teamAWon = scoreA > scoreB;

    // Process Team A
    teamA.forEach(p => ensurePlayer(p));
    teamB.forEach(p => ensurePlayer(p));

    teamA.forEach(p => {
      const ps = playerStats[p];
      ps.matchesPlayed++;
      ps.pointsScored += scoreA;
      ps.pointsConceded += scoreB;
      ps.pointDiff += (scoreA - scoreB);
      if (teamAWon) {
        ps.wins++;
        ps.recentResults.push('W');
        if (isClutch) ps.clutchWins++;
        if (isBlowout) ps.blowoutWins++;
      } else {
        ps.losses++;
        ps.recentResults.push('L');
        if (isBlowout) ps.blowoutLosses++;
      }
      if (isClutch) ps.clutchMatches++;
    });

    teamB.forEach(p => {
      const ps = playerStats[p];
      ps.matchesPlayed++;
      ps.pointsScored += scoreB;
      ps.pointsConceded += scoreA;
      ps.pointDiff += (scoreB - scoreA);
      if (!teamAWon) {
        ps.wins++;
        ps.recentResults.push('W');
        if (isClutch) ps.clutchWins++;
        if (isBlowout) ps.blowoutWins++;
      } else {
        ps.losses++;
        ps.recentResults.push('L');
        if (isBlowout) ps.blowoutLosses++;
      }
      if (isClutch) ps.clutchMatches++;
    });

    // Partnerships
    function recordPartner(p1, p2, won, pFor, pAgainst) {
      if (!playerStats[p1].partners[p2]) {
        playerStats[p1].partners[p2] = { matches: 0, wins: 0, losses: 0, pFor: 0, pAgainst: 0 };
      }
      const part = playerStats[p1].partners[p2];
      part.matches++;
      if (won) part.wins++; else part.losses++;
      part.pFor += pFor;
      part.pAgainst += pAgainst;
    }

    recordPartner(teamA[0], teamA[1], teamAWon, scoreA, scoreB);
    recordPartner(teamA[1], teamA[0], teamAWon, scoreA, scoreB);
    recordPartner(teamB[0], teamB[1], !teamAWon, scoreB, scoreA);
    recordPartner(teamB[1], teamB[0], !teamAWon, scoreB, scoreA);

    // Opponents H2H
    function recordOpponent(p1, opp, won, pFor, pAgainst) {
      if (!playerStats[p1].opponents[opp]) {
        playerStats[p1].opponents[opp] = { matches: 0, wins: 0, losses: 0, pFor: 0, pAgainst: 0 };
      }
      const opps = playerStats[p1].opponents[opp];
      opps.matches++;
      if (won) opps.wins++; else opps.losses++;
      opps.pFor += pFor;
      opps.pAgainst += pAgainst;
    }

    teamA.forEach(p => {
      teamB.forEach(opp => {
        recordOpponent(p, opp, teamAWon, scoreA, scoreB);
      });
    });

    teamB.forEach(p => {
      teamA.forEach(opp => {
        recordOpponent(p, opp, !teamAWon, scoreB, scoreA);
      });
    });
  });

  console.log('\n--- PLAYER STATS SUMMARY ---');
  Object.values(playerStats).forEach(p => {
    const winRate = ((p.wins / (p.matchesPlayed || 1)) * 100).toFixed(1);
    const avgPts = (p.pointsScored / (p.matchesPlayed || 1)).toFixed(1);
    const clutchWinRate = p.clutchMatches > 0 ? ((p.clutchWins / p.clutchMatches) * 100).toFixed(1) : 'N/A';
    
    // Find best partner
    let bestPartner = 'None';
    let maxPartnerWins = -1;
    Object.entries(p.partners).forEach(([partName, pData]) => {
      if (pData.wins > maxPartnerWins) {
        maxPartnerWins = pData.wins;
        bestPartner = `${partName} (${pData.wins}W-${pData.losses}L, +${pData.pFor - pData.pAgainst} diff)`;
      }
    });

    // Find toughest opponent
    let toughestOpponent = 'None';
    let minOppWins = 999;
    Object.entries(p.opponents).forEach(([oppName, oData]) => {
      const oppWinRate = oData.losses / oData.matches; // times opp beat p
      if (oppWinRate > 0.5 && oData.matches >= 2) {
        toughestOpponent = `${oppName} (${oData.wins}W-${oData.losses}L)`;
      }
    });

    console.log(`\n👤 ${p.name.toUpperCase()}`);
    console.log(`   Matches: ${p.matchesPlayed} | W-L: ${p.wins}-${p.losses} (${winRate}%)`);
    console.log(`   Pts Scored: ${p.pointsScored} | Conceded: ${p.pointsConceded} | Diff: ${p.pointDiff > 0 ? '+' + p.pointDiff : p.pointDiff}`);
    console.log(`   Avg Pts/Match: ${avgPts} | Clutch Record: ${p.clutchWins}/${p.clutchMatches} (${clutchWinRate}%)`);
    console.log(`   Best Partner: ${bestPartner}`);
    console.log(`   Toughest Nemesis: ${toughestOpponent}`);
  });
}

runDeepAnalysis();
