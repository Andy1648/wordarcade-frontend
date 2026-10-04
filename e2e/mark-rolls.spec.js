// e2e/mark-rolls.spec.js — MARK ROLLS UI (Andy M + H3; the oct3 review hybrid). Written WITHOUT being run (memory
// rules on the authoring machine); Andy runs it. Covers: open MARKS → the ROLL tutorial → roll once → a result
// card, and % COLLECTED / pity only move when the reveal LANDS; the ROLL button never moves; a short balance says
// NEED X MORE; reduced motion shows a static card; the worn mark reads MAIN ×N; nothing loops after a reveal.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SEED = {
  'taw.rollsOn': '1', // MARK ROLLS are ON (rollsFlag.js); kept so the spec is independent of the flag
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
const rollUiAnims = (page) => page.evaluate(() => document.getAnimations().filter((a) => {
  const el = a.effect && a.effect.target;
  return el && el.closest && el.closest('.mr-stage, .mr-cover');
}).length);

test('roll once: tutorial, result card, nothing updates before the reveal lands, nothing loops after', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  await openMarks(page);

  // the one-time, ONE-step tutorial points at ROLL, inside the MARKS panel
  const tut = page.locator('.ut-overlay[data-tut="markRolls"]');
  await expect(tut).toBeVisible();
  await expect(page.locator('.ut-ring')).toBeVisible();
  await tut.getByRole('button', { name: 'GOT IT' }).click();
  await expect(tut).toHaveCount(0);

  expect(await collected(page)).toBe(0);
  const pityBefore = await page.locator('.mr-pity').innerText();
  const roll = page.locator('.mr-roll');
  await expect(roll).toHaveText(/FREE ROLL/);
  const boxBefore = await roll.boundingBox();
  await roll.click();
  // NO SPOILERS: right after the tap, the index and pity have not moved yet
  await page.waitForTimeout(120);
  expect(await collected(page)).toBe(0);
  expect(await page.locator('.mr-pity').innerText()).toBe(pityBefore);
  const card = page.locator('[data-testid="mark-roll-result"]');
  await expect(card).toHaveCount(1);
  // ...and after the landing they have
  await expect.poll(() => collected(page), { timeout: 4000 }).toBeGreaterThan(0);
  // the ROLL button never moved (a shift under the cursor fires pointerleave and kills a hold)
  const boxAfter = await roll.boundingBox();
  expect(Math.abs(boxAfter.y - boxBefore.y)).toBeLessThan(1);
  // price in ONE unit
  await expect(roll).toHaveText(/^ROLL · [\d\s,.KMB]+ WINS/);
  await expect(page.locator('.mr-pity')).toContainText(/EPIC\+ IN ≤\d+/);
  await expect(page.locator('.mr-luck')).toHaveText(/^LUCK ×[\d.]+$/);
  // nothing worn → the first mark AUTO-equips (no question, a hold never stalls) and the hero shows it
  await expect(page.locator('[data-testid="marks-main-tag"]')).toHaveText(/^MAIN ×\d/);
  await expect(page.locator('.mx-hero')).not.toContainText('NO MAIN YET');
  // every reveal is finite: once landed, nothing in the roll UI animates, nothing loops, will-change is off
  await page.waitForTimeout(2700);
  expect(await rollUiAnims(page)).toBe(0);
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.getTiming && a.effect.getTiming();
    return t && t.iterations === Infinity;
  }).length);
  expect(infinite).toBeLessThanOrEqual(1); // the menu's single pre-existing loop, nothing new
  const wc = await page.evaluate(() => [...document.querySelectorAll('.mr-stage, .mr-stage *, .mr-cover, .mr-cover *')].filter((n) => n.style && n.style.willChange).length);
  expect(wc).toBe(0);
});

test('a forced EPIC+ (pity): LEGENDARY+ plays the full-screen cutscene, an EPIC reveals in the panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 50, sinceEpic: 49, everEpic: true, starter: true, marks: {}, milestones: [] }),
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await openMarks(page);
  await page.locator('.mr-roll').click();
  const tier = await page.locator('.mr-stage').getAttribute('data-tier');
  expect(['epic', 'legendary', 'mythic', 'secret']).toContain(tier);
  if (tier !== 'epic') {
    await page.waitForTimeout(2100); // past the stamp beat, before the plate leaves
    await expect(page.locator('.mr-cover-stamp')).toHaveText(/^1 IN [\d\s,]+$/);
    const size = await page.locator('.mr-cover-stamp').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(36); // sized from --fs-hero (was 30px at 390)
  }
  await expect.poll(() => rollUiAnims(page), { timeout: 3500 }).toBe(0);
});

test('short balance: the press says NEED X MORE (never a silent grey button)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.wins': '0',
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 1, starter: true, marks: {}, milestones: [] }),
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await openMarks(page);
  await page.locator('.mr-roll').click();
  await expect(page.locator('.mr-msg')).toHaveText(/^NEED [\d\s,.KMB]+ MORE WINS$/);
  await expect(page.locator('[data-testid="mark-roll-result"]')).toHaveCount(0);
});

test('reduced motion: a static result card, no reveal animation; a legendary+ keeps its static plate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 50, sinceEpic: 49, everEpic: true, starter: true, marks: {}, milestones: [] }),
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await openMarks(page);
  await page.locator('.mr-roll').click();
  const card = page.locator('[data-testid="mark-roll-result"]');
  await expect(card).toBeVisible();
  expect(await rollUiAnims(page)).toBe(0);
  // rarity still reads: a LEGENDARY+ plate + stamp are up, static, for the hold (an EPIC reveals in the panel)
  const tier = await page.locator('.mr-stage').getAttribute('data-tier');
  if (tier !== 'epic') {
    await expect(page.locator('.mr-cover.is-static')).toHaveCount(1);
    await expect(page.locator('.mr-cover.is-static .mr-cover-stamp')).toBeVisible();
  }
  await expect(page.locator('.mr-cover.is-static')).toHaveCount(0, { timeout: 4000 });
  const op = await card.evaluate((el) => getComputedStyle(el.closest('.mr-card-slot')).opacity);
  expect(Number(op)).toBe(1);
});

test('the worn mark shows MAIN ×N; every other owned mark shows its perk or MAIN', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await page.goto('/?portal=1');
  await menuReady(page);
  await openMarks(page);
  await page.locator('.mr-roll').click();
  const card = page.locator('[data-testid="mark-roll-result"]');
  await expect(card.locator('.mr-card-tag')).toHaveText(/^MAIN ×\d/, { timeout: 4000 });
  await expect(page.locator('.mx-tile.is-on .mx-tile-sub')).toHaveText(/^MAIN ×\d/);
  // roll until a SECOND distinct mark is owned; it reads PERK, not MAIN
  for (let i = 0; i < 12; i += 1) {
    const owned = await page.locator('.mx-tile:not(.is-locked):not(.is-on)').count();
    if (owned > 0) break;
    await page.waitForTimeout(2700); // past any reveal (≤ 2.5 s)
    await page.locator('.mr-roll').click();
  }
  await page.waitForTimeout(2700);
  const other = page.locator('.mx-tile:not(.is-locked):not(.is-on) .mx-tile-sub').first();
  // MARKS via ROLLS: a non-worn owned mark shows its PERK line (LEGENDARY+) or what wearing it pays
  await expect(other).toHaveText(/^(MAIN ×[\d.]+|[A-Z][A-Z0-9 ×+]+)$/);
  await page.locator('.mx-close').click();
  await expect(page.locator('.menu-mark .menu-mark-mult')).toHaveText(/^×\d/);
});
