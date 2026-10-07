// e2e/v2-chain-hud.spec.js — P10 10c CHAIN HUD (claude/mockups/v2/Chain.dc.html, VERSION B; claude/SEASON2-QUEUE.md):
// "chain stacks up the left, huge next letter, wins/word column on the right. Keep today's CHAIN texture quality."
//
//   * SEASON2: the card wears data-hud="v2" and keeps the wall surface; the next letter is the chromatic LayeredWord
//     stack, huge, in the middle; an accepted word lands ON TOP of the tower on the left, its join letters lit; the
//     right column says the live WINS / WORD and every factor of it on its own line (the same perWordRateNow the
//     payout reads), and THIS CHAIN's banked wins;
//   * the clock bar burns down once armed; the typed word is drawn big;
//   * four sizes: no scrollbars, no text < 13 px, nothing loops, nothing leaves the card;
//   * flag OFF: the live CHAIN screen is untouched.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function chain(page, { season2 = true, vp = { width: 1366, height: 657 }, reduce = false, teach = false } = {}) {
  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await installBackendMock(page);
  await page.addInitScript(({ reduce, teach }) => {
    if (sessionStorage.getItem('ch2.seeded')) return;
    sessionStorage.setItem('ch2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    // the first-run teach shows a word valid for the letter on screen — the tests' answer key
    if (!teach) localStorage.setItem('taw.seenTeach.chain', '1');
    localStorage.setItem('taw.reduceMotion', reduce ? '1' : '0');
  }, { reduce, teach });
  await page.goto(`/?chain=1&portal=1${season2 ? '&season2=1' : ''}`);
  await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible' });
  return page.locator('.solo-root input').first();
}

test('SEASON2 CHAIN: tower on the left, huge letter in the middle, WINS / WORD column on the right', async ({ page }) => {
  test.setTimeout(60_000);
  const input = await chain(page, { teach: true });
  const root = page.locator('.solo-root');
  await expect(root).toHaveAttribute('data-hud', 'v2');
  await expect(root).toHaveClass(/wall-surface/); // today's texture stays
  // the letter: the chromatic stack, big
  const tile = page.locator('.ch2-tile');
  await expect(tile.locator('.lw')).toHaveCount(1);
  const tb = await tile.boundingBox();
  expect(tb.height).toBeGreaterThan(page.viewportSize().height * 0.19); // (the first-run teach strip shares the column)
  const letter = ((await page.locator('.ch2-hint b').innerText()) || '').trim();
  expect(letter).toMatch(/^[A-Z]$/);
  // empty tower before the first link
  await expect(page.locator('.ch2-link.is-ghost')).toHaveText('FIRST LINK');
  // the right column: the live rate + its lines (base + every non-×1 factor, CHAIN MODE among them)
  await expect(page.locator('.ch2-pay-k')).toHaveText('WINS / WORD');
  await expect(page.locator('.ch2-rate')).toHaveText(/^\+\d/);
  await expect(page.locator('.ch2-row--base')).toContainText('BASE');
  await expect(page.locator('.ch2-row--mode')).toContainText('CHAIN MODE');
  // columns: tower left of the letter, pay right of it
  const lb = await page.locator('.ch2-left').boundingBox();
  const rb = await page.locator('.ch2-right').boundingBox();
  expect(lb.x + lb.width).toBeLessThanOrEqual(tb.x + 1);
  expect(rb.x).toBeGreaterThanOrEqual(tb.x + tb.width - 1);
  // play a real link (the teach example) → it lands on the tower, join letters lit, the letter moves on
  const word = (await page.locator('.teach-strip-eg-word').innerText()).trim().toLowerCase();
  await input.fill(word);
  await expect(page.locator('.sv2-typed')).toHaveText(word.toUpperCase());
  await expect(page.locator('.sv2-typed b')).toHaveText(word.slice(0, 1).toUpperCase());
  await input.press('Enter');
  const top = page.locator('.ch2-stack .ch2-link').first();
  await expect(top).toHaveText(word.toUpperCase());
  await expect(top.locator('.cx-join').last()).toHaveText(word.slice(-1).toUpperCase());
  await expect(page.locator('.ch2-links-n')).toHaveText('1');
  await expect(page.locator('.ch2-hint b')).toHaveText(word.slice(-1).toUpperCase());
  // the clock burns down once armed
  await input.fill('q');
  await page.waitForTimeout(800);
  const sx = await page.locator('.ch2-clock-fill').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(sx).toBeLessThan(1);
  expect(sx).toBeGreaterThan(0.5);
  // nothing old
  await expect(page.locator('.solo-hero')).toHaveCount(0);
  await expect(page.locator('.solo-chain')).toHaveCount(0);
});

test('SEASON2 CHAIN under REDUCE MOTION: renders, nothing in the HUD animates', async ({ page }) => {
  test.setTimeout(60_000);
  const input = await chain(page, { reduce: true });
  await input.fill('q');
  await page.waitForTimeout(400);
  const n = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.ch2')).length);
  expect(n).toBe(0);
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`SEASON2 CHAIN @${vp.width}x${vp.height}: no scrollbars, no text < 13 px, nothing loops, all in the card`, async ({ page }) => {
    test.setTimeout(60_000);
    const input = await chain(page, { vp });
    await input.fill('q');
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
      const small = [...document.querySelectorAll('.ch2 *')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && /[a-z0-9]/i.test(x.textContent)))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => `${el.className}`);
      const infinite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.ch2')).length;
      const root = document.querySelector('.solo-root').getBoundingClientRect();
      const out = [...document.querySelectorAll('.ch2-tile, .ch2-rate, .ch2-row, .ch2-this, .ch2-step, .solo-input, .ch2-link')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > root.bottom + 1 || r.right > root.right + 1 || r.left < root.left - 1 || r.top < root.top - 1; }).map((el) => el.className);
      return { h: de.scrollWidth > de.clientWidth, v: de.scrollHeight > de.clientHeight, small, infinite, out };
    });
    expect(m.h).toBe(false);
    expect(m.v).toBe(false);
    expect(m.small).toEqual([]);
    expect(m.infinite).toBe(0);
    expect(m.out).toEqual([]);
  });
}

test('flag OFF: the live CHAIN screen is untouched', async ({ page }) => {
  test.setTimeout(60_000);
  await chain(page, { season2: false });
  await expect(page.locator('.solo-root')).not.toHaveAttribute('data-hud', /.+/);
  await expect(page.locator('.ch2')).toHaveCount(0);
  await expect(page.locator('.solo-hero')).toBeVisible();
  await expect(page.locator('.solo-chain')).toBeVisible();
});
