// e2e/hierarchy.spec.js (fix/hierarchy) — one primary action per screen.
//   MENU: exactly one .game-card-band (THE RUN's "▶ PLAY" strip); the JOIN ROOM slab is gone and
//         joining is a footer text link beside CREDITS that still reaches the room browser.
//   OVER: exactly one .run-btn-again, sitting ABOVE the single ghost .run-share-row, with the
//         round-glyph row between the tiles and the hand, and a "leave to menu" text link last.
// Seeded past the RUN level gate (as run-round-screen.spec.js); ?seed=1 rolls LONG for round 1.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const WORDS = [
  'planet', 'garden', 'window', 'silver', 'orange', 'bottle', 'candle', 'jacket',
  'pencil', 'rabbit', 'forest', 'island', 'castle', 'bridge', 'monkey', 'yellow',
];

async function bootMenu(page, url = '/?portal=1') {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch { /* ignore */ }
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto(url);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
}

test('menu: exactly one card band (THE RUN, "▶ PLAY"), no JOIN slab, footer join link works', async ({ page }) => {
  await bootMenu(page);
  const band = page.locator('.game-card-band');
  await expect(band).toHaveCount(1);
  await expect(band).toHaveText('▶ PLAY'); // LV31 is past the gate → no FREE RUN suffix
  expect(await page.locator('.game-card-magnet[data-game="run"] .game-card-band').count()).toBe(1);
  const style = await band.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, font: cs.fontFamily, size: parseFloat(cs.fontSize), top: cs.borderTopWidth };
  });
  expect(style.bg).toBe('rgb(255, 233, 74)');
  expect(style.font).toMatch(/Bungee/);
  expect(style.size).toBe(14);
  expect(style.top).toBe('3px');

  // The slab is gone; the footer carries JOIN ROOM as a text link beside CREDITS.
  await expect(page.locator('.homepage-bottom-bar')).toHaveCount(0);
  await expect(page.locator('.homepage-btn-join')).toHaveCount(0);
  const join = page.locator('.homepage-footer-links .homepage-join-link');
  await expect(join).toHaveText('HAVE A CODE? JOIN ROOM');
  await expect(page.locator('.homepage-footer-links .homepage-credits-link')).toHaveText('CREDITS');
  await join.click();
  await expect(page.getByRole('button', { name: /←\s*BACK/ })).toBeVisible();
});

test('menu: a fresh account below the gate sees "▶ PLAY — FREE RUN"; a spent freebie locks (no band)', async ({ page }) => {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 1, into: 0 })); } catch { /* ignore */ }
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await expect(page.locator('.game-card-band')).toHaveText('▶ PLAY — FREE RUN');
  await page.evaluate(() => localStorage.setItem('taw.runFreeUsed', '1'));
  await page.reload();
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await expect(page.locator('.game-card-magnet[data-game="run"] .game-card')).toHaveClass(/locked/);
  await expect(page.locator('.game-card-band')).toHaveCount(0);
});

test('over screen: tiles → glyphs → hand → one RUN AGAIN above one ghost share row → leave link', async ({ page }) => {
  test.setTimeout(60_000);
  await bootMenu(page, '/?portal=1&rs=5&seed=1');
  await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
  const input = page.locator('.run-input');
  const toast = page.locator('.run-toast');
  for (const w of WORDS) {
    await input.fill(w);
    await input.press('Enter');
    await expect(toast).toHaveText(new RegExp(`${w.toUpperCase()} \\+\\d+`));
  }
  await expect(page.locator('.run-draft')).toBeVisible({ timeout: 15000 });
  await page.locator('.run-offers .run-card').first().click();
  await expect(page.locator('.run-wall')).toBeVisible();
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-over')).toBeVisible({ timeout: 12000 });

  const again = page.locator('.run-over .run-btn-again');
  await expect(again).toHaveCount(1);
  const row = page.locator('.run-over .run-share-row');
  await expect(row).toHaveCount(1);
  // Ghost row = the three quiet buttons, in one line.
  await expect(row.locator('button')).toHaveCount(3);
  await expect(row.locator('.copy-result-btn')).toHaveText('COPY RESULT');

  const [a, r, panel, glyphs, tiles, hand, leave] = await Promise.all([
    again.boundingBox(), row.boundingBox(), page.locator('.run-over').boundingBox(),
    page.locator('.run-glyphs').boundingBox(), page.locator('.run-over-stats').boundingBox(),
    page.locator('.run-over-hand-wrap').boundingBox(), page.locator('.run-btn-leave').boundingBox(),
  ]);
  expect(a.y + a.height).toBeLessThanOrEqual(r.y + 1); // RUN AGAIN sits above the share row
  expect(tiles.y).toBeLessThan(glyphs.y);
  expect(glyphs.y).toBeLessThan(hand.y);
  expect(hand.y).toBeLessThan(a.y);
  expect(r.y).toBeLessThan(leave.y);
  // RUN AGAIN is the one primary: full width, yellow, 22px Bungee.
  expect(a.width).toBeGreaterThanOrEqual(panel.width - 60);
  const s = await again.evaluate((el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, size: parseFloat(cs.fontSize) }; });
  expect(s.bg).toBe('rgb(255, 233, 74)');
  expect(s.size).toBe(22);
  // The glyph row: round 1 cleared/squeaked, round 2 ended it.
  await expect(page.locator('.run-glyph')).toHaveCount(2);
  await expect(page.locator('.run-glyph').nth(1)).toHaveText('⬛');
  // The leave control is a text link (no slab) that still returns to the menu.
  const leaveStyle = await page.locator('.run-btn-leave').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(leaveStyle).toBe('rgba(0, 0, 0, 0)');
  await page.locator('.run-btn-leave').click();
  await expect(page.getByRole('img', { name: 'Type a Word' })).toBeVisible();
});
