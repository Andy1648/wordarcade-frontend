// e2e/design-audit-gear.spec.js — design audit nov2, PR A (#9), at 1366x768 and 390x844. (#8, glow → flat backplate,
// was reverted: the gear auras stay as on main — e2e/gear-aura-clip.spec.js owns them.)
//   #9  the chrome round the gear cards is house-style: ← MENU · INDEX · AUTO · RATES · ← ROLL / ← MENU are solid kit
//       buttons (≥ 44px, ≥ 4px outline, 8px corners, Bungee, a hard offset) and the pity meters are not hairlines —
//       checked at rest AND after a roll has landed (the after-action state).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { layoutDefects } from './support/overlap.js';
import { tapRoll } from './support/roll.js';

const SHOTS = process.env.DA_SHOTS || '';
const OWN = ['mk-thunderclap', 'mk-leviathan', 'mk-eclipse', 'mk-brainstorm', 'mk-singularity', 'mk-origin', 'mk-detonator', 'mk-tinder'];

async function boot(page, w, h, worn = 'mk-thunderclap') {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.continue());
  const marks = {};
  OWN.forEach((id, i) => { marks[id] = { n: 3, first: 1 + i }; });
  await page.addInitScript(({ worn, marks }) => {
    if (sessionStorage.getItem('da.seeded')) return;
    sessionStorage.setItem('da.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1',
      'taw.xp': JSON.stringify({ lv: 60, into: 0 }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 2, v: 10 }), 'taw.s2.rebirths': '2',
      'taw.gems': '5000', 'taw.s2.gems': JSON.stringify({ bal: 5000, mig: 1 }),
      'taw.markRolls': JSON.stringify({ v: 3, rolls: 40, sinceEpic: 3, sinceLegendary: 20, everEpic: true, starter: true, marks, milestones: [] }),
      'taw.mark': worn,
    })) localStorage.setItem(k, v);
  }, { worn, marks });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.evaluate(() => document.fonts.ready);
}

/** Every control matching `sel` that is drawn: its box, outline, corner, font and shadow. */
function chrome(page, sel) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map((el) => {
    const r = el.getBoundingClientRect(); const c = getComputedStyle(el);
    return {
      sel: el.className.toString().split(' ')[0], w: Math.round(r.width), h: Math.round(r.height),
      border: parseFloat(c.borderTopWidth), radius: parseFloat(c.borderTopLeftRadius),
      bungee: /Bungee/.test(c.fontFamily), shadow: c.boxShadow !== 'none',
      onScreen: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1,
    };
  }), sel);
}
function expectKit(list, what) {
  expect(list.length, `${what}: drawn`).toBeGreaterThan(0);
  for (const b of list) {
    expect(b.w >= 44 && b.h >= 44, `${what} ${b.sel} ≥ 44px (${b.w}x${b.h})`).toBe(true);
    expect(b.border, `${what} ${b.sel} outline ≥ 4px`).toBeGreaterThanOrEqual(4);
    expect(b.radius, `${what} ${b.sel} 8px corners`).toBe(8);
    expect(b.bungee, `${what} ${b.sel} Bungee`).toBe(true);
    expect(b.shadow, `${what} ${b.sel} hard shadow`).toBe(true);
    expect(b.onScreen, `${what} ${b.sel} on screen`).toBe(true);
  }
}

for (const [w, h] of [[1366, 768], [390, 844]]) {
  const tag = `${w}x${h}`;

  test(`#9 YOUR GEAR's ← MENU is house-style; the gear auras stay as they were @ ${tag}`, async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page, w, h);
    const slot = page.locator('.menu-mark').first();
    await expect(slot).toBeVisible();
    await slot.click();
    const equip = page.locator('[data-testid="equip-screen"]');
    await expect(equip.locator('.mx-tile').first()).toBeVisible();
    await page.waitForTimeout(500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-your-gear-${tag}.png` });
    // the auras are NOT this PR's (design audit #8 was reverted: painted auras are coming) — they still render here
    expect(await equip.locator('.gfx').count(), 'EPIC+ tiles keep their aura').toBeGreaterThan(0);
    expectKit(await chrome(page, '[data-testid="equip-screen"] .mx-back'), 'EQUIP ← MENU');
    const d = await layoutDefects(page, { scope: '[data-testid="equip-screen"] .mx-head' });
    expect(d.overlaps, 'EQUIP head overlaps').toEqual([]);
    expect(d.hscroll, 'no sideways scroll').toBe(false);
  });

  test(`#9 ROLL + INDEX chrome is house-style, at rest and after a roll @ ${tag}`, async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page, w, h);
    await page.locator('[data-nav="gears"]:visible, .hp-nav.is-gears:visible').first().click();
    await expect(page.locator('.rs-roll')).toBeVisible();
    await page.waitForTimeout(500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-roll-${tag}.png` });
    const buttons = '.rs-close, .rs-index-btn, .rs-auto-btn, .rs-rates-btn';
    expectKit(await chrome(page, buttons), 'ROLL chrome');
    const bar = await page.evaluate(() => [...document.querySelectorAll('.rs-pity-bar')].filter((b) => b.getClientRects().length).map((b) => ({ h: b.getBoundingClientRect().height, bw: parseFloat(getComputedStyle(b).borderTopWidth) })));
    for (const b of bar) { expect(b.h, 'pity meter is not a hairline').toBeGreaterThanOrEqual(16); expect(b.bw).toBeGreaterThanOrEqual(3); }
    let d = await layoutDefects(page, { scope: '.rs-top' });
    expect(d.overlaps, 'top row overlaps at rest').toEqual([]);
    d = await layoutDefects(page, { scope: '.rs-controls' });
    expect(d.overlaps, 'controls overlap at rest').toEqual([]);
    expect(d.hscroll).toBe(false);

    // AFTER ACTION: one roll lands; the chrome keeps its size and nothing in the top row / controls collides
    await expect(page.locator('.rs-roll')).not.toHaveClass(/is-short/);
    await tapRoll(page);
    await expect(page.locator('.rs-roll')).toHaveClass(/is-rolling/, { timeout: 3000 });
    await page.waitForTimeout(800);
    await page.mouse.click(5, Math.round(h / 2)); // tap through the reveal
    await page.waitForTimeout(600);
    await page.mouse.click(5, Math.round(h / 2));
    await expect(page.locator('.rs-roll .rs-roll-lbl')).not.toHaveText('...', { timeout: 15_000 });
    await page.waitForTimeout(400);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-roll-landed-${tag}.png` });
    expectKit(await chrome(page, buttons), 'ROLL chrome after a roll');
    d = await layoutDefects(page, { scope: '.rs-top' });
    expect(d.overlaps, 'top row overlaps after a roll').toEqual([]);

    await page.locator('[data-testid="roll-index"]').click();
    await expect(page.locator('.mx-tile').first()).toBeVisible();
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-index-${tag}.png` });
    expectKit(await chrome(page, '.mx-back'), 'INDEX ← ROLL');
  });
}
