import json
import os
import subprocess

def build_pdf():
    with open('tournament_dump.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    session = data['session']
    rounds = data['rounds']
    rf_logs = data['rfLogs']

    squad1 = session['squads'][0] # Home Team
    squad2 = session['squads'][1] # Challengers
    squad1_name = squad1.get('label') or 'Home Team'
    squad2_name = squad2.get('label') or 'Challengers'

    squad1_players = set(squad1['players'])
    squad2_players = set(squad2['players'])

    # 1. Parse Session-wise Player Points
    player_session_stats = {}
    for p in session['players']:
        sq_name = squad1_name if p in squad1_players else squad2_name
        player_session_stats[p] = {
            'name': p,
            'squad': sq_name,
            's1Wins': 0, 's1Pts': 0,
            's2Wins': 0, 's2Pts': 0,
            's3Wins': 0, 's3Pts': 0,
            'totalWeightedPts': 0
        }

    # Also track overall match stats (PW, PL, etc.)
    player_overall = {}
    for p in session['players']:
        sq_name = squad1_name if p in squad1_players else squad2_name
        player_overall[p] = {
            'name': p,
            'squad': sq_name,
            'gp': 0,
            'wins': 0,
            'losses': 0,
            'pw': 0,
            'pl': 0
        }

    for r in rounds:
        score_a = r.get('score_a')
        score_b = r.get('score_b')
        if score_a is None or score_b is None:
            continue

        r_num = r['round_number']
        stage_num = 1 if r_num <= 5 else 2 if r_num <= 10 else 3
        weight = 1 if stage_num == 1 else 2 if stage_num == 2 else 3
        a_won = score_a > score_b

        # Team A players
        for p in r['team_a']:
            if p in player_overall:
                player_overall[p]['gp'] += 1
                player_overall[p]['pw'] += score_a
                player_overall[p]['pl'] += score_b
                if a_won:
                    player_overall[p]['wins'] += 1
                else:
                    player_overall[p]['losses'] += 1

        # Team B players
        for p in r['team_b']:
            if p in player_overall:
                player_overall[p]['gp'] += 1
                player_overall[p]['pw'] += score_b
                player_overall[p]['pl'] += score_a
                if not a_won:
                    player_overall[p]['wins'] += 1
                else:
                    player_overall[p]['losses'] += 1

        winners = r['team_a'] if a_won else r['team_b']
        for p in winners:
            if p in player_session_stats:
                if stage_num == 1:
                    player_session_stats[p]['s1Wins'] += 1
                    player_session_stats[p]['s1Pts'] += 1
                elif stage_num == 2:
                    player_session_stats[p]['s2Wins'] += 1
                    player_session_stats[p]['s2Pts'] += 2
                elif stage_num == 3:
                    player_session_stats[p]['s3Wins'] += 1
                    player_session_stats[p]['s3Pts'] += 3
                player_session_stats[p]['totalWeightedPts'] += weight

    session_leaderboard = sorted(player_session_stats.values(), key=lambda x: x['totalWeightedPts'], reverse=True)
    overall_leaderboard = sorted(player_overall.values(), key=lambda x: (x['wins'], x['pw'] - x['pl']), reverse=True)

    # 2. Parse Rapid Fire Logs into Shifts
    rf_player_stats = {}
    for p in session['players']:
        sq_name = squad1_name if p in squad1_players else squad2_name
        rf_player_stats[p] = {
            'name': p,
            'squad': sq_name,
            'pts': 0,
            'rallies': 0,
            'isClutch': p in ['Sumeet', 'Vinit', 'Nadeem', 'Viki', 'Amresh', 'Sid']
        }

    rf_shifts = []
    current_key = ''
    current_group = []
    for l in rf_logs:
        on_court = l.get('on_court_players') or []
        for p in on_court:
            if p in rf_player_stats:
                rf_player_stats[p]['rallies'] += 1
                if (p in squad1_players and l['scoring_team_id'] == 'team1') or (p in squad2_players and l['scoring_team_id'] == 'team2'):
                    rf_player_stats[p]['pts'] += 1

        pkey = ','.join(on_court)
        if pkey != current_key and current_group:
            rf_shifts.append(current_group)
            current_group = []
        current_key = pkey
        current_group.append(l)
    if current_group:
        rf_shifts.append(current_group)

    parsed_shifts = []
    cum_t1, cum_t2 = 0, 0
    for idx, g in enumerate(rf_shifts):
        players = g[0].get('on_court_players') or []
        t1_pair = ' & '.join(players[0:2])
        t2_pair = ' & '.join(players[2:4])
        t1_p = sum(1 for ev in g if ev['scoring_team_id'] == 'team1')
        t2_p = sum(1 for ev in g if ev['scoring_team_id'] == 'team2')
        cum_t1 += t1_p
        cum_t2 += t2_p
        parsed_shifts.append({
            'shiftNum': idx + 1,
            't1Pair': t1_pair,
            't2Pair': t2_pair,
            't1Pts': t1_p,
            't2Pts': t2_p,
            'cumT1': cum_t1,
            'cumT2': cum_t2,
            'isOT': idx >= 20
        })

    rf_player_leaderboard = sorted(rf_player_stats.values(), key=lambda x: x['pts'], reverse=True)

    # Build HTML content
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tournament Official Report - {session['group_name']}</title>
<style>
  @page {{
    size: A4;
    margin: 15mm 15mm 15mm 15mm;
  }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.5;
    font-size: 12px;
  }}
  h1, h2, h3, h4 {{
    margin: 0;
    font-weight: 800;
    letter-spacing: -0.3px;
  }}
  .header-card {{
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #ffffff;
    padding: 24px;
    border-radius: 12px;
    margin-bottom: 20px;
    text-align: center;
  }}
  .badge-winner {{
    display: inline-block;
    background: #eab308;
    color: #000000;
    font-weight: 900;
    font-size: 11px;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 20px;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }}
  .title {{
    font-size: 26px;
    font-weight: 900;
    margin-bottom: 4px;
  }}
  .subtitle {{
    font-size: 13px;
    color: #94a3b8;
    margin-bottom: 16px;
  }}
  .score-banner {{
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30px;
    background: rgba(255,255,255,0.06);
    padding: 14px;
    border-radius: 10px;
  }}
  .team-box {{
    text-align: center;
  }}
  .team-name {{
    font-size: 13px;
    font-weight: 700;
    color: #cbd5e1;
  }}
  .team-score {{
    font-size: 32px;
    font-weight: 900;
  }}
  .winner-score {{ color: #10b981; }}
  
  .section {{
    margin-bottom: 24px;
    page-break-inside: avoid;
  }}
  .section-title {{
    font-size: 16px;
    color: #0f172a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 12px;
  }}
  th {{
    background: #f8fafc;
    color: #475569;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
    padding: 8px 10px;
    border-bottom: 2px solid #cbd5e1;
    text-align: left;
  }}
  td {{
    padding: 7px 10px;
    border-bottom: 1px solid #e2e8f0;
  }}
  tr:nth-child(even) {{ background: #f8fafc; }}
  
  .text-center {{ text-align: center; }}
  .text-right {{ text-align: right; }}
  .font-bold {{ font-weight: 700; }}
  .text-green {{ color: #10b981; font-weight: 700; }}
  .text-red {{ color: #ef4444; font-weight: 700; }}
  
  .pill-pd {{
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 800;
    font-size: 10px;
  }}
  .pill-pos {{ background: rgba(16, 185, 129, 0.15); color: #047857; }}
  .pill-neg {{ background: rgba(239, 68, 68, 0.15); color: #b91c1c; }}
  
  .ot-row {{
    background: #fffbeb !important;
    border-left: 3px solid #f59e0b;
  }}

  .page-break {{
    page-break-before: always;
  }}
</style>
</head>
<body>

  <!-- COVER HEADER -->
  <div class="header-card">
    <div class="badge-winner">🏆 TOURNAMENT CHAMPIONS: {squad2_name}</div>
    <div class="title">{session['group_name']} — OFFICIAL STATS REPORT</div>
    <div class="subtitle">Format: Team Championship (3 Stage Sessions + Rapid Fire Finale) | Date: July 27–29, 2026</div>

    <div class="score-banner">
      <div class="team-box">
        <div class="team-name">{squad1_name}</div>
        <div class="team-score">33 pts</div>
      </div>
      <div style="font-size: 20px; font-weight: 800; color: #64748b;">VS</div>
      <div class="team-box">
        <div class="team-name">{squad2_name}</div>
        <div class="team-score winner-score">35 pts 👑</div>
      </div>
    </div>
  </div>

  <!-- SECTION 1: SESSION-BY-SESSION PLAYER POINTS -->
  <div class="section">
    <div class="section-title">
      <span>📊 Session-by-Session Player Points Breakdown</span>
      <span style="font-size: 11px; font-weight: 600; color: #64748b;">Stage Weights: S1 (1x) | S2 (2x) | S3 (3x)</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 30px;" class="text-center">Rank</th>
          <th>Player Name</th>
          <th>Squad</th>
          <th class="text-center">Session 1 (1x)</th>
          <th class="text-center">Session 2 (2x)</th>
          <th class="text-center">Session 3 (3x)</th>
          <th class="text-center">Total Weighted Pts</th>
        </tr>
      </thead>
      <tbody>
"""
    for idx, p in enumerate(session_leaderboard):
        html += f"""
        <tr>
          <td class="text-center font-bold">{idx + 1}</td>
          <td class="font-bold">{p['name']}</td>
          <td>{p['squad']}</td>
          <td class="text-center">{p['s1Wins']}W ({p['s1Pts']}pt)</td>
          <td class="text-center">{p['s2Wins']}W ({p['s2Pts']}pt)</td>
          <td class="text-center">{p['s3Wins']}W ({p['s3Pts']}pt)</td>
          <td class="text-center font-bold" style="color: #d97706; font-size: 12px;">{p['totalWeightedPts']} pts</td>
        </tr>
"""
    html += """
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 2: RAPID FIRE FINALE ANALYSIS -->
  <div class="section">
    <div class="section-title">
      <span>🔥 Rapid Fire Finale Analysis (Final: 35 – 33)</span>
      <span style="font-size: 11px; font-weight: 600; color: #64748b;">23 Shifts | 68 Total Rallies</span>
    </div>

    <!-- Rapid Fire Player Stats Table -->
    <h4 style="margin-bottom: 8px; color: #334155;">Rapid Fire Individual Player Performance</h4>
    <table>
      <thead>
        <tr>
          <th style="width: 30px;" class="text-center">#</th>
          <th>Player Name</th>
          <th>Squad</th>
          <th class="text-center">On-Court Points</th>
          <th class="text-center">Rallies Played</th>
          <th class="text-center">Scoring Efficiency %</th>
          <th class="text-center">Role</th>
        </tr>
      </thead>
      <tbody>
"""
    for idx, p in enumerate(rf_player_leaderboard):
        eff = (p['pts'] / p['rallies'] * 100) if p['rallies'] > 0 else 0
        role_tag = '<span style="color: #d97706; font-weight: 800;">⚡ Overtime Hero</span>' if p['isClutch'] else 'Squad Rotator'
        html += f"""
        <tr>
          <td class="text-center font-bold">{idx + 1}</td>
          <td class="font-bold">{p['name']}</td>
          <td>{p['squad']}</td>
          <td class="text-center text-green">{p['pts']}</td>
          <td class="text-center">{p['rallies']}</td>
          <td class="text-center font-bold">{eff:.0f}%</td>
          <td class="text-center">{role_tag}</td>
        </tr>
"""
    html += f"""
      </tbody>
    </table>

    <!-- Complete 23 Shift Match Log -->
    <h4 style="margin: 16px 0 8px 0; color: #334155;">Complete Shift-by-Shift Match Log (All 23 Rotations)</h4>
    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 50px;">Shift</th>
          <th>{squad1_name} Pair</th>
          <th>{squad2_name} Pair</th>
          <th class="text-center">Shift Score</th>
          <th class="text-center">Running Total</th>
        </tr>
      </thead>
      <tbody>
"""
    for s in parsed_shifts:
        ot_class = 'class="ot-row"' if s['isOT'] else ''
        ot_badge = '⚡ OT ' if s['isOT'] else ''
        html += f"""
        <tr {ot_class}>
          <td class="text-center font-bold">{ot_badge}#{s['shiftNum']}</td>
          <td class="font-bold">{s['t1Pair']}</td>
          <td class="font-bold">{s['t2Pair']}</td>
          <td class="text-center font-bold">{s['t1Pts']} – {s['t2Pts']}</td>
          <td class="text-center font-bold" style="color: #2563eb;">{s['cumT1']} – {s['cumT2']}</td>
        </tr>
"""
    html += """
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 3: OVERALL PLAYER STATS & MATCH RECORDS -->
  <div class="section">
    <div class="section-title">
      <span>🏆 Overall Player Performance & Match Statistics</span>
      <span style="font-size: 11px; font-weight: 600; color: #64748b;">All 15 Stage Matches Included</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 30px;" class="text-center">#</th>
          <th>Player Name</th>
          <th>Squad</th>
          <th class="text-center">Matches (GP)</th>
          <th class="text-center">W – L</th>
          <th class="text-center">Win %</th>
          <th class="text-center">Points Won (PW)</th>
          <th class="text-center">Points Lost (PL)</th>
          <th class="text-center">Point Diff (PD)</th>
        </tr>
      </thead>
      <tbody>
"""
    for idx, p in enumerate(overall_leaderboard):
        win_pct = (p['wins'] / p['gp'] * 100) if p['gp'] > 0 else 0
        pd = p['pw'] - p['pl']
        pd_class = 'pill-pos' if pd > 0 else 'pill-neg' if pd < 0 else ''
        pd_sign = '+' if pd > 0 else ''
        html += f"""
        <tr>
          <td class="text-center font-bold">{idx + 1}</td>
          <td class="font-bold">{p['name']}</td>
          <td>{p['squad']}</td>
          <td class="text-center">{p['gp']}</td>
          <td class="text-center font-bold"><span class="text-green">{p['wins']}W</span>–<span class="text-red">{p['losses']}L</span></td>
          <td class="text-center font-bold">{win_pct:.0f}%</td>
          <td class="text-center text-green">{p['pw']}</td>
          <td class="text-center text-red">{p['pl']}</td>
          <td class="text-center"><span class="pill-pd {pd_class}">{pd_sign}{pd}</span></td>
        </tr>
"""
    html += """
      </tbody>
    </table>
  </div>

  <!-- SECTION 4: FULL ROUND-BY-ROUND STAGE FIXTURES -->
  <div class="section">
    <div class="section-title">
      <span>📋 Complete Round-by-Round Stage Fixtures & Scores</span>
      <span style="font-size: 11px; font-weight: 600; color: #64748b;">Rounds 1 to 15 Breakdown</span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 50px;">Round</th>
          <th class="text-center" style="width: 50px;">Court</th>
          <th>Team A Pair</th>
          <th class="text-center">Score A</th>
          <th class="text-center">Score B</th>
          <th>Team B Pair</th>
          <th class="text-center">Winner Pair</th>
        </tr>
      </thead>
      <tbody>
"""
    sorted_rounds = sorted(rounds, key=lambda x: (x['round_number'], x['court']))
    for r in sorted_rounds:
        sa = r.get('score_a')
        sb = r.get('score_b')
        if sa is None or sb is None:
            continue
        a_won = sa > sb
        winner_pair = ' & '.join(r['team_a']) if a_won else ' & '.join(r['team_b'])
        r_num = r['round_number']
        stage_tag = f"S{1 if r_num <= 5 else 2 if r_num <= 10 else 3}"
        html += f"""
        <tr>
          <td class="text-center font-bold">{stage_tag}-R{r_num}</td>
          <td class="text-center">C{r['court']}</td>
          <td>{' & '.join(r['team_a'])}</td>
          <td class="text-center font-bold {'text-green' if a_won else ''}">{sa}</td>
          <td class="text-center font-bold {'text-green' if not a_won else ''}">{sb}</td>
          <td>{' & '.join(r['team_b'])}</td>
          <td class="font-bold text-green">{winner_pair}</td>
        </tr>
"""
    html += """
      </tbody>
    </table>
  </div>

  <footer style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
    Generated by Pickleball Atelier Operating System | Official Certified Tournament Record
  </footer>

</body>
</html>
"""

    with open('tournament_report.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print('Saved tournament_report.html successfully!')

    # Print to PDF using Headless Chrome
    pdf_filename = 'Home_Team_vs_Challengers_Tournament_Report.pdf'
    chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    html_abs_path = os.path.abspath('tournament_report.html')
    pdf_abs_path = os.path.abspath(pdf_filename)

    cmd = [
        chrome_path,
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--print-to-pdf-no-header',
        f'--print-to-pdf={pdf_abs_path}',
        html_abs_path
    ]

    print('Generating PDF via Headless Chrome...')
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f'SUCCESS! PDF created at: {pdf_abs_path}')
    else:
        print(f'PDF generation failed: {res.stderr}')

if __name__ == '__main__':
    build_pdf()
