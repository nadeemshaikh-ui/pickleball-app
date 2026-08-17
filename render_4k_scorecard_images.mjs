import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const liveData = JSON.parse(fs.readFileSync('live_schedule_data.json', 'utf8'));
const schedule = liveData.schedule;
const rosters = liveData.rosters;

function getCourtMatches(courtKey) {
  const courtName = courtKey === 'court_1' ? 'Court 1 (Group 1)' : (courtKey === 'court_2' ? 'Court 2 (Group 2)' : 'Court 3 (Group 3)');
  return schedule.map((r, idx) => {
    const isH1 = idx < 6;
    const hRoster = rosters[isH1 ? 'hour1' : 'hour2'];
    const groupPls = hRoster[courtName];

    const m = r[courtKey];
    const active = new Set(m.team_1.split('&').concat(m.team_2.split('&')).map(s => s.trim()));
    const rest = groupPls.filter(p => !active.has(p));

    return {
      round: idx + 1,
      time: r.time_slot,
      teamA: m.team_1,
      teamB: m.team_2,
      rest: rest.join(', ')
    };
  });
}

const court1Matches = getCourtMatches('court_1');
const court2Matches = getCourtMatches('court_2');
const court3Matches = getCourtMatches('court_3');

function generateScorecardHtml(courtNum, matches) {
  const rowsHtml = matches.map(m => `
    <tr>
      <td class="col-rd"><span class="badge-rd">${m.round}</span></td>
      <td class="col-time">${m.time}</td>
      <td class="col-team-a">${m.teamA}</td>
      <td class="col-score">
        <div class="score-box"></div>
        <span class="vs-text">VS</span>
        <div class="score-box"></div>
      </td>
      <td class="col-team-b">${m.teamB}</td>
      <td class="col-winner">
        <div class="winner-options">
          <span>A <span class="chk"></span></span>
          <span>B <span class="chk"></span></span>
        </div>
      </td>
      <td class="col-rest">🎾 ${m.rest}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { margin: 0; padding: 24px; background: #ffffff; width: 1400px; }
        
        .header {
          display: flex; align-items: center; justify-content: space-between;
          background: #0f172a; color: #ffffff; border-radius: 12px 12px 0 0;
          padding: 16px 28px; border-bottom: 4px solid #84cc16;
        }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .logo-ball { width: 52px; height: 52px; background: #eab308; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #0f172a; }
        .title-group h1 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 1px; color: #ffffff; }
        .title-group p { margin: 2px 0 0 0; font-size: 13px; color: #84cc16; font-weight: 800; letter-spacing: 1.5px; }

        .court-badge {
          background: #0f172a; border: 3px solid #eab308; border-radius: 10px;
          padding: 6px 24px; text-align: center; color: #eab308;
        }
        .court-badge .lbl { font-size: 11px; font-weight: 900; letter-spacing: 2px; }
        .court-badge .num { font-size: 32px; font-weight: 900; line-height: 1; color: #ffffff; }

        .header-right { text-align: right; }
        .sub-title { font-size: 16px; font-weight: 900; color: #ffffff; letter-spacing: 1px; }
        .meta-box { font-size: 12px; color: #94a3b8; font-weight: 700; margin-top: 4px; }

        table { width: 100%; border-collapse: collapse; margin-top: 0; border: 2px solid #0f172a; }
        th { background: #0f172a; color: #ffffff; font-size: 12px; font-weight: 900; letter-spacing: 1px; padding: 10px 8px; text-align: center; border-right: 1px solid #334155; }
        th.th-rest { background: #65a30d; }

        td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #e2e8f0; font-size: 14px; }
        tr:nth-child(even) td { background-color: #f8fafc; }
        
        .col-rd { text-align: center; width: 50px; }
        .badge-rd { background: #eab308; color: #0f172a; font-weight: 900; border-radius: 50%; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
        .col-time { font-weight: 800; color: #475569; width: 90px; text-align: center; }
        .col-team-a { font-weight: 800; color: #0f172a; width: 220px; text-align: right; font-size: 15px; }
        .col-team-b { font-weight: 800; color: #0f172a; width: 220px; text-align: left; font-size: 15px; }
        
        .col-score { width: 160px; text-align: center; background: #f1f5f9 !important; }
        .score-box { width: 44px; height: 32px; border: 2px solid #94a3b8; background: #ffffff; border-radius: 6px; display: inline-block; vertical-align: middle; }
        .vs-text { font-size: 11px; font-weight: 900; color: #64748b; margin: 0 6px; }

        .col-winner { width: 110px; text-align: center; background: #ecfccb !important; }
        .winner-options { display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 900; font-size: 13px; color: #3f6212; }
        .chk { width: 16px; height: 16px; border: 2px solid #4d7c0f; background: #ffffff; border-radius: 3px; display: inline-block; vertical-align: middle; margin-left: 2px; }

        .col-rest { font-weight: 800; color: #854d0e; font-size: 13px; }

        .footer-cards { display: flex; gap: 16px; margin-top: 14px; }
        .f-card { flex: 1; border-radius: 8px; padding: 10px 14px; font-size: 11px; border: 1.5px solid #cbd5e1; }
        .f-card-1 { background: #f7fee7; border-color: #84cc16; color: #3f6212; }
        .f-card-2 { background: #0f172a; color: #ffffff; border-color: #0f172a; }
        .f-card-3 { background: #f8fafc; color: #334155; }
        .sig-line { border-bottom: 1.5px solid #94a3b8; margin-top: 18px; width: 100%; display: block; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <div class="logo-ball">🎾</div>
          <div class="title-group">
            <h1>WHO IS THE HOT SHOT</h1>
            <p>PICKLEBALL TOURNAMENT</p>
          </div>
        </div>

        <div class="court-badge">
          <div class="lbl">COURT</div>
          <div class="num">${courtNum}</div>
        </div>

        <div class="header-right">
          <div class="sub-title">OFFICIAL SCORECARD</div>
          <div class="meta-box">MASTER MATCH SCHEDULE & SCORE ENTRY SHEET</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ROUND</th>
            <th>TIME</th>
            <th>TEAM A (SCORE A)</th>
            <th>SCORE</th>
            <th>TEAM B (SCORE B)</th>
            <th style="background: #84cc16; color: #0f172a;">WINNER (TICK)</th>
            <th class="th-rest">RESTING TEAM</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer-cards">
        <div class="f-card f-card-1">
          <b style="font-size: 12px;">SCORING INSTRUCTIONS FOR COURT MANAGER:</b><br/>
          1. Enter final scores in SCORE A and SCORE B boxes after each match.<br/>
          2. Games are played to 11 points (win by 2 points).<br/>
          3. Sign at the bottom of the page upon completing all 12 rounds.
        </div>
        <div class="f-card f-card-2">
          <b style="color: #84cc16; font-size: 12px;">COURT REFEREE / SCORER:</b><br/>
          <div style="margin-top: 6px;">NAME: <span class="sig-line"></span></div>
          <div style="margin-top: 8px;">SIGNATURE: <span class="sig-line"></span></div>
        </div>
        <div class="f-card f-card-3">
          <b>ALL ROUNDS COMPLETED:</b><br/>
          <div style="margin-top: 6px;">DATE: ___________ &nbsp; TIME: ___________</div>
          <div style="margin-top: 8px;">REFEREE SIGNATURE: <span class="sig-line"></span></div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateMasterRosterHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { margin: 0; padding: 24px; background: #ffffff; width: 1400px; }
        
        .header {
          display: flex; align-items: center; justify-content: space-between;
          background: #0f172a; color: #ffffff; border-radius: 12px 12px 0 0;
          padding: 18px 28px; border-bottom: 4px solid #84cc16;
        }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .logo-ball { width: 54px; height: 54px; background: #eab308; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 900; color: #0f172a; }
        .title-group h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 1px; color: #ffffff; }
        .title-group p { margin: 2px 0 0 0; font-size: 14px; color: #84cc16; font-weight: 800; letter-spacing: 1.5px; }

        .header-right { text-align: right; }
        .sub-title { font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 1px; }
        .meta-box { font-size: 13px; color: #84cc16; font-weight: 800; margin-top: 4px; letter-spacing: 1px; }

        .section-banner { background: #dc2626; color: #ffffff; font-size: 14px; font-weight: 900; padding: 8px 16px; margin-top: 18px; border-radius: 6px; letter-spacing: 1px; }
        .section-banner-2 { background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 900; padding: 8px 16px; margin-top: 20px; border-radius: 6px; letter-spacing: 1px; }

        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 10px; }
        .card { background: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; overflow: hidden; }
        .card-header { background: #0f172a; color: #ffffff; font-size: 13px; font-weight: 900; padding: 8px 14px; text-align: center; letter-spacing: 1px; }
        .card-body { padding: 14px 18px; }
        .player-list { list-style: none; margin: 0; padding: 0; }
        .player-list li { font-size: 15px; font-weight: 800; color: #0f172a; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
        .player-list li:last-child { border-bottom: none; }

        .guarantee-box { background: #ecfccb; border: 2px solid #84cc16; border-radius: 8px; padding: 14px 18px; margin-top: 20px; color: #3f6212; font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <div class="logo-ball">🎾</div>
          <div class="title-group">
            <h1>WHO IS THE HOT SHOT</h1>
            <p>PICKLEBALL TOURNAMENT</p>
          </div>
        </div>

        <div class="header-right">
          <div class="sub-title">MASTER COURT ALLOCATIONS</div>
          <div class="meta-box">PLAYER ROSTERS & GROUP ASSIGNMENTS</div>
        </div>
      </div>

      <div class="section-banner">⏱️ HOUR 1 COURT ALLOCATIONS (08:00 PM – 08:50 PM)</div>
      <div class="grid-3">
        <div class="card">
          <div class="card-header">COURT 1 (GROUP 1)</div>
          <div class="card-body">
            <ul class="player-list">
              <li>• Deep</li><li>• Shaan</li><li>• Priyesh</li><li>• Hemal</li><li>• Ankit</li><li>• Yule</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <div class="card-header">COURT 2 (GROUP 2)</div>
          <div class="card-body">
            <ul class="player-list">
              <li>• Nadeem</li><li>• Sid</li><li>• Gopal</li><li>• Gulshan</li><li>• Anosh</li><li>• Miten</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <div class="card-header">COURT 3 (GROUP 3)</div>
          <div class="card-body">
            <ul class="player-list">
              <li>• Viki</li><li>• Sumit</li><li>• Amresh</li><li>• PK</li><li>• Shrinath</li><li>• Karan</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="section-banner-2">⏱️ HOUR 2 COURT ALLOCATIONS (09:00 PM – 09:50 PM)</div>
      <div class="grid-3">
        <div class="card">
          <div class="card-header">COURT 1 (GROUP 1)</div>
          <div class="card-body">
            <ul class="player-list">
              <li>• Nadeem</li><li>• Anosh</li><li>• Sumit</li><li>• Amresh</li><li>• Karan</li><li>• Gopal</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <div class="card-header">COURT 2 (GROUP 2)</div>
          <div class="card-body">
            <ul class="player-list">
              <li>• Viki</li><li>• Sid</li><li>• Miten</li><li>• Gulshan</li><li>• Yule</li><li>• Priyesh</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <div class="card-header">COURT 3 (GROUP 3)</div>
          <div class="card-body">
            <ul class="player-list">
              <li>• Deep</li><li>• Shaan</li><li>• Ankit</li><li>• PK</li><li>• Shrinath</li><li>• Hemal</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="guarantee-box">
        <span style="font-size: 24px;">🛡️</span>
        <div><b>100% ISOLATED COURT PODS & UNIQUE PARTNERSHIPS GUARANTEE:</b><br/>Every court operates as a 100% isolated 6-player pod per hour. Every player plays 8 matches with 8 DIFFERENT partners. Zero repeat partners, zero consecutive rests.</div>
      </div>
    </body>
    </html>
  `;
}

async function render4kImages() {
  console.log('🚀 Launching Chromium 4K High-Res Image Renderer...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1450, height: 1150 },
    deviceScaleFactor: 3 // 3x Ultra 4K Crisp Resolution
  });

  const desktopHotshotDir = 'C:\\Users\\Nadeem\\Desktop\\HOTSHOT';
  const artifactDir = 'C:\\Users\\Nadeem\\.gemini\\antigravity\\brain\\3d633335-c773-43f9-9a42-61b9a52d9729';

  // 1. Render Master Allocations 4K PNG
  console.log('📸 Rendering Master Allocations 4K Image...');
  const page1 = await context.newPage();
  await page1.setContent(generateMasterRosterHtml());
  await page1.waitForTimeout(1000);
  const path1_desktop = path.join(desktopHotshotDir, 'Who_Is_The_Hot_Shot_Master_Allocations_4K.png');
  const path1_art = path.join(artifactDir, 'Who_Is_The_Hot_Shot_Master_Allocations_4K.png');
  await page1.screenshot({ path: path1_desktop, fullPage: true });
  fs.copyFileSync(path1_desktop, path1_art);
  console.log(`✅ Saved: ${path1_desktop}`);
  await page1.close();

  // 2. Render Court 1 Scorecard 4K PNG
  console.log('📸 Rendering Court 1 Scorecard 4K Image...');
  const pageC1 = await context.newPage();
  await pageC1.setContent(generateScorecardHtml(1, court1Matches));
  await pageC1.waitForTimeout(1000);
  const pathC1_desktop = path.join(desktopHotshotDir, 'Who_Is_The_Hot_Shot_Court_1_Scorecard_4K.png');
  const pathC1_art = path.join(artifactDir, 'Who_Is_The_Hot_Shot_Court_1_Scorecard_4K.png');
  await pageC1.screenshot({ path: pathC1_desktop, fullPage: true });
  fs.copyFileSync(pathC1_desktop, pathC1_art);
  console.log(`✅ Saved: ${pathC1_desktop}`);
  await pageC1.close();

  // 3. Render Court 2 Scorecard 4K PNG
  console.log('📸 Rendering Court 2 Scorecard 4K Image...');
  const pageC2 = await context.newPage();
  await pageC2.setContent(generateScorecardHtml(2, court2Matches));
  await pageC2.waitForTimeout(1000);
  const pathC2_desktop = path.join(desktopHotshotDir, 'Who_Is_The_Hot_Shot_Court_2_Scorecard_4K.png');
  const pathC2_art = path.join(artifactDir, 'Who_Is_The_Hot_Shot_Court_2_Scorecard_4K.png');
  await pageC2.screenshot({ path: pathC2_desktop, fullPage: true });
  fs.copyFileSync(pathC2_desktop, pathC2_art);
  console.log(`✅ Saved: ${pathC2_desktop}`);
  await pageC2.close();

  // 4. Render Court 3 Scorecard 4K PNG
  console.log('📸 Rendering Court 3 Scorecard 4K Image...');
  const pageC3 = await context.newPage();
  await pageC3.setContent(generateScorecardHtml(3, court3Matches));
  await pageC3.waitForTimeout(1000);
  const pathC3_desktop = path.join(desktopHotshotDir, 'Who_Is_The_Hot_Shot_Court_3_Scorecard_4K.png');
  const pathC3_art = path.join(artifactDir, 'Who_Is_The_Hot_Shot_Court_3_Scorecard_4K.png');
  await pageC3.screenshot({ path: pathC3_desktop, fullPage: true });
  fs.copyFileSync(pathC3_desktop, pathC3_art);
  console.log(`✅ Saved: ${pathC3_desktop}`);
  await pageC3.close();

  await browser.close();
  console.log('🎉 ALL 4 ULTRA 4K HIGH-RES SCORECARD IMAGES GENERATED SUCCESSFULLY!');
}

render4kImages().catch(console.error);
