// e2e/menu-list.spec.js — Andy oct6 SEASON 2 list, item 5 (the menu list):
//   "show UPGRADES/ROLL/INDEX/REBIRTH from the start (locked ones with a padlock + "R2" etc.); rename SHOP → UPGRADES;
//    no mark equipped → chip says ROLL + notification dot; … fill the buttons (big icon, bigger label, live value:
//    cheapest POWER price / gems÷75 / levels to next rebirth)"
// The centring half lives in chromebook-cards.spec.js; the 600 ms glide in menu-xp.spec.js + kit.test.js.
// NIGHT oct8 #2: ROLL + INDEX merged into GEARS (opens the ROLL screen; INDEX is a button inside it) and STATS moved
// down onto the rail — UPGRADES | GEARS / REBIRTH | STATS.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const RAIL = ['shop', 'gears', 'rebirth', 'stats'];
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

test('a fresh LV1 player sees all four rail buttons: UPGRADES + REBIRTH + STATS open, GEARS padlocked at LV10', async ({ page }) => {
  await boot(page, {});
  const labels = await page.locator('.hp-rail .kb-rlabel').allTextContents();
  expect(labels).toEqual(['UPGRADES', 'GEARS', 'REBIRTH', 'STATS']);
  for (const id of RAIL) await expect(btn(page, id)).toBeVisible();
  // STATS left the top-right cluster (it lives on the rail now)
  await expect(page.locator('.hp-icons [data-nav="stats"]')).toHaveCount(0);
  // NO COUNTS (Andy oct9): UPGRADES carries no price — icon + label (+ the dot when something is affordable); REBIRTH
  // keeps its status line (the levels to the first rebirth)
  await expect(btn(page, 'shop').locator('.kb-rval')).toHaveCount(0);
  await expect(btn(page, 'rebirth').locator('.kb-rval-full')).toHaveText(/^IN \d[\d,.]*[KMB]? LV$/);
  // GEARS: locked with the REAL season-1 gate (MARKS reveal at LV10), the padlock icon, aria-disabled
  for (const id of ['gears']) {
    const b = btn(page, id);
    await expect(b).toHaveAttribute('data-locked', '');
    await expect(b).toHaveAttribute('aria-disabled', 'true');
    await expect(b.locator('.kb-rval')).toHaveText('LV10');
    await expect(b.locator('svg[data-icon="lock"]')).toHaveCount(1);
    await expect(b).toHaveAttribute('aria-label', /locked, unlocks at level 10/);
  }
  // a locked tap opens nothing; an open one does
  await btn(page, 'gears').click({ force: true }); // aria-disabled: Playwright would wait for 'enabled'
  await page.waitForTimeout(300);
  await expect(page.locator('.rs-overlay')).toHaveCount(0);
  // no mark system yet → no mark chip
  await expect(page.locator('.menu-mark')).toHaveCount(0);
  // every rail button is a ≥ 44px target and its value line is ≥ 13px (season-1 STATS carries no value line)
  for (const id of RAIL) {
    const box = await btn(page, id).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (id === 'stats' || id === 'shop') continue; // no value line: season-1 STATS, and UPGRADES (no counts)
    const fs = await btn(page, id).locator('.kb-rval').evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
    expect(fs).toBeGreaterThanOrEqual(13);
  }
});

test('season 1, marks revealed: GEARS shows no roll count — just its dot while a roll is affordable; the empty chip says ROLL + dot', async ({ page }) => {
  await boot(page, {
    'taw.xp': JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }),
    'taw.xpv10': JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }),
    'taw.marksRevealed': '1',
    'taw.gems': JSON.stringify({ v: 1, bal: 157, peak: 50, streak: 0, mig: 1 }),
    'taw.wins': '0',
  });
  // NO COUNTS (Andy oct9): 157 gems buys rolls, but the tile never says how many — the dot is the whole signal
  await expect(btn(page, 'gears').locator('.kb-rval')).toHaveCount(0);
  await expect(page.locator('.hp-nav.is-gears .kb-rdot')).toHaveCount(1);
  await expect(btn(page, 'gears')).not.toHaveAttribute('data-locked', '');
  // nothing worn → the chip reads ROLL with a notification dot, and opens the ROLL screen
  const chip = page.locator('.menu-mark');
  await expect(chip.locator('.menu-mark-name')).toHaveText('NONE'); // the YOUR GEAR slot (feat/menu-perrow)
  await expect(chip.locator('.hp-chip-dot')).toHaveCount(1);
  await chip.click();
  await page.locator('.rs-overlay').waitFor();
});

