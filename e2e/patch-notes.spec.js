// e2e/patch-notes.spec.js — THE PATCH NOTES popup (Andy oct11): a RETURNING player meets it once per release, after the
// knife-split; COLLECT pays exactly the "= N FREE ROLLS" it shows (N × the live roll price) into the wallet; PLAY closes;
// a reload never shows it again. A first-time visitor sees it too, once the menu spotlight is done (Andy oct12). Nothing overflows at 1280×600 or 360×740.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { PATCH_GIFT_ROLLS } from '../src/components/patchNotes/patchNotesData.js';
import { expectNoLayoutDefects } from './support/overlap.js';

const S2_ROLL_PRICE = 75; // v3/econ.js ROLL_PRICE

async function boot(page, w, h, returning = true, brandNew = false) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page, { patchNotes: true, freshReveal: brandNew });
  await page.addInitScript(({ ret, brandNew }) => {
    if (sessionStorage.getItem('pn.seeded')) return;
    sessionStorage.setItem('pn.seeded', '1');
    // the first-run reveal (progress/reveal.js) holds the notes until GEARS open; every test here but the last is a
    // player past that point
    if (!brandNew) localStorage.setItem('taw.reveal', 'all');
    if (ret) {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    }
  }, { ret: returning, brandNew });
  await page.goto('/?portal=1&season2=1');
}
const wallet = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0);

for (const [w, h] of [[1280, 600], [360, 740]]) {
  test(`PATCH NOTES at ${w}x${h}: once, pays what it shows, fits`, async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page, w, h);
    const pn = page.getByTestId('patch-notes');
    await expect(pn).toBeVisible({ timeout: 15_000 });
    const gift = PATCH_GIFT_ROLLS * S2_ROLL_PRICE;
    await expect(page.getByTestId('patch-notes-gems')).toHaveText(String(gift));
    await expect(pn).toContainText(`= ${PATCH_GIFT_ROLLS} FREE ROLLS`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll').toBe(true);
    const btn = await page.getByTestId('patch-notes-collect').boundingBox();
    expect(btn.y + btn.height, 'COLLECT is on screen').toBeLessThanOrEqual(h);
    const before = await wallet(page);
    await page.getByTestId('patch-notes-collect').click();
    await expect(pn).toHaveAttribute('data-phase', 'done', { timeout: 10_000 });
    expect(await wallet(page)).toBe(before + gift);
    await page.getByTestId('patch-notes-collect').click();
    await expect(pn).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(4000);
    await expect(pn).toHaveCount(0);
    expect(await wallet(page)).toBe(before + gift);
  });
}

test('PATCH NOTES: ✕ still pays the gift; the UPDATE LOG tile re-opens it without paying again', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, 1280, 720);
  await expect(page.getByTestId('patch-notes')).toBeVisible({ timeout: 15_000 });
  const before = await wallet(page);
  await page.getByTestId('patch-notes-close').click();
  await expect(page.getByTestId('patch-notes')).toHaveCount(0);
  const paid = before + PATCH_GIFT_ROLLS * S2_ROLL_PRICE;
  expect(await wallet(page)).toBe(paid);
  // Andy oct12: the top-right UPDATE LOG tile shows the notes again — the gift reads COLLECTED, the button CLOSE
  await page.locator('[data-nav="news"]').click();
  const pn = page.getByTestId('patch-notes');
  await expect(pn).toBeVisible();
  await expect(pn).toContainText('COLLECTED');
  await page.getByTestId('patch-notes-collect').click();
  await expect(pn).toHaveCount(0);
  expect(await wallet(page)).toBe(paid);
});

test('PATCH NOTES: a click OUTSIDE the panel closes it (and still pays, once)', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, 1280, 720);
  await expect(page.getByTestId('patch-notes')).toBeVisible({ timeout: 15_000 });
  const before = await wallet(page);
  await page.getByTestId('patch-notes').click({ position: { x: 1260, y: 700 } }); // the scrim corner
  await expect(page.getByTestId('patch-notes')).toHaveCount(0);
  expect(await wallet(page)).toBe(before + PATCH_GIFT_ROLLS * S2_ROLL_PRICE);
});

test('PATCH NOTES: a first-time visitor gets it too — after the menu spotlight', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, 1280, 720, false);
  await page.waitForTimeout(3500);
  await expect(page.getByTestId('patch-notes')).toHaveCount(0); // never over the first-run spotlight
  await page.keyboard.press('a'); // TYPE ANYTHING = XP: the first key dismisses tour step 1
  // tour step 2 (PLAY GAMES = WINS, Andy oct14) follows; the notes still wait for it
  await expect(page.locator('.spotlight-caption-text')).toHaveText('PLAY GAMES = WINS', { timeout: 5_000 });
  await expect(page.getByTestId('patch-notes')).toHaveCount(0);
  await page.waitForTimeout(800); // past step 2's input hold
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('patch-notes')).toBeVisible({ timeout: 15_000 });
});

test('PATCH NOTES: a BRAND-NEW save does not get them on the title — they wait for the gears reveal', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, 1280, 720, true, true);
  await expect(page.locator('.tp-play')).toBeVisible({ timeout: 10_000 }); // stage 0: the TITLE
  await page.waitForTimeout(5000);
  await expect(page.getByTestId('patch-notes')).toHaveCount(0);
  await expect(page.locator('[data-nav="news"]')).toHaveCount(0);
});

// OVERLAP AUDIT (oct29): on a phone COLLECT was position:sticky over the scrolling notes, cutting rows in half under it
// ("GUARANTEED ROLLS…" at 390, "15 NEW GEARS…" at 360). The notes scroll inside the sheet now and COLLECT sits under
// that region: nothing overlaps it, at the top of the list or scrolled to the end, and it is on screen.
for (const [w, h] of [[390, 844], [360, 640], [1280, 600]]) {
  test(`@${w}x${h} overlap audit: COLLECT never sits over the notes`, async ({ page }) => {
    await boot(page, w, h);
    const pn = page.getByTestId('patch-notes');
    await expect(pn).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1200); // the rows' one-shot rise
    await expectNoLayoutDefects(expect, page, `patch notes ${w}x${h} (top)`, { scope: '[data-testid="patch-notes"]' });
    await page.evaluate(() => { const s = document.querySelector('.pn-scroll'); if (s) s.scrollTop = s.scrollHeight; });
    await page.waitForTimeout(200);
    await expectNoLayoutDefects(expect, page, `patch notes ${w}x${h} (end)`, { scope: '[data-testid="patch-notes"]' });
    const btn = await page.getByTestId('patch-notes-collect').boundingBox();
    expect(btn.y + btn.height, 'COLLECT is on screen').toBeLessThanOrEqual(h);
  });
}
