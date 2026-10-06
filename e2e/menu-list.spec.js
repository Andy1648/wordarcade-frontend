// e2e/menu-list.spec.js — Andy oct6 SEASON 2 list, item 5 (the menu list):
//   "show UPGRADES/ROLL/INDEX/REBIRTH from the start (locked ones with a padlock + "R2" etc.); rename SHOP → UPGRADES;
//    no mark equipped → chip says ROLL + notification dot; … fill the buttons (big icon, bigger label, live value:
//    cheapest POWER price / gems÷75 / levels to next rebirth)"
// The centring half lives in chromebook-cards.spec.js; the 600 ms glide in menu-xp.spec.js + kit.test.js.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const RAIL = ['shop', 'roll', 'index', 'rebirth'];
const btn = (page, id) => page.locator(`.hp-rail .hp-nav.is-${id} > button`).first();

async function boot(page, seed, { season2 = false, w = 1366, h = 768 } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('ml.seeded')) return;
    sessionStorage.setItem('ml.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.tut.markRolls', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`/?portal=1${season2 ? '&season2=1' : ''}`);
  await menuReady(page);
}

test('a fresh LV1 player sees all four rail buttons: UPGRADES + REBIRTH open, ROLL + INDEX padlocked at LV10', async ({ page }) => {
  await boot(page, {});
  const labels = await page.locator('.hp-rail .kb-rlabel').allTextContents();
  expect(labels).toEqual(['UPGRADES', 'ROLL', 'INDEX', 'REBIRTH']);
  for (const id of RAIL) await expect(btn(page, id)).toBeVisible();
  // live values: the cheapest POWER (KEY tier I = 50 wins), the levels to the first rebirth
  await expect(btn(page, 'shop').locator('.kb-rval')).toHaveText('50 WINS');
  await expect(btn(page, 'rebirth').locator('.kb-rval')).toHaveText(/^IN \d[\d,.]*[KMB]? LV$/);
  // ROLL + INDEX: locked with the REAL season-1 gate (MARKS reveal at LV10), the padlock icon, aria-disabled
  for (const id of ['roll', 'index']) {
    const b = btn(page, id);
    await expect(b).toHaveAttribute('data-locked', '');
    await expect(b).toHaveAttribute('aria-disabled', 'true');
    await expect(b.locator('.kb-rval')).toHaveText('LV10');
    await expect(b.locator('svg[data-icon="lock"]')).toHaveCount(1);
    await expect(b).toHaveAttribute('aria-label', /locked, unlocks at level 10/);
  }
  // a locked tap opens nothing; an open one does
  await btn(page, 'roll').click({ force: true }); // aria-disabled: Playwright would wait for 'enabled'
  await page.waitForTimeout(300);
  await expect(page.locator('.rs-overlay')).toHaveCount(0);
  // no mark system yet → no mark chip
  await expect(page.locator('.menu-mark')).toHaveCount(0);
  // every rail button is a ≥ 44px target and its value line is ≥ 13px
  for (const id of RAIL) {
    const box = await btn(page, id).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    const fs = await btn(page, id).locator('.kb-rval').evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
    expect(fs).toBeGreaterThanOrEqual(13);
  }
});

test('season 1, marks revealed: ROLL = gems ÷ the roll price, INDEX = owned/total, the empty chip says ROLL + dot', async ({ page }) => {
  await boot(page, {
    'taw.xp': JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }),
    'taw.xpv10': JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }),
    'taw.marksRevealed': '1',
    'taw.gems': JSON.stringify({ v: 1, bal: 157, peak: 50, streak: 0, mig: 1 }),
    'taw.wins': '0',
  });
  // season 1 rolls cost 10 gems: 157 → 15 ROLLS (whole rolls only)
  await expect(btn(page, 'roll').locator('.kb-rval')).toHaveText('15 ROLLS');
  await expect(btn(page, 'roll')).not.toHaveAttribute('data-locked', '');
  const idx = await btn(page, 'index').locator('.kb-rval').textContent();
  expect(idx).toMatch(/^\d+\/\d+$/);
  const [owned, total] = idx.split('/').map(Number);
  expect(owned).toBeLessThanOrEqual(total);
  expect(total).toBeGreaterThan(0);
  // nothing worn → the chip reads ROLL with a notification dot, and opens the ROLL screen
  const chip = page.locator('.menu-mark');
  await expect(chip.locator('.menu-mark-name')).toHaveText('ROLL');
  await expect(chip.locator('.hp-chip-dot')).toHaveCount(1);
  await chip.click();
  await page.locator('.rs-overlay').waitFor();
});

