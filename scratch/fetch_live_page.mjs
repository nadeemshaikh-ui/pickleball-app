async function run() {
  const url = 'https://pickleball-app-two.vercel.app/session/mw_mavericks_vs_hotshots_2026/team-championship/rapid-fire';
  console.log("Fetching live page content...");
  const res = await fetch(url);
  const text = await res.text();
  
  const hasClimax = text.includes('Overtime Climax');
  console.log(`Contains 'Overtime Climax': ${hasClimax}`);
  
  if (hasClimax) {
    const idx = text.indexOf('Overtime Climax');
    console.log("Snippet around text:");
    console.log(text.substring(idx - 200, idx + 500));
  }
}

run().catch(console.error);
