// e2e/gear-fit.spec.js — NOTHING OVERFLOWS (Andy's #1 rule; gear UI v3: "+14.4% CRIT" ran past the YOUR GEAR slot).
// Every piece of TEXT inside the YOUR GEAR slot (the phone GEAR chip at 390), each EQUIP-screen card and each INDEX
// tile must stay inside its box, for a worn gear of every tier, at 1366x657, 1280x720 and 390x844. Measured on the
// rendered TEXT (a Range over each text node — transforms included, so a FitText shrink counts), not on the element
// boxes, which can be narrower than the glyphs they hold. Season 2 (the live numbers), the biggest dupes (×99, ★5) a
// save can show, and the REAL Bungee (the fallback font is narrower and hides overflow).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SIZES = [[1366, 657], [1280, 720], [390, 844]];
// per tier, the gear with the longest stat / name (crit-heavy, one-mode units)
const WORN = { rare: 'mk-detonator', epic: 'mk-brainstorm', legendary: 'mk-thunderclap', mythic: 'mk-singularity', secret: 'mk-origin' };
const ROLLED = ['mk-detonator', 'mk-cyclone', 'mk-scholar', 'mk-ouroboros', 'mk-tinder', 'mk-slipstream', 'mk-smith', 'mk-phoenix',
  'mk-metronome', 'mk-hotwire', 'mk-grapple', 'mk-sparkplug', 'mk-pyro', 'mk-nova', 'mk-golem', 'mk-brainstorm', 'mk-flashpoint',
  'mk-voltage', 'mk-talisman', 'mk-leviathan', 'mk-eclipse', 'mk-headmaster', 'mk-thunderclap', 'mk-singularity', 'mk-kraken',
  'mk-hydra', 'mk-origin'];
// a few left unowned so the INDEX also draws LOCKED tiles of every tier
const UNOWNED = new Set(['mk-cyclone', 'mk-golem', 'mk-headmaster', 'mk-hydra']);

async function boot(page, w, h, worn) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  // REAL TYPE: the gate blocks Google Fonts, and the fallback serif is far narrower than Bungee — an overflow test in
  // the fallback passes vacuously (it did: "+40% CRIT" fit in serif and overflowed in Bungee). Let the two font hosts
  // through for this spec only (a later route wins), and assert below that Bungee actually loaded.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.continue());
  const marks = {};
  ROLLED.filter((id) => !UNOWNED.has(id)).forEach((id, i) => { marks[id] = { n: 99, first: 1 + i }; });
  await page.addInitScript(({ worn, marks }) => {
    if (sessionStorage.getItem('gf.seeded')) return;
    sessionStorage.setItem('gf.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
      'taw.xp': JSON.stringify({ lv: 60, into: 0 }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 0, v: 10 }),
      'taw.markRolls': JSON.stringify({ v: 3, rolls: 999, sinceEpic: 0, sinceLegendary: 0, everEpic: true, starter: true, marks, milestones: [] }),
      'taw.mark': worn,
    })) localStorage.setItem(k, v);
  }, { worn, marks });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('24px Bungee')), 'Bungee must be loaded to measure real text').toBe(true);
}

/** Text that leaves its box: [{ box, text, by }] for every `boxSel` element (text measured by Range). */
function overflowsIn(page, boxSel) {
  return page.evaluate((sel) => {
    const out = [];
    for (const box of document.querySelectorAll(sel)) {
      const b = box.getBoundingClientRect();
      if (!b.width) continue;
      const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.nodeValue.trim()) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const t = r.getBoundingClientRect();
        if (!t.width) continue;
        const by = Math.max(b.left - t.left, t.right - b.right, b.top - t.top, t.bottom - b.bottom);
        if (by > 1) out.push({ box: box.className.toString().slice(0, 40), text: n.nodeValue.trim(), by: Math.round(by) });
      }
    }
    return out;
  }, boxSel);
}

for (const [w, h] of SIZES) {
  for (const [tier, id] of Object.entries(WORN)) {
    test(`YOUR GEAR fits @ ${w}x${h} — ${tier} worn`, async ({ page }) => {
      await boot(page, w, h, id);
      const slot = page.locator('.menu-mark').first();
      await expect(slot).toBeVisible();
      await page.waitForTimeout(400); // the lazy crit line + the webfont
      expect(await overflowsIn(page, '.menu-mark')).toEqual([]);
    });
  }

  test(`EQUIP cards + INDEX tiles fit @ ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h, WORN.secret);
    await page.locator('.menu-mark').first().click();
    const equip = page.locator('[data-testid="equip-screen"]');
    await expect(equip.locator('.mx-tile').first()).toBeVisible();
    await page.waitForTimeout(300);
    expect(await overflowsIn(page, '[data-testid="equip-screen"] .mx-tile .mc')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(equip).toHaveCount(0);
    await page.locator('[data-nav="gears"]').first().click();
    await page.locator('[data-testid="roll-index"]').click();
    await expect(page.locator('.mx-tile.is-locked').first()).toBeVisible();
    await page.waitForTimeout(300);
    expect(await overflowsIn(page, '.mx-grid .mx-tile .mc')).toEqual([]);
  });
}
