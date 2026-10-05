// e2e/mark-rolls.spec.js — THE ROLL SCREEN (Andy oct5; replaces the in-panel roll UI + rolls-reveal.spec.js). Written
// WITHOUT being run (the authoring machine runs no Playwright); CI runs it. Covers: MARKS opens the full-screen
// ROLL screen (one big ROLL, no ×10) → the tutorial → a roll spins the reel and the card + pity only change when it
// LANDS, on the real result; tap anywhere jumps to the result; a LEGENDARY+ pity roll plays the cutscene with
// "1 IN X" huge; AUTO ROLL stops on its tier; the skip setting is stored; a short balance says NEED X MORE; reduced
// motion goes straight to the card; the reel fits 360x640 → 1366x657; INDEX opens the MARKS INDEX; nothing loops after.
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
async function openRoll(page, query = '') {
  await page.goto(`/?portal=1${query}`);
  await menuReady(page);
  // desktop: the menu's mark chip; phone (≤480px): the MARKS nav button
  await page.locator('.menu-mark:visible, .hp-m-navbtn.is-marks:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
}
const pity = (page) => page.getByTestId('roll-pity').innerText();
const card = (page) => page.locator('[data-testid="mark-roll-result"]');
const rollUiAnims = (page) => page.evaluate(() => document.getAnimations().filter((a) => {
  const el = a.effect && a.effect.target;
  return el && el.closest && el.closest('.rs-overlay') && a.playState === 'running';
}).length);
const SPUN = 4600; // past the slowest full spin (SECRET 4 s) + its land beat

test('MARKS opens the ROLL screen: tutorial, one big ROLL (no ×10), pity ladder, the reel lands on the real result', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await openRoll(page);
  const tut = page.locator('.ut-overlay[data-tut="markRolls"]');
  await expect(tut).toBeVisible();
  await tut.getByRole('button', { name: 'GOT IT' }).click();
  await expect(tut).toHaveCount(0);

  await expect(page.getByTestId('mark-roll-10')).toHaveCount(0);
  await expect(page.getByTestId('roll-pity')).toContainText(/EPIC\+ IN [\d,]+/);
  await expect(page.getByTestId('roll-pity')).toContainText(/LEGENDARY\+ IN [\d,]+/);
  const roll = page.locator('.rs-roll');
  await expect(roll).toHaveText(/FREE ROLL/);
  const pityBefore = await pity(page);
  const boxBefore = await roll.boundingBox();
  await roll.click();
  // NO SPOILERS: mid-spin the card is not there and the pity ladder has not moved
  await page.waitForTimeout(300);
  await expect(card(page)).toHaveCount(0);
  expect(await pity(page)).toBe(pityBefore);
  // ...it lands (a first-time mark ALWAYS plays the full reveal: ≥ 2.5 s)
  await expect(card(page)).toHaveCount(1, { timeout: SPUN });
  // the landing cell IS the result
  const landTier = await page.locator('.rs-cell.is-land').getAttribute('data-tier');
  expect(await card(page).getAttribute('data-tier')).toBe(landTier);
  await expect(card(page).locator('.mark-pips')).toHaveCount(1);
  // the ROLL button never moved, and is priced in ONE unit now that the starter is spent
  const boxAfter = await roll.boundingBox();
  expect(Math.abs(boxAfter.y - boxBefore.y)).toBeLessThan(1);
  await expect(roll).toHaveText(/^ROLL · [\d\s,.KMB]+ WINS$/);
  // finite: once landed nothing animates, nothing loops, will-change is off
  await page.waitForTimeout(3600);
  expect(await rollUiAnims(page)).toBe(0);
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.getTiming && a.effect.getTiming();
    return t && t.iterations === Infinity;
  }).length);
  expect(infinite).toBeLessThanOrEqual(1); // the menu's single pre-existing loop, nothing new
  const wc = await page.evaluate(() => [...document.querySelectorAll('.rs-overlay, .rs-overlay *')].filter((n) => n.style && n.style.willChange).length);
  expect(wc).toBe(0);
});

test('tap anywhere mid-spin jumps straight to the result', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await page.locator('.rs-roll').click();
  await page.waitForTimeout(250);
  await page.locator('.rs-stage').click({ position: { x: 20, y: 20 } });
  await expect(card(page)).toHaveCount(1, { timeout: 400 });
});

