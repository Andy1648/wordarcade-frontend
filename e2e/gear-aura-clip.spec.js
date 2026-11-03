// e2e/gear-aura-clip.spec.js — THE AURA IS NEVER CROPPED (Andy nov2: "borders are still cropping the gear auras (such as
// on leaderboard)"). Every EPIC+ gear wears a GearFx aura (.gfx — a baked 9-slice glow laid --gfx-out px round its card).
// The earlier fit checks measured the gear ART box and skipped .gfx by design, so a scroll box / overflow:hidden panel
// that sheared the glow into a hard edge passed. This walks every rendered .gfx and, for each ancestor that CLIPS
// (overflow other than visible on either axis, clip-path, contain:paint), asserts the whole aura rect sits inside that
// ancestor's padding box — on every surface a gear is drawn: the menu's YOUR GEAR slots, the EQUIP picker, the GEARS
// INDEX, the GEAR SHEET, the ROLL reveal + result stats, the leaderboard profile's gear sheet, the patch-notes cards.
// A card that is itself scrolled out of a list's box (the INDEX grid scrolled, a reel cell passing the window) is that
// list's own scroll, not a crop, and is skipped. Measured at rest (reduced motion: the aura stays, still).
// AURA_SHOTS=<name> saves a screenshot of each surface to ../wa-aura-shots/<name>/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady, navControl } from './support/menu.js';
import { holdRoll } from './support/roll.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const SIZES = [[1366, 768], [390, 844]];
const MYTHIC = 'mk-singularity';
const LEGENDARY = 'mk-thunderclap';
const OWN = [MYTHIC, LEGENDARY, 'mk-hydra', 'mk-origin', 'mk-brainstorm', 'mk-leviathan', 'mk-eclipse', 'mk-thunderclap', 'mk-detonator'];
const SECRET = 'a7'.repeat(24);
const FUTURE = Date.now() + 3_600_000;

const shot = async (page, name) => {
  const dir = process.env.AURA_SHOTS;
  if (!dir) return;
  fs.mkdirSync(`../wa-aura-shots/${dir}`, { recursive: true });
  const vp = page.viewportSize();
  await page.screenshot({ path: `../wa-aura-shots/${dir}/${name}-${vp.width}x${vp.height}.png` });
};

async function boot(page, w, h, { patch = true, extra = {} } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  const marks = {};
  OWN.forEach((id, i) => { marks[id] = { n: 9, first: 1 + i }; });
  await page.addInitScript(({ marks, patch, PATCH_ID, extra, MYTHIC, LEGENDARY }) => {
    if (sessionStorage.getItem('ac.seeded')) return;
    sessionStorage.setItem('ac.seeded', '1');
    const seed = {
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1',
      'taw.xp': JSON.stringify({ lv: 60, into: 0 }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 9, v: 10 }), 'taw.s2.rebirths': '9',
      'taw.markRolls': JSON.stringify({ v: 3, rolls: 999, sinceEpic: 0, sinceLegendary: 0, everEpic: true, starter: true, marks, milestones: [] }),
      'taw.mark': MYTHIC, 'taw.s2.mark2': LEGENDARY,
      ...extra,
    };
    if (patch) seed['taw.seen.patch'] = PATCH_ID;
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, { marks, patch, PATCH_ID, extra, MYTHIC, LEGENDARY });
}

