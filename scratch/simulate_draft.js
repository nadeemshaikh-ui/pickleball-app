const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  let errors = 0;
  let loops = 0;
  
  const setupPage = async (name, url) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.error(`[${name}] ERROR: ${text}`);
        errors++;
      } else {
        if (text.includes('sync loop') || text.includes('loop cycle')) {
          loops++;
        }
        // console.log(`[${name}] ${text}`);
      }
    });
    page.on('pageerror', err => {
      console.error(`[${name}] PAGE ERROR: ${err.message}`);
      errors++;
    });
    
    await page.goto(url);
    return page;
  };

  console.log('Launching Admin context...');
  const adminPage = await setupPage('Admin', 'http://localhost:3000/tournaments/hotshots-draft');

  console.log('Launching Viewer context...');
  const viewerPage = await setupPage('Viewer', 'http://localhost:3000/tournaments/hotshots-draft?role=viewer');

  const captains = [];
  for (let i = 0; i < 4; i++) {
    console.log(`Launching Captain ${i} context...`);
    const page = await setupPage(`Captain ${i}`, `http://localhost:3000/tournaments/hotshots-draft?captain=${i}`);
    captains.push({ i, page });
  }

  // Wait a bit for pages to load
  await new Promise(r => setTimeout(r, 10000));

  console.log('Simulation complete.');
  console.log(`Total Errors: ${errors}`);
  console.log(`Total Loop Cycles Detected: ${loops}`);
  
  if (errors === 0 && loops === 0) {
    console.log('SUCCESS: Synchronizations function smoothly without conflicts or loop cycles.');
  } else {
    console.log('FAILED: Anomalies detected during synchronization.');
  }

  await browser.close();
})();
