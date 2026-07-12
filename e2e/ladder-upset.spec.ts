import { test, expect } from '@playwright/test';

// Directly targets resolveLadderChallenge() (lib/ladderStandings.ts) — the
// code this session's real bug fix lives in (rung movement was previously
// dead code, never wired into score-saving). Fixture: rung 1+2 (better)
// vs rung 3+4 (worse), seeded via create-test-session.mjs with scores left
// null. This spec enters the score through the real Play page so the
// upset actually fires resolveLadderChallenge() the way a real match would,
// then confirms the rung swap landed on /league/ladder.

const LADDER_SESSION_ID = 'e2e-ladder-fixture-session';

test('scoring a real upset swaps ladder rungs via the live Play page', async ({ page }) => {
  await page.goto(`/session/${LADDER_SESSION_ID}/play`);
  await expect(page.getByRole('heading', { name: 'Live Scoring' })).toBeVisible();

  const match = page.locator('.match-box').first();
  const scoreInputs = match.locator('.score-input');
  // team_a (rung 1+2, "better") loses, team_b (rung 3+4, "worse") wins — upset.
  await scoreInputs.nth(0).fill('5');
  await scoreInputs.nth(1).fill('11');
  await scoreInputs.nth(1).blur();
  await expect(scoreInputs.nth(1)).toHaveValue('11', { timeout: 10000 });

  // Rung movement is applied by the apply_ladder_after_score DB trigger,
  // same transaction as the score save above — give it a moment to be
  // queryable, then check the result on the real ladder page.
  await page.waitForTimeout(1000);
  await page.goto('/league/ladder');
  await expect(page.getByRole('heading', { name: 'Ladder League' })).toBeVisible();

  // Rung 1 should now be held by one of the upset winners (C or D), not the
  // original rung-1 player (A) — confirms the swap actually persisted via
  // the apply_ladder_after_score trigger, not just a client-side message
  // with no DB write behind it. Whoever's listed first on the standings
  // page (sorted by rung ascending) is the new rung-1 holder.
  const standingsText = await page.locator('main').innerText();
  const firstLadderPlayerIndex = Math.min(
    ...['E2E Ladder A', 'E2E Ladder B', 'E2E Ladder C', 'E2E Ladder D'].map(n => {
      const i = standingsText.indexOf(n);
      return i === -1 ? Infinity : i;
    })
  );
  const newRung1 = ['E2E Ladder A', 'E2E Ladder B', 'E2E Ladder C', 'E2E Ladder D'].find(n => standingsText.indexOf(n) === firstLadderPlayerIndex);
  expect(['E2E Ladder C', 'E2E Ladder D']).toContain(newRung1);
});