/** Every rendered aura that a clipping ancestor cuts: ["<where> cut Npx by .<ancestor>"]. */
function auraCuts(page) {
  return page.evaluate(() => {
    const out = [];
    let seen = 0;
    const clipsOf = (s) => s.overflowX !== 'visible' || s.overflowY !== 'visible' || (s.clipPath && s.clipPath !== 'none')
      || /paint|strict|content/.test(s.contain || '');
    for (const g of document.querySelectorAll('.gfx')) {
      const g0 = g.getBoundingClientRect();
      if (g0.width < 1 || g0.height < 1) continue;
      // the screen's own edge is not a border: only the part of the aura that is on screen must be uncut
      const a = { left: Math.max(0, g0.left), top: Math.max(0, g0.top), right: Math.min(innerWidth, g0.right), bottom: Math.min(innerHeight, g0.bottom) };
      const host = g.parentElement;
      const hb = host.getBoundingClientRect();
      if (hb.width < 1 || hb.height < 1) continue;
      // the ROLL reel's passing cells: the band is a sideways strip whose ends are the reel's own edge fades (opaque
      // #08030f at the clip line, RollScreen.css .rs-win::before/after) — only the LANDED cell is a card on show
      if (host.matches('.rs-cell:not(.is-land)')) continue;
      seen += 1;
      const where = `${g.dataset.glow} in .${(host.className || '').toString().split(' ')[0]}`;
      // an ancestor's overflow only clips a box whose CONTAINING-BLOCK chain runs through it: an absolute box escapes
      // a static clipper, a fixed one escapes every clipper short of a transform / filter / contain ancestor
      const fixedCb = (s) => s.transform !== 'none' || s.perspective !== 'none' || s.filter !== 'none'
        || /paint|layout|strict|content/.test(s.contain || '') || /transform|perspective|filter/.test(s.willChange || '');
      const cbFor = (need, s) => need === 'any' || fixedCb(s) || (need === 'positioned' && s.position !== 'static');
      const needOf = (s) => (s.position === 'fixed' ? 'fixed' : s.position === 'absolute' ? 'positioned' : 'any');
      let need = needOf(getComputedStyle(g));
      for (let el = host; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        const s = getComputedStyle(el);
        const isCb = cbFor(need, s);
        if (isCb) need = needOf(s);
        if (!isCb || !clipsOf(s)) continue;
        const r = el.getBoundingClientRect();
        const box = {
          l: r.left + parseFloat(s.borderLeftWidth), r: r.right - parseFloat(s.borderRightWidth),
          t: r.top + parseFloat(s.borderTopWidth), b: r.bottom - parseFloat(s.borderBottomWidth),
        };
        // the CARD itself is (partly) outside this box: a list's own scroll / a reel cell passing — not a crop
        if (hb.left < box.l - 1 || hb.right > box.r + 1 || hb.top < box.t - 1 || hb.bottom > box.b + 1) break;
        // per axis: overflow: clip visible (the ROLL reel band) clips sideways only
        const all = (s.clipPath && s.clipPath !== 'none') || /paint|strict|content/.test(s.contain || '');
        const cx = all || s.overflowX !== 'visible' ? Math.max(box.l - a.left, a.right - box.r) : 0;
        const cy = all || s.overflowY !== 'visible' ? Math.max(box.t - a.top, a.bottom - box.b) : 0;
        const cut = Math.max(cx, cy);
        if (cut > 2) out.push(`${where} cut ${Math.round(cut)}px by .${(el.className || el.tagName).toString().split(' ')[0]}`);
      }
    }
    return { out: [...new Set(out)], seen };
  });
}

async function expectUncut(page, name, min = 1) {
  await page.waitForTimeout(450); // pop-ins land
  await shot(page, name);
  const r = await auraCuts(page);
  expect(r.seen, `${name}: auras rendered`).toBeGreaterThanOrEqual(min);
  expect.soft(r.out, `${name}: no aura cropped`).toEqual([]);
}

