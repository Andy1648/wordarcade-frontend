// e2e/run-stranger.spec.js (integration/run-stack-2) — the whole STRANGER path, once, on fresh
// storage: real splash → THE RUN (free, unlocked at LV1) → round 1 on wall 80 → the draft →
// die on round 2 → RUN AGAIN (fresh run, no menu) → leave → the menu shows the run's wins
// (chip == the over-screen "+N"), level ≥ 8 (the run's own XP clears its LV8 gate), and the
// RUN card is NOT locked even though the free run is spent.
// Exercises, in one walk: fix/onramp-2 (free run), fix/run-payout (XP + wins), feat/run-gameover-2
// (RUN AGAIN), fix/run-wall-2 (wall 80), fix/run-round-modes (LONG via ?seed=1), fix/run-round-screen.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// No ?portal — the real splash plays. ?rs=5 shortens rounds; ?seed=1 rolls LONG for round 1 (6+
// letters: every word below qualifies, no fragment/letter constraint to dodge).
const URL = '/?rs=5&seed=1';
const WORDS = [
  'planet', 'garden', 'window', 'silver', 'orange', 'bottle', 'candle', 'jacket',
  'pencil', 'rabbit', 'forest', 'island', 'castle', 'bridge', 'monkey', 'yellow',
];

test('stranger path: splash → free RUN → wall 80 → draft → die → RUN AGAIN → leave → paid + unlocked', async ({ page }) => {
  test.setTimeout(60_000);
  await installBackendMock(page);
  await page.goto(URL);

  // SPLASH (fresh storage) — any click dismisses it and the intro wipes to the menu.
  const splash = page.locator('.splash-screen');
  await expect(splash).toBeVisible({ timeout: 15000 });
  await splash.click();
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 20000 });
  // The clean-URL router strips every non-sticky query at boot (only ?portal / ?cg / the SAT dev
  // flags survive), so on the REAL splash path the run's ?rs / ?seed dev overrides are gone by
  // the time the run mounts (random mode, 30s rounds). Re-apply them here: the run view is
  // transient (no canonical path), so a query set at the menu survives into the run.
  await page.evaluate((q) => window.history.replaceState(window.history.state, '', q), URL);

  // THE RUN is the hero card and is PLAYABLE at LV1 (free first run).
  const runCard = page.locator('.game-card-magnet[data-game="run"] .game-card');
  await expect(runCard).toBeVisible();
  await expect(runCard).not.toHaveClass(/locked/);
  await runCard.click({ trial: true, timeout: 15000 }); // wait out the intro overlay
  await runCard.click({ force: true });

  // ROUND 1 on WALL 80.
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.run-wall-num')).toHaveText('80');
  await expect(page.locator('.run-stack-count')).toHaveText('0');
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
  await expect(page.locator('.run-clock')).toHaveText(/^\d:\d\d$/); // the m:ss clock
  const input = page.locator('.run-input');
  const toast = page.locator('.run-toast');
  let accepted = 0;
  for (const w of WORDS) {
    await input.fill(w);
    await input.press('Enter');
    // every accept toasts "WORD +N"
    await expect(toast).toHaveText(new RegExp(`${w.toUpperCase()} \\+\\d+`));
    accepted++;
  }
  expect(accepted).toBe(WORDS.length);

  // THE DRAFT is seen on the free run (16 six-letter words clear wall 80 comfortably).
  await expect(page.locator('.run-draft')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.run-offers .run-card')).toHaveCount(3);
  await page.locator('.run-offers .run-card').first().click();

  // ROUND 2: type nothing → die on the wall → RUN OVER.
  await expect(page.locator('.run-wall')).toBeVisible();
  await expect(page.locator('.run-stack-count')).toHaveText('1');
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-over')).toBeVisible({ timeout: 12000 });
  const shownWins = parseInt((await page.locator('.run-over-stat-wins b').textContent()).replace(/[^0-9]/g, ''), 10);
  expect(shownWins).toBeGreaterThan(0);
  const banked = await page.evaluate(() => Number(localStorage.getItem('taw.wins')));
  expect(banked).toBe(shownWins);

  // RUN AGAIN: a fresh run in place — round 1, empty stack — with no menu round-trip.
  await page.locator('.run-over .run-btn-again').click();
  await expect(page.locator('.run-wall')).toBeVisible();
  await expect(page.locator('.run-btn-go')).toHaveText('START ROUND 1');
  await expect(page.locator('.run-stack-count')).toHaveText('0');
  await expect(page.locator('.game-card-magnet[data-game="run"]')).toHaveCount(0);

  // LEAVE (the ✕) → the menu.
  await page.locator('.run-exit').click();
  const chip = page.locator('.menu-wins-chip');
  await expect(chip).toBeVisible({ timeout: 15000 });
  await expect(chip).toHaveAttribute('aria-label', new RegExp(`^${shownWins} wins`));

  // The run's own XP carried LV1 past the LV8 gate, so the spent free run does NOT lock the card.
  const save = await page.evaluate(() => ({
    lv: JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv,
    freeUsed: localStorage.getItem('taw.runFreeUsed'),
  }));
  expect(save.freeUsed).toBe('1');
  expect(save.lv).toBeGreaterThanOrEqual(8);
  await expect(page.locator('.game-card-magnet[data-game="run"] .game-card')).not.toHaveClass(/locked/);
});
