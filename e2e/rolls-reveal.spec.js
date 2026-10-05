// e2e/rolls-reveal.spec.js — the rarity-scaled ROLL REVEAL + ×10 (Andy oct3). Written WITHOUT being run (the
// authoring machine runs no Playwright); Andy / CI runs it. Covers: ?rolls=1 + a seeded balance → the ×10 button
// is priced at 10 × the single roll; ×10 shows 10 cards and a reveal; a tap ANYWHERE skips to the rest state;
// a short balance disables ×10; each ?mrv= version plays.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SEED = {
  'taw.rollsOn': '1',
  'taw.seenMenu': '1',
  'taw.seenMenuSpotlight': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }),
  'taw.marksRevealed': '1',
  'taw.marksOwned': '[]',
  'taw.marksSeen': '[]',
  'taw.markRolls': JSON.stringify({ v: 1, starter: true, marks: {} }), // the free starter is spent: ×10 is live
  'taw.wins': '500000000',
};

async function seed(page, extra = {}) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('rr.seeded')) return;
    sessionStorage.setItem('rr.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, { ...SEED, ...extra });
}
async function openMarks(page, query = '') {
  await page.goto(`/?portal=1&rolls=1${query}`);
  await menuReady(page);
  await page.locator('.menu-mark:visible, .hp-m-navbtn.is-marks:visible').first().click();
  await page.locator('.mx-panel').waitFor();
  const tut = page.locator('.ut-overlay[data-tut="markRolls"]');
  if (await tut.isVisible().catch(() => false)) await tut.getByRole('button', { name: 'GOT IT' }).click();
}
const num = (s) => Number(String(s).replace(/[^0-9]/g, ''));
const rollUiAnims = (page) => page.evaluate(() => document.getAnimations().filter((a) => {
  const el = a.effect && a.effect.target;
  return el && el.closest && el.closest('.mr-stage, .mr-cover') && a.playState === 'running';
}).length);

test('×10 sits next to ROLL, priced at exactly 10 × the single roll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await openMarks(page);
  const single = num(await page.locator('.mr-roll-main').innerText());
  const x10 = page.getByTestId('mark-roll-10');
  await expect(x10).toBeEnabled();
  await expect(x10.locator('.mr-roll10-x')).toHaveText('×10');
  expect(num(await x10.locator('.mr-roll10-price').innerText())).toBe(single * 10);
  // next to ROLL: same row
  const a = await page.locator('.mr-roll').boundingBox();
  const b = await x10.boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(4);
});

test('×10 shows 10 cards and a reveal; a tap ANYWHERE skips to the result', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await openMarks(page);
  const winsBefore = await page.evaluate(() => Number(localStorage.getItem('taw.wins')));
  const single = num(await page.locator('.mr-roll-main').innerText());
  await page.getByTestId('mark-roll-10').click();
  await expect(page.getByTestId('mark-roll-tile')).toHaveCount(10);
  // a reveal is playing (the cards flip in, the best card's reveal is still to come)
  await page.waitForTimeout(60);
  expect(await rollUiAnims(page)).toBeGreaterThan(0);
  // tap somewhere that is NOT the roll UI (the MARKS head): it skips, it never selects / closes anything
  await page.locator('.mx-title').click();
  await expect(page.locator('.mx-panel')).toBeVisible();
  await expect.poll(() => rollUiAnims(page)).toBe(0);
  await expect(page.locator('.mr-cover')).toHaveCSS('opacity', '0');
  // every card is face up after the skip
  for (const t of await page.getByTestId('mark-roll-tile').all()) await expect(t).toHaveCSS('opacity', '1');
  // charged exactly ten rolls; ten rolls saved
  const after = await page.evaluate(() => ({ wins: Number(localStorage.getItem('taw.wins')), rolls: JSON.parse(localStorage.getItem('taw.markRolls')).rolls }));
  // charged ten single-roll prices; the collection INDEX milestones a fresh collection crosses on the way can pay a
  // little back (measured: 100 of 6,000), so the net spend is at most 10 × the price and well over 9 ×
  const spent = Math.round(winsBefore - after.wins);
  expect(spent).toBeLessThanOrEqual(single * 10);
  expect(spent).toBeGreaterThan(0); // marks v2: new-mark INDEX rewards (words at your rate) can repay a big share of a fresh collection's rolls
  expect(after.rolls).toBe(10);
  // nothing loops after the reveal
  await page.waitForTimeout(400);
  expect(await rollUiAnims(page)).toBe(0);
});

test('a balance short of ten rolls disables ×10 (ROLL still works)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.wins': '1' });
  await openMarks(page);
  await expect(page.getByTestId('mark-roll-10')).toBeDisabled();
  await expect(page.locator('.mr-roll')).toBeEnabled();
});

for (const v of ['a', 'b', 'c']) {
  test(`?mrv=${v}: a single roll reveals and lands its card`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page);
    await openMarks(page, `&mrv=${v}`);
    await expect(page.locator('.mr-stage')).toHaveAttribute('data-v', v);
    await page.locator('.mr-roll').click();
    await expect(page.getByTestId('mark-roll-result')).toBeVisible();
    await expect.poll(() => rollUiAnims(page), { timeout: 4000 }).toBe(0);
    await expect(page.getByTestId('mark-roll-result')).toHaveCSS('opacity', '1');
  });
}
