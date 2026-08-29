import { test } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// JOB 9 — a NEW visitor's first 60s at 390x844 with cleared storage. No portal skip,
// no seeded state: the real splash → real first-run menu, in order.
test.use({ viewport: { width: 390, height: 844 } });

test('stranger first-run flow', async ({ page }) => {
  test.setTimeout(90000);
  await installBackendMock(page);
  // Genuinely empty storage (fresh context already is, but be explicit).
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });

  const shot = async (n) => { await page.screenshot({ path: `claude/stranger/${n}.png` }); };

  // 1) First paint — the real splash (no ?portal=1).
  await page.goto('/');
  await page.waitForTimeout(1200);
  await shot('01-first-paint');

  // 2) A few seconds in (splash animation / whatever a stranger stares at).
  await page.waitForTimeout(2500);
  await shot('02-splash-3s');

  // 3) The gesture a stranger makes: tap/click to proceed (also starts music).
  await page.mouse.click(195, 600);
  await page.waitForTimeout(1500);
  await shot('03-after-tap');

  // 4) Try to reach the menu by dismissing the splash if still up.
  try { await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 6000 }); } catch { /* */ }
  await page.waitForTimeout(800);
  await shot('04-menu-firstrun');

  // 5) A stranger types on the menu (the caption says "TYPE ANYWHERE TO EARN XP").
  await page.keyboard.type('hello', { delay: 90 });
  await page.waitForTimeout(600);
  await shot('05-typed-on-menu');

  // 6) They tap the first, biggest card (WORD BOMB).
  try {
    await page.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch { /* */ }
  await shot('06-first-card');

  // 7) 60s mark — whatever is on screen after they poke around.
  await page.waitForTimeout(1500);
  await shot('07-poking');
});
