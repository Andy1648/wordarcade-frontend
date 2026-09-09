// e2e/run-share.spec.js (feat/run-share) — THE RUN's over screen offers COPY RESULT (+ the image
// SHARE bar), and the copied text is the exact receipt: brand line, ROUND n/10 · N BANKED, one glyph
// per round, HAND: …, and the /run deep link. Also: a 0-round run (died on round 1) shows NO share.
// Seeded past the RUN level gate (as run-round-screen.spec.js); ?seed=1 rolls LONG for round 1.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const WORDS = [
  'planet', 'garden', 'window', 'silver', 'orange', 'bottle', 'candle', 'jacket',
  'pencil', 'rabbit', 'forest', 'island', 'castle', 'bridge', 'monkey', 'yellow',
];

async function openWall(page, url) {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch { /* ignore */ }
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto(url);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
}

test('over screen: COPY RESULT + SHARE bar; the clipboard text is the exact receipt', async ({ page, context }) => {
  test.setTimeout(60_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openWall(page, '/?portal=1&rs=5&seed=1');

  // ROUND 1: clear wall 80 (16 six-letter words), draft one card.
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
  const pickedName = (await page.locator('.run-offers .run-card .run-card-name').first().textContent()).trim();
  await page.locator('.run-offers .run-card').first().click();

  // ROUND 2: type nothing → die → RUN OVER.
  await expect(page.locator('.run-wall')).toBeVisible();
  const banked = (await page.locator('.run-banked b').textContent()).trim();
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-over')).toBeVisible({ timeout: 12000 });

  // The share cluster is there: COPY RESULT + SHARE / IMAGE (no second COPY).
  const copyBtn = page.locator('.run-share .copy-result-btn');
  await expect(copyBtn).toBeVisible();
  await expect(copyBtn).toHaveText('COPY RESULT');
  await expect(page.locator('.run-share .share-bar .share-btn')).toHaveCount(2);

  await copyBtn.click();
  await expect(copyBtn).toHaveText('COPIED!');
  // The OS clipboard may hand LF back as CRLF (Windows does) — normalise before comparing lines.
  const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  expect(lines[0]).toBe('TYPE A WORD — THE RUN');
  expect(lines[1]).toBe(`ROUND 2/10 · ${banked} BANKED`);
  expect(lines[2]).toMatch(/^[🟩🟨]⬛$/u); // round 1 cleared (or squeaked), round 2 ended it
  expect(lines[3]).toBe(`HAND: ${pickedName.toUpperCase()}`);
  expect(lines[4]).toBe(`${new URL(page.url()).origin}/run?ref=share`);
  expect(lines.length).toBe(5);
});

test('a 0-round run (died on round 1) shows no share at all', async ({ page }) => {
  await openWall(page, '/?portal=1&rs=3&seed=1');
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-over')).toBeVisible({ timeout: 12000 });
  await expect(page.locator('.run-share')).toHaveCount(0);
  await expect(page.locator('.copy-result-btn')).toHaveCount(0);
});
