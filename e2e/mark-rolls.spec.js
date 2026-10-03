// e2e/mark-rolls.spec.js — MARK ROLLS UI (Andy M + H3). Written on feat/mark-rolls-ui WITHOUT being run (the
// machine was memory-starved that day); Andy runs it. Covers: open MARKS → the ROLL tutorial → roll once →
// a result card + % COLLECTED rises; reduced motion shows a static card (no reveal animation); the worn
// mark reads MAIN ×N; each reveal version (?mrv=a|b|c) leaves no infinite animation behind.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SEED = {
  'taw.seenMenu': '1',
  'taw.seenMenuSpotlight': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }),
  'taw.marksRevealed': '1',
  'taw.marksOwned': '[]',
  'taw.marksSeen': '[]',
  'taw.wins': '50000000',
};

async function seed(page, extra = {}) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('mr.seeded')) return;
    sessionStorage.setItem('mr.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, { ...SEED, ...extra });
}
async function openMarks(page) {
  // desktop: the menu's mark chip; phone (≤480px): the MARKS nav button
  await page.locator('.menu-mark:visible, .hp-m-navbtn.is-marks:visible').first().click();
  await page.locator('.mx-panel').waitFor();
}
const collected = (page) => page.locator('[data-testid="marks-collected"]').getAttribute('data-pct').then(Number);

for (const v of ['a', 'b', 'c']) {
  test(`roll once (?mrv=${v}): result card, % COLLECTED rises, nothing loops after`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page);
    await page.goto(`/?portal=1&mrv=${v}`);
    await menuReady(page);
    await openMarks(page);

    // the one-time tutorial points at ROLL, inside the MARKS panel
    const tut = page.locator('.ut-overlay[data-tut="markRolls"]');
    await expect(tut).toBeVisible();
    await expect(page.locator('.ut-ring')).toBeVisible();
    await tut.getByRole('button', { name: 'NEXT' }).click();
    await tut.getByRole('button', { name: 'GOT IT' }).click();
    await expect(tut).toHaveCount(0);

    expect(await collected(page)).toBe(0);
    const roll = page.locator('.mr-roll');
    await expect(roll).toContainText('FREE ROLL');
    const t0 = Date.now();
    await roll.click();
    const card = page.locator('[data-testid="mark-roll-result"]');
    await expect(card).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(1500); // the card is in the DOM from the first frame of the reveal
    await expect.poll(() => collected(page), { timeout: 4000 }).toBeGreaterThan(0);
    // a paid roll now: the button prices itself in words AND wins
    await expect(roll).toContainText(/ROLL · \d+ WORDS ≈ [\d,]+ WINS/);
    await expect(page.locator('.mr-pity')).toContainText(/EPIC IN ≤\d+ · LEGENDARY IN ≤\d+/);
    await expect(page.locator('.mr-luck')).toContainText('LUCK ×');
    // every reveal is finite: once it has landed, nothing in the roll UI is animating, and nothing loops
    await page.waitForTimeout(2700);
    const left = await page.evaluate(() => document.getAnimations().filter((a) => {
      const el = a.effect && a.effect.target;
      return el && el.closest && el.closest('.mr-stage, .mr-cover');
    }).length);
    expect(left).toBe(0);
    const infinite = await page.evaluate(() => document.getAnimations().filter((a) => {
      const t = a.effect && a.effect.getTiming && a.effect.getTiming();
      return t && t.iterations === Infinity;
    }).length);
    expect(infinite).toBeLessThanOrEqual(1); // the menu's single pre-existing loop, nothing new
    // will-change is off again at rest
    const wc = await page.evaluate(() => [...document.querySelectorAll('.mr-stage *, .mr-cover *, .mr-cover')].filter((n) => n.style && n.style.willChange).length);
    expect(wc).toBe(0);
  });
}

test('reduced motion: a static result card, no reveal animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await page.goto('/?portal=1');
  await menuReady(page);
  await openMarks(page);
  await page.locator('.mr-roll').click();
  const card = page.locator('[data-testid="mark-roll-result"]');
  await expect(card).toBeVisible();
  const running = await page.evaluate(() => document.getAnimations().filter((a) => {
    const el = a.effect && a.effect.target;
    return el && el.closest && el.closest('.mr-stage, .mr-cover');
  }).length);
  expect(running).toBe(0);
  // fully opaque from the first frame — nothing fades or flips in
  const op = await card.evaluate((el) => getComputedStyle(el.closest('.mr-card-slot')).opacity);
  expect(Number(op)).toBe(1);
  await expect.poll(() => collected(page), { timeout: 4000 }).toBeGreaterThan(0);
});

test('the worn mark shows MAIN ×N; every other owned mark shows PERK +X%', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await page.goto('/?portal=1');
  await menuReady(page);
  await openMarks(page);
  await page.locator('.mr-roll').click();
  const card = page.locator('[data-testid="mark-roll-result"]');
  await expect(card).toBeVisible();
  // nothing was worn (×1), so the first mark (×2) is ASKED, never auto-equipped
  await expect(card.locator('.mr-ask-q')).toContainText(/EQUIP\? ×1 → ×\d/, { timeout: 4000 });
  await card.getByRole('button', { name: 'EQUIP' }).click();
  await expect(page.locator('[data-testid="marks-main-tag"]')).toHaveText(/^MAIN ×\d/);
  await expect(card.locator('.mr-card-tag')).toHaveText(/^MAIN ×\d/);
  await expect(page.locator('.mx-tile.is-on .mx-tile-sub')).toHaveText(/^MAIN ×\d/);
  // roll until a SECOND distinct mark is owned; it reads PERK, not MAIN
  for (let i = 0; i < 12; i += 1) {
    const owned = await page.locator('.mx-tile:not(.is-locked):not(.is-on)').count();
    if (owned > 0) break;
    await page.waitForTimeout(2700); // past any reveal (≤ 2.5 s)
    await page.locator('.mr-roll').click();
    const ask = card.locator('.mr-ask-no');
    if (await ask.isVisible().catch(() => false)) await ask.click();
  }
  const other = page.locator('.mx-tile:not(.is-locked):not(.is-on) .mx-tile-sub').first();
  await expect(other).toHaveText(/^PERK \+[\d.]+%$/);
  await page.locator('.mx-close').click();
  await expect(page.locator('.menu-mark .menu-mark-mult')).toHaveText(/^×\d/);
});