test('season 2 (?season2=1), a FRESH save: GEARS unlocked from the start — it opens ROLL, whose INDEX button opens the index; REBIRTH padlocked until reachable', async ({ page }) => {
  // PROGRESSION FINAL "start: ROLL + INDEX visible" — never the season-1 MARKS reveal (LV10). (prod bug: only SHOP showed)
  await boot(page, { 'taw.s2.conv': JSON.stringify({ v: 1, st: 'shown', had: false, srv: 1 }) }, { season2: true });
  const labels = await page.locator('.hp-rail .kb-rlabel').allTextContents();
  expect(labels).toEqual(['UPGRADES', 'GEARS', 'REBIRTH', 'STATS']);
  for (const id of ['shop', 'gears', 'stats']) {
    await expect(btn(page, id)).not.toHaveAttribute('data-locked', '');
    await expect(btn(page, id)).not.toHaveAttribute('aria-disabled', 'true');
  }
  // STATS: the TOTAL multiplier on a key (fresh: ×1)
  await expect(btn(page, 'stats').locator('.kb-rval-full')).toHaveText('×1 XP');
  // REBIRTH: padlock + the gate level until this climb first reaches it
  await expect(btn(page, 'rebirth')).toHaveAttribute('data-locked', '');
  await expect(btn(page, 'rebirth').locator('.kb-rval')).toHaveText(/^LV\d+$/);
  // GEARS opens the ROLL screen, and its INDEX button opens the MARKS INDEX
  await btn(page, 'gears').click();
  await page.locator('.rs-overlay').waitFor();
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
  // the empty mark chip is there from the start too: ROLL + dot
  await page.locator('.mx-close').click();
  await expect(page.locator('.menu-mark .menu-mark-name')).toHaveText('NONE'); // the YOUR GEAR slot (feat/menu-perrow)
  await expect(page.locator('.menu-mark .hp-chip-dot')).toHaveCount(1);
});

test('season 2: 160 gems affords a 75-gem roll — GEARS dots with no count; nothing on the rail is locked at R1', async ({ page }) => {
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
  await expect(btn(page, 'gears').locator('.kb-rval')).toHaveCount(0);
  await expect(page.locator('.hp-nav.is-gears .kb-rdot')).toHaveCount(1);
  for (const id of RAIL) await expect(btn(page, id)).not.toHaveAttribute('data-locked', '');
});

for (const [w, h] of [[390, 844], [360, 640]]) {
  test(`phone (${w}x${h}): the four rail slabs sit 2 × 2 — REBIRTH / STATS with their status, UPGRADES / GEARS label only — never clipped`, async ({ page }) => {
    await boot(page, {
      'taw.xp': JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }),
      'taw.xpv10': JSON.stringify({ lv: 12, f: 0.2, rc: 0, v: 10 }),
      'taw.marksRevealed': '1',
      'taw.gems': JSON.stringify({ v: 1, bal: 557, peak: 50, streak: 0, mig: 1 }),
    }, { w, h });
    const slabs = page.locator('.hp-m-rail .kb-rwrap');
    await expect(slabs).toHaveCount(4);
    // R2 oct8 #6: two rows of two (a 4-up row clipped "UPGRADES" at 360 and could only fit a 13px number)
    const tops = await slabs.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size, `two rows: ${tops}`).toBe(2);
    expect(tops[0], 'UPGRADES and GEARS share the first row').toBe(tops[1]);
    expect(tops[2], 'REBIRTH and STATS share the second').toBe(tops[3]);
    // menu-polish-v2 (Andy oct9 "the 4 icons in the menu … at least some animation"): each slab is the desktop tile in
    // miniature — the label on the tone strip, the ICON + its number as one centred row (e2e/rail-centre.spec.js)
    await expect(page.locator('.hp-m-rail .kb-rface .kit-icon:visible')).toHaveCount(4);
    for (const el of await page.locator('.hp-m-rail .kb-rval').all()) expect(parseFloat(await el.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
    // NO COUNTS (Andy oct9): no price on UPGRADES, no roll count on GEARS (557 gems affords rolls → the dot says so)
    await expect(page.locator('.hp-m-rail .is-shop .kb-rval')).toHaveCount(0);
    await expect(page.locator('.hp-m-rail .is-gears .kb-rval')).toHaveCount(0);
    await expect(page.locator('.hp-m-rail .is-gears .kb-rdot')).toHaveCount(1);
    // narrow slab: REBIRTH's status keeps the short form ("12 LV", not "IN 12 LV")
    await expect(page.locator('.hp-m-rail .is-rebirth .kb-rval-short')).toBeVisible();
    await expect(page.locator('.hp-m-rail .is-rebirth .kb-rval-full')).toBeHidden();
    const clipped = await page.locator('.hp-m-rail .kb-rval').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => `${e.textContent} ${e.scrollWidth}>${e.clientWidth}`));
    expect(clipped).toEqual([]);
    for (const b of await page.locator('.hp-m-rail .kb--rail').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  });
}
