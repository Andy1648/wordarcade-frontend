// _playthrough.spec.js — JOB F: a scripted ~realistic session that screenshots every state
// transition for a narrative UX review. REPORT ONLY (no assertions gate this). Mobile viewport
// (390×844) since mobile is the design priority. Seeds LV30 + wins so every mode is unlocked and
// the shop is affordable. Shots → claude/playthrough/NN-name.png. Run:
//   npx playwright test _playthrough --workers=1
import { test } from '@playwright/test';

const DIR = 'claude/playthrough';
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);

test.use({ viewport: { width: 390, height: 844 } });

test('30-min playthrough — screenshot every state', async ({ page }) => {
  test.setTimeout(180_000);
  let n = 0;
  const shot = async (name) => {
    n += 1;
    try { await page.screenshot({ path: `${DIR}/${String(n).padStart(2, '0')}-${name}.png` }); } catch (e) { console.log('shot fail', name, e.message); }
  };
  const step = async (name, fn) => { try { await fn(); await page.waitForTimeout(400); await shot(name); console.log('OK', name); } catch (e) { console.log('STEP FAIL', name, e.message.slice(0, 100)); await shot(`FAIL-${name}`); } };

  await page.addInitScript(() => {
    try {
      localStorage.setItem('wa_last_seen', String(Date.now()));
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 }));
      localStorage.setItem('taw.wins', '9999999');
    } catch { /* ignore */ }
  });

  // 1. Cold menu
  page.setDefaultTimeout(9000); // per-action cap so one stuck interaction can't eat the whole test
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(600);
  await shot('menu-cold');

  // 2. Menu typing (XP lane)
  await step('menu-after-typing', async () => {
    await page.locator('body').click();
    for (const ch of 'railway teapot voyage') { await page.keyboard.type(ch); await page.waitForTimeout(35); }
  });

  // 3. SHOP overlay + scroll
  await step('shop-open', async () => { await page.locator('.homepage-nav-btn.is-shop').click({ force: true }); await page.locator('.shop-wrap, .shop-screen, [class*="shop"]').first().waitFor({ state: 'visible', timeout: 8000 }); });
  await step('shop-scrolled', async () => { await page.mouse.wheel(0, 900); });
  await step('back-from-shop', async () => { await page.keyboard.press('Escape'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 8000 }); });

  // 4. STATS overlay
  await step('stats-open', async () => { await page.locator('.homepage-nav-btn.is-stats').click({ force: true }); await page.waitForTimeout(600); });
  await step('back-from-stats', async () => { await page.keyboard.press('Escape'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 8000 }); });

  // 5. Mode dialogs
  await step('dialog-word-bomb', async () => { await card(page, 'word-bomb').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 8000 }); });
  await step('back-wb', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); });
  await step('dialog-blitz-packpicker', async () => { await card(page, 'category-blitz').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 8000 }); });
  await step('back-blitz', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); });
  await step('dialog-chain', async () => { await card(page, 'chain').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 8000 }); });
  await step('back-chain', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); });
  await step('dialog-fuse', async () => { await card(page, 'fuse').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 8000 }); });

  // 6. FUSE in-game (PLAY from the open fuse dialog)
  await step('fuse-ingame', async () => { await page.locator('.mode-dialog-btn-create').click(); await page.waitForTimeout(1500); });
  await step('fuse-after-input', async () => { await page.keyboard.type('fireman'); await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.waitForTimeout(600); });
  await step('back-to-menu-1', async () => { await page.goto('/?portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 15000 }); });

  // 7. CHAIN in-game
  await step('chain-ingame', async () => { await card(page, 'chain').click(); await page.locator('.mode-dialog-btn-create').click(); await page.waitForTimeout(1500); });
  await step('back-to-menu-2', async () => { await page.goto('/?portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 15000 }); });

  // 8. SAT RUSH (card → straight in)
  await step('satrush-ingame', async () => { await card(page, 'sat-rush').click(); await page.waitForTimeout(1800); });
  await step('satrush-later', async () => { await page.waitForTimeout(2500); });
  await step('back-to-menu-3', async () => { await page.goto('/?portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 15000 }); });

  // 9. Credits
  await step('credits', async () => { await page.locator('.homepage-credits-link').click(); await page.locator('.credits-wrap').waitFor({ state: 'visible', timeout: 8000 }); });

  // 10. Word Bomb CREATE → lobby (multiplayer path start)
  await step('back-to-menu-4', async () => { await page.goto('/?portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 15000 }); });
  await step('wb-lobby', async () => { await card(page, 'word-bomb').click(); await page.locator('.mode-dialog-btn-create').click(); await page.locator('.lobby-wrap').waitFor({ state: 'visible', timeout: 10000 }); });

  console.log(`DONE — ${n} screenshots in ${DIR}`);
});
