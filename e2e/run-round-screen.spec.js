// e2e/run-round-screen.spec.js (fix/run-round-screen) — the RUN round screen, presentational pins:
//   1. clock renders m:ss in Space Mono (never "28S" in Bungee — S/5 confusable), red under 6s
//   2. the message slot is FIXED: the input's top does not move (0px) across a reject, a RARE
//      toast, and the slot emptying again
//   3. the constraint is the hero: the fragment / letter / rule is ≥36px yellow Bungee
//   4. every accepted word toasts "WORD +N" (3 common words → 3 toasts; RARE! prefix when it applies)
//   5. the "ROUND-ADJUSTED SCORE vs WALL" filler line is gone
//   + the panel fits without scroll at 1366×768, and the input sits in the top ~500px at 390×844
//     (inside the visual viewport with a phone keyboard up).
// The save is seeded past the RUN's level gate (as run-mode.spec.js does). ?seed=1 rolls LONG for
// round 1 (6+ letters — every word below qualifies, and there's no fragment/letter constraint to
// dodge); ?rs=25 leaves time to type.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const URL = '/?portal=1&rs=25&seed=1';
const RARE_WORD = 'cupboard'; // rank 15,003 in words.recall.txt → the RARE band (≥ 15,000)
const COMMON = ['planet', 'garden', 'window']; // ranks 2,368 / 558 / 661 → COMMON (no prefix)

async function seedUnlocked(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch { /* ignore */ }
  });
}

async function enterRound(page) {
  await installBackendMock(page);
  await seedUnlocked(page);
  await page.goto(URL);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
  await expect(page.locator('.run-round-mode b')).toHaveText('LONG');
}

const inputTop = async (page) => (await page.locator('.run-input').boundingBox()).y;

test.describe('run round screen @ 1366×768', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('clock is m:ss in Space Mono; hero constraint; fixed message slot; WORD +N toasts; no filler line', async ({ page }) => {
    await enterRound(page);
    const input = page.locator('.run-input');
    const toast = page.locator('.run-toast');

    // 1. m:ss, Space Mono, tabular — and no trailing "S".
    const clock = page.locator('.run-clock');
    await expect(clock).toHaveText(/^\d:\d\d$/);
    const clockStyle = await clock.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { font: cs.fontFamily, color: cs.color };
    });
    expect(clockStyle.font).toMatch(/Space Mono/);
    expect(clockStyle.font).not.toMatch(/Bungee/);

    // 5. the filler line is gone.
    await expect(page.locator('.run-round')).not.toContainText('ROUND-ADJUSTED');

    // 3. the constraint is the hero (LONG: "6+ LETTERS") — a yellow Bungee TILE on the cream slab
    //    (feat/run-screen-slabs: the yellow moved from the glyph to the tile behind it).
    const frag = page.locator('.run-frag');
    await expect(frag).toContainText('LETTERS');
    const fragBox = await frag.boundingBox();
    expect(fragBox.height).toBeGreaterThanOrEqual(28);
    const heroStyle = await page.locator('.run-frag b').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { size: parseFloat(cs.fontSize), bg: cs.backgroundColor, font: cs.fontFamily };
    });
    expect(heroStyle.size).toBeGreaterThanOrEqual(44);
    expect(heroStyle.bg).toBe('rgb(255, 233, 74)'); // #FFE94A tile
    expect(heroStyle.font).toMatch(/Bungee/);

    // Slab grammar: the tilt lives on .slot wrappers only — no ancestor of the input carries a
    // transform or a running animation (the input must never be in a transformed subtree).
    const inputAncestors = await input.evaluate((el) => {
      const out = [];
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.transform !== 'none' || cs.animationName !== 'none') out.push(`${a.className}: ${cs.transform} / ${cs.animationName}`);
      }
      return out;
    });
    expect(inputAncestors).toEqual([]);

    // 2. the slot exists while silent, and the input never moves.
    await expect(toast).toHaveCount(1);
    const slotBox = await toast.boundingBox();
    expect(Math.round(slotBox.height)).toBe(22);
    const top0 = await inputTop(page);

    // a reject …
    await input.fill('zzzzzz');
    await input.press('Enter');
    await expect(toast).toHaveText('NOT A WORD');
    expect(await inputTop(page)).toBe(top0);
    // … which empties again (900ms) without moving anything
    await expect(toast).toHaveText('', { timeout: 3000 });
    expect(await inputTop(page)).toBe(top0);

    // a RARE toast …
    await input.fill(RARE_WORD);
    await input.press('Enter');
    await expect(toast).toHaveText(new RegExp(`^RARE! ${RARE_WORD.toUpperCase()} \\+\\d+$`));
    expect(await inputTop(page)).toBe(top0);
    await expect(toast).toHaveText('', { timeout: 3000 });
    expect(await inputTop(page)).toBe(top0);

    // 4. three common words → three "WORD +N" toasts (no prefix), each in the same slot.
    //    On each accept: ≤3 concurrent FINITE animations on the panel, and none infinite.
    let seen = 0;
    for (const w of COMMON) {
      await input.fill(w);
      await input.press('Enter');
      await expect(toast).toHaveText(new RegExp(`^${w.toUpperCase()} \\+\\d+$`));
      const anims = await page.locator('.run-round').evaluate((el) => el.getAnimations({ subtree: true }).map((a) => a.effect.getTiming().iterations));
      expect(anims.length).toBeLessThanOrEqual(3);
      expect(anims.filter((n) => n === Infinity)).toEqual([]);
      seen++;
      expect(await inputTop(page)).toBe(top0);
    }
    expect(seen).toBe(3);

    // The whole round panel fits the desktop viewport without a scrollbar.
    const fit = await page.evaluate(() => ({
      bodyScroll: document.body.scrollHeight, bodyClient: document.body.clientHeight,
      docScroll: document.documentElement.scrollHeight, inner: window.innerHeight,
    }));
    expect(fit.docScroll).toBeLessThanOrEqual(fit.inner);
    expect(fit.bodyScroll).toBeLessThanOrEqual(fit.inner);
  });

  test('clock turns red under 6 seconds (class swap)', async ({ page }) => {
    await installBackendMock(page);
    await seedUnlocked(page);
    await page.goto('/?portal=1&rs=7&seed=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });
    await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
    await page.locator('.run-btn-go').click();
    const clock = page.locator('.run-clock');
    await expect(clock).toHaveText('0:07');
    await expect(clock).not.toHaveClass(/low/);
    await expect(clock).toHaveText('0:05', { timeout: 5000 });
    await expect(clock).toHaveClass(/low/);
    const color = await clock.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 75, 75)'); // #FF4B4B
  });
});

test.describe('run round screen @ 390×844 (phone)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('no page scroll, and the input sits inside the keyboard-up visual viewport', async ({ page }) => {
    await enterRound(page);
    const box = await page.locator('.run-input').boundingBox();
    const fit = await page.evaluate(() => ({ docScroll: document.documentElement.scrollHeight, inner: window.innerHeight }));
    expect(fit.docScroll).toBeLessThanOrEqual(fit.inner);
    // A phone keyboard takes ~330px of an 844px viewport → the visual viewport is ~510px tall.
    // The input (and everything above it: clock, meter, hero constraint, message slot) must
    // sit inside that, so typing never needs a scroll.
    expect(box.y + box.height).toBeLessThanOrEqual(510);
    // The hero tile is ≥34px on the phone (feat/run-screen-slabs: 34px at ≤560).
    const size = await page.locator('.run-frag b').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(34);
  });
});