test('LEGENDARY pity: the full-screen cutscene says "1 IN X" huge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 600, sinceEpic: 3, sinceLegendary: 499, everEpic: true, starter: true, marks: {}, milestones: [] }),
  });
  await openRoll(page);
  await expect(page.getByTestId('roll-pity')).toContainText('LEGENDARY+ IN 1');
  await page.locator('.rs-roll').click();
  const cut = page.getByTestId('roll-cutscene');
  await expect(cut).toHaveClass(/is-on/, { timeout: SPUN });
  expect(['legendary', 'mythic', 'secret']).toContain(await cut.getAttribute('data-tier'));
  await page.waitForTimeout(900);
  await expect(page.getByTestId('roll-cutscene-odds')).toHaveText(/^1 IN [\d,.K]+$/);
  const size = await page.getByTestId('roll-cutscene-odds').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(40);
  // the cutscene ends by itself on the result card
  await expect(cut).not.toHaveClass(/is-on/, { timeout: 4000 });
  await expect(card(page)).toHaveCount(1);
  await expect(page.getByTestId('roll-pity')).toContainText('LEGENDARY+ IN 500');
});

test('AUTO ROLL "until EPIC or better" stops on an EPIC+', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    // EPIC pity 3 rolls away: at most three spins (first-time marks still play the full reveal)
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 60, sinceEpic: 47, everEpic: true, starter: true, marks: {}, milestones: [] }),
  });
  await openRoll(page);
  await page.getByTestId('roll-until').selectOption('epic');
  await page.getByTestId('roll-auto').click();
  await expect(page.getByTestId('roll-auto')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('roll-auto')).toHaveAttribute('aria-pressed', 'false', { timeout: 20000 });
  expect(['epic', 'legendary', 'mythic', 'secret']).toContain(await card(page).getAttribute('data-tier'));
});

test('skip reveals below [tier]: default EPIC, the pick is stored', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await expect(page.getByTestId('roll-skip')).toHaveValue('epic');
  await page.getByTestId('roll-skip').selectOption('legendary');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls') || '{}').skipBelow);
  expect(stored).toBe('legendary');
});

test('short balance: the press says NEED X MORE WINS', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.wins': '0',
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 1, starter: true, marks: {}, milestones: [] }),
  });
  await openRoll(page);
  await page.locator('.rs-roll').click();
  await expect(page.locator('.rs-msg')).toHaveText(/^NEED [\d\s,.KMB]+ MORE WINS$/);
  await expect(card(page)).toHaveCount(0);
});

test('reduced motion: straight to the result card, no reel animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await page.locator('.rs-roll').click();
  await expect(card(page)).toHaveCount(1, { timeout: 300 });
  expect(await rollUiAnims(page)).toBe(0);
});

for (const [w, h] of [[360, 640], [390, 844], [1366, 657]]) {
  test(`${w}x${h}: the reel plays and lands, nothing sticks out, the card never covers ROLL`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await seed(page, { 'taw.tut.markRolls': '1' });
    await openRoll(page);
    await page.locator('.rs-roll').click();
    await expect(card(page)).toHaveCount(1, { timeout: SPUN });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(w);
    const c = await card(page).boundingBox();
    const r = await page.locator('.rs-roll').boundingBox();
    expect(c.y + c.height).toBeLessThanOrEqual(r.y + 1);
    expect(r.y + r.height).toBeLessThanOrEqual(h);
  });
}

test('coming back from the INDEX never replays the last reveal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await page.locator('.rs-roll').click();
  await expect(card(page)).toHaveCount(1, { timeout: SPUN });
  await page.waitForTimeout(4200);
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
  await page.locator('.mx-close').click();
  await expect(page.locator('.rs-overlay')).toBeVisible();
  await page.waitForTimeout(200);
  expect(await rollUiAnims(page)).toBe(0);
  await expect(page.getByTestId('roll-cutscene')).not.toHaveClass(/is-on/);
});

test('INDEX opens the MARKS INDEX and closes back to the ROLL screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
  await page.locator('.mx-close').click();
  await expect(page.locator('.rs-overlay')).toBeVisible();
  await page.locator('.rs-close').click();
  await expect(page.locator('.rs-overlay')).toHaveCount(0);
});