test('season 2 (?season2=1), a FRESH save: ROLL + INDEX unlocked from the start and they open; REBIRTH padlocked until reachable', async ({ page }) => {
  // PROGRESSION FINAL "start: ROLL + INDEX visible" — never the season-1 MARKS reveal (LV10). (prod bug: only SHOP showed)
  await boot(page, { 'taw.s2.conv': JSON.stringify({ v: 1, st: 'shown', had: false, srv: 1 }) }, { season2: true });
  const labels = await page.locator('.hp-rail .kb-rlabel').allTextContents();
  expect(labels).toEqual(['UPGRADES', 'ROLL', 'INDEX', 'REBIRTH']);
  for (const id of ['shop', 'roll', 'index']) {
    await expect(btn(page, id)).not.toHaveAttribute('data-locked', '');
    await expect(btn(page, id)).not.toHaveAttribute('aria-disabled', 'true');
  }
  await expect(btn(page, 'index').locator('.kb-rval')).toHaveText(/^0\/\d+$/);
  // REBIRTH: padlock + the gate level until this climb first reaches it
  await expect(btn(page, 'rebirth')).toHaveAttribute('data-locked', '');
  await expect(btn(page, 'rebirth').locator('.kb-rval')).toHaveText(/^LV\d+$/);
  // ROLL opens the ROLL screen …
  await btn(page, 'roll').click();
  await page.locator('.rs-overlay').waitFor();
  await page.locator('.rs-close').click();
  await expect(page.locator('.rs-overlay')).toHaveCount(0);
  // … and INDEX opens the MARKS INDEX
  await btn(page, 'index').click();
  await page.locator('.mx-panel').waitFor();
  // the empty mark chip is there from the start too: ROLL + dot
  await page.locator('.mx-close').click();
  await expect(page.locator('.menu-mark .menu-mark-name')).toHaveText('ROLL');
  await expect(page.locator('.menu-mark .hp-chip-dot')).toHaveCount(1);
});

test('season 2: a roll costs 75 gems — ROLL reads gems ÷ 75; nothing on the rail is locked at R1', async ({ page }) => {
  await boot(
    page,
    {
      'taw.s2.conv': JSON.stringify({ v: 1, st: 'shown', had: true, srv: 1 }),
      'taw.s2.xp': JSON.stringify({ lv: 3, f: 0.1, rc: 1, v: 10 }),
      'taw.s2.rebirths': '1',
      'taw.s2.gems': JSON.stringify({ v: 1, bal: 160, peak: 50, streak: 0, mig: 1 }),
    },
    { season2: true },
  );
  await expect(btn(page, 'roll').locator('.kb-rval')).toHaveText('2 ROLLS');
  for (const id of RAIL) await expect(btn(page, id)).not.toHaveAttribute('data-locked', '');
});

test('phone (390x844): the four rail slabs share one row, each with its live value', async ({ page }) => {
  await boot(page, {}, { w: 390, h: 844 });
  const slabs = page.locator('.hp-m-rail .kb-rwrap');
  await expect(slabs).toHaveCount(4);
  const tops = await slabs.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size, `one row: ${tops}`).toBe(1);
  await expect(page.locator('.hp-m-rail .is-shop .kb-rval')).toHaveText('50 WINS');
  // the value line is never clipped by its slab
  const clipped = await page.locator('.hp-m-rail .kb-rval').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(clipped).toEqual([]);
});