for (const [w, h] of SIZES) {
  test(`@${w}x${h} menu YOUR GEAR + EQUIP + INDEX + GEAR SHEET: no aura cropped`, async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page, w, h);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await expectUncut(page, 'menu-your-gear', w > 480 ? 1 : 0); // the phone menu's GEAR chip wears no aura
    // EQUIP picker
    await page.locator('.menu-mark').first().click();
    const equip = page.getByTestId('equip-screen');
    await expect(equip.locator('.mx-tile').first()).toBeVisible();
    await expectUncut(page, 'equip-picker', 2);
    await page.keyboard.press('Escape');
    await expect(equip).toHaveCount(0);
    // GEARS INDEX
    await navControl(page, 'gears').first().click();
    await page.getByTestId('roll-index').click();
    await page.locator('.mx-panel').waitFor();
    await expectUncut(page, 'gears-index', 2);
    // GEAR SHEET (the mythic)
    await page.locator(`.mx-tile[data-mark="${MYTHIC}"]`).first().click();
    await expect(page.locator('.mx-sheet')).toBeVisible();
    await expectUncut(page, 'gear-sheet-mythic');
    await page.keyboard.press('Escape');
    await page.locator(`.mx-tile[data-mark="${LEGENDARY}"]`).first().click();
    await expect(page.locator('.mx-sheet')).toBeVisible();
    await expectUncut(page, 'gear-sheet-legendary');
  });

  test(`@${w}x${h} ROLL reveal + result stats: no aura cropped`, async ({ page }) => {
    test.setTimeout(60_000);
    // the LEGENDARY pity at its last roll: this roll lands LEGENDARY+ (a glowing reveal), whatever the dice
    await boot(page, w, h, {
      extra: {
        // worn: a RARE (no perk) — a worn SINGULARITY's "every roll rolls twice" would show a RARE first half
        'taw.markRolls': JSON.stringify({ v: 3, rolls: 600, sinceEpic: 3, sinceLegendary: 59, everEpic: true, starter: true, marks: { 'mk-detonator': { n: 1, first: 1 } }, milestones: [] }),
        'taw.mark': 'mk-detonator',
        'taw.gems': JSON.stringify({ v: 1, bal: 1000, peak: 12, streak: 0, mig: 1 }),
        'taw.wins': '50000000',
      },
    });
    await page.goto('/?portal=1');
    await menuReady(page);
    await navControl(page, 'gears').first().click();
    await page.locator('.rs-overlay').waitFor();
    await holdRoll(page);
    const cut = page.getByTestId('roll-cutscene');
    await expect(cut).toHaveClass(/is-on/, { timeout: 12_000 });
    await page.waitForTimeout(1200);
    await expectUncut(page, 'roll-reveal');
    await cut.click();
    await expect(cut).not.toHaveClass(/is-on/, { timeout: 3000 });
    await expect(page.locator('[data-testid="mark-roll-result"]')).toHaveCount(1);
    await expectUncut(page, 'roll-result');
  });

  test(`@${w}x${h} LEADERBOARD profile → gear sheet: no aura cropped`, async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page, w, h);
    await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
    const row = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });
    const rows = [row('a', 'ALPHA', { level: 900 }), row('b', 'BRAVO', { level: 800 }), row('c', 'CHARLIE', { level: 700 }), row('d', 'DELTA', { level: 600 }), row('me', 'NOBUFF', { level: 60 })];
    await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, season2: true });
    await page.addInitScript(({ secret }) => {
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
      localStorage.setItem('taw.lb.secret', secret);
    }, { secret: SECRET });
    const SHOW = { gear1: MYTHIC, gear2: LEGENDARY, base_wins: 190, wins_per_word: 5130, gears_found: 9, gears_total: 27, power: 6 };
    await page.goto('/?portal=1&season2=1');
    await page.route('**/rest/v1/profile_showcase*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SHOW]) }));
    await menuReady(page);
    await navControl(page, 'leaderboard').first().click();
    const lb = page.locator('.lb2');
    await lb.waitFor({ state: 'visible' });
    await lb.locator('.lb2-row[data-id="d"]').click();
    const pc = page.getByTestId('profile-card');
    await expect(pc.getByTestId('profile-gear-1')).toBeVisible();
    await shot(page, 'lb-profile');
    await pc.getByTestId('profile-gear-1').click();
    await expect(page.locator('.mx-sheet')).toBeVisible();
    await expectUncut(page, 'lb-gear-sheet-mythic');
    await page.locator('.mx-sheet-close').click();
    await pc.getByTestId('profile-gear-2').click();
    await expect(page.locator('.mx-sheet')).toBeVisible();
    await expectUncut(page, 'lb-gear-sheet-legendary');
  });

  test(`@${w}x${h} PATCH NOTES gear cards: no aura cropped`, async ({ page }) => {
    await boot(page, w, h);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.locator('[data-nav="news"]:visible').first().click();
    const pn = page.getByTestId('patch-notes');
    await expect(pn).toBeVisible();
    await expectUncut(page, 'patch-notes', 2);
  });
}
