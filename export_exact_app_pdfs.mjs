import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function generateExactAppPdfs() {
  console.log('🚀 Launching Playwright Chromium High-DPI Renderer...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1600 },
    deviceScaleFactor: 2 // 2x Retina High DPI Vector Quality
  });

  const page = await context.newPage();
  const liveUrl = 'https://pickleball-app-two.vercel.app/watch/HOTSHOTS-OPT1-AQ31NK';

  console.log(`🌐 Navigating to ${liveUrl}...`);
  await page.goto(liveUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const desktopDir = 'C:\\Users\\Nadeem\\Desktop';
  const artifactDir = 'C:\\Users\\Nadeem\\.gemini\\antigravity\\brain\\3d633335-c773-43f9-9a42-61b9a52d9729';

  // Inject print styles so the app cards render in 100% full detail with exact colors
  await page.addStyleTag({
    content: `
      @media print {
        body {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .card {
          background-color: #1e293b !important;
          border: 1px solid #334155 !important;
          box-shadow: none !important;
          break-inside: avoid;
        }
      }
    `
  });

  // 1. PDF 1: Court Allocations & Rosters (Exact App Design)
  console.log('📄 Exporting PDF 1: Court Allocations & Rosters (Exact App Design)...');
  const rostersPdfDesktop = path.join(desktopDir, 'Hotshots_Court_Allocation_Rosters_AppDesign.pdf');
  const rostersPdfArtifact = path.join(artifactDir, 'Hotshots_Court_Allocation_Rosters_AppDesign.pdf');

  // Hide schedule & standings cards temporarily for PDF 1
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      const cards = main.querySelectorAll('.card');
      cards.forEach((c, idx) => {
        if (idx > 1) c.style.display = 'none';
      });
    }
  });

  await page.pdf({
    path: rostersPdfDesktop,
    format: 'Letter',
    printBackground: true,
    scale: 0.95,
    margin: { top: '24px', bottom: '24px', left: '24px', right: '24px' }
  });
  fs.copyFileSync(rostersPdfDesktop, rostersPdfArtifact);
  console.log(`✅ Exported: ${rostersPdfDesktop}`);

  // Reload page to restore full DOM
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // 2. PDF 2: 12-Round Match Schedule & Standings Table (Exact App Design)
  console.log('📄 Exporting PDF 2: Match Schedule & Standings Table (Exact App Design)...');
  const schedulePdfDesktop = path.join(desktopDir, 'Hotshots_12_Round_Match_Schedule_AppDesign.pdf');
  const schedulePdfArtifact = path.join(artifactDir, 'Hotshots_12_Round_Match_Schedule_AppDesign.pdf');

  // Hide rosters card temporarily for PDF 2 so it starts right from standings & schedule
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) {
      const cards = main.querySelectorAll('.card');
      if (cards.length > 1) {
        cards[1].style.display = 'none';
      }
    }
  });

  await page.pdf({
    path: schedulePdfDesktop,
    format: 'Letter',
    landscape: true,
    printBackground: true,
    scale: 0.85,
    margin: { top: '24px', bottom: '24px', left: '24px', right: '24px' }
  });
  fs.copyFileSync(schedulePdfDesktop, schedulePdfArtifact);
  console.log(`✅ Exported: ${schedulePdfDesktop}`);

  await browser.close();
  console.log('🎉 ALL EXACT APP DESIGN PDFs EXPORTED SUCCESSFULLY!');
}

generateExactAppPdfs().catch(console.error);
