// e2e/gear-borders.spec.js — GEAR CARD BORDERS NEVER CUT EACH OTHER (Andy nov4: "borders cutting each other off … a
// rookie mistake, worse than overlapping"). A gear card's PAINTED BORDER is its .mc box plus its frame variant
// (.mc-frame-x, the MYTHIC / SECRET horns + brackets that hang 24px outside the card). On every surface a gear card is
// drawn — the menu's YOUR GEAR slots, the EQUIP picker, the GEARS INDEX, the GEAR SHEET, the ROLL reveal (LEGENDARY + a
// forced MYTHIC) + result, the leaderboard profile — this asserts:
//   1. no two cards' painted borders intersect (a frame drawn into a neighbour reads as one card cut by the other);
//   2. no card's aura (.gfx) runs under a NEIGHBOUR's painted border (the neighbour's frame slices the glow);
//   3. no clipping ancestor (overflow / clip-path / contain) cuts into a painted border;
//   4. the reveal's backplate is square and holds the whole card (frame included) — never a plate the card slices.
// (The patch-notes pair is FANNED on purpose — tilted, overlapping, the sanctioned composition — and is not checked.)
// A card scrolled out of a list's box (INDEX grid scrolled) or passing in the ROLL reel is that list's scroll, skipped.
// BORDER_SHOTS=<dir> saves a screenshot of each surface there.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady, navControl } from './support/menu.js';
import { holdRoll } from './support/roll.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const SIZES = [[1366, 768], [1920, 1080], [390, 844]];
const MYTHIC = 'mk-singularity';
const LEGENDARY = 'mk-thunderclap';
const OWN = [MYTHIC, LEGENDARY, 'mk-hydra', 'mk-origin', 'mk-brainstorm', 'mk-leviathan', 'mk-eclipse', 'mk-thunderclap', 'mk-detonator'];
const SECRET = 'a7'.repeat(24);
const FUTURE = Date.now() + 3_600_000;

const shot = async (page, name) => {
  const dir = process.env.BORDER_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const vp = page.viewportSize();
  await page.screenshot({ path: `${dir}/${name}-${vp.width}x${vp.height}.png` });
};

async function boot(page, w, h, { extra = {} } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  const marks = {};
  OWN.forEach((id, i) => { marks[id] = { n: 9, first: 1 + i }; });
  await page.addInitScript(({ marks, PATCH_ID, extra, MYTHIC, LEGENDARY }) => {
    if (sessionStorage.getItem('gb.seeded')) return;
    sessionStorage.setItem('gb.seeded', '1');
    const seed = {
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1',
      'taw.xp': JSON.stringify({ lv: 60, into: 0 }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 9, v: 10 }), 'taw.s2.rebirths': '9',
      'taw.markRolls': JSON.stringify({ v: 3, rolls: 999, sinceEpic: 0, sinceLegendary: 0, everEpic: true, starter: true, marks, milestones: [] }),
      'taw.mark': MYTHIC, 'taw.s2.mark2': LEGENDARY, 'taw.seen.patch': PATCH_ID,
      ...extra,
    };
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, { marks, PATCH_ID, extra, MYTHIC, LEGENDARY });
}

/** Every painted-border defect on screen: ["<what>"]. */
function borderDefects(page, { fanned = false } = {}) {
  return page.evaluate(({ fanned }) => {
    const out = [];
    const vis = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      for (let e = el; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.05) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const union = (a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) });
    const inter = (a, b) => Math.min(Math.min(a.right, b.right) - Math.max(a.left, b.left), Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const nameOf = (c) => `${c.dataset.tier} ${(c.closest('[data-mark]') || {}).dataset?.mark || ''}`.trim();
    // a card UNDER something (the INDEX behind an open gear sheet, the reel under the reveal) is not on show
    const onTop = (c) => {
      const r = c.getBoundingClientRect();
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
      const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height * 0.4));
      const t = document.elementFromPoint(x, y);
      return !!t && (c.contains(t) || c.parentElement.contains(t));
    };
    const cards = [...document.querySelectorAll('.mc')]
      .filter((c) => vis(c) && !c.closest('.rs-cell:not(.is-land)') && onTop(c))
      .map((c) => {
        let box = c.getBoundingClientRect();
        const fx = c.querySelector(':scope > .mc-face > .mc-frame-x');
        if (fx && vis(fx)) box = union(box, fx.getBoundingClientRect());
        const host = c.parentElement;
        const g = host && host.querySelector(':scope > .gfx');
        return { c, box, aura: g && vis(g) ? g.getBoundingClientRect() : null, name: nameOf(c) };
      });
    // 1 + 2: neighbours
    if (!fanned) {
      for (let i = 0; i < cards.length; i += 1) {
        for (let j = 0; j < cards.length; j += 1) {
          if (i === j) continue;
          const A = cards[i]; const B = cards[j];
          if (A.c.contains(B.c) || B.c.contains(A.c)) continue;
          if (j > i) {
            const o = inter(A.box, B.box);
            if (o > 1) out.push(`border ${A.name} ∩ border ${B.name} by ${Math.round(o)}px`);
          }
          if (A.aura) {
            const o = inter(A.aura, B.box);
            if (o > 2) out.push(`aura of ${A.name} under border ${B.name} by ${Math.round(o)}px`);
          }
        }
      }
    }
    // the reveal's BACKPLATE is a mat round the card: the card sits wholly inside it, square — never a tilted plate the
    // card's border slices across
    for (const p of document.querySelectorAll('.rs-cut.is-on .rv-plate')) {
      if (!vis(p)) continue;
      const t = getComputedStyle(p).transform;
      if (t && t !== 'none' && !/^matrix\(1, 0, 0, 1,/.test(t)) out.push(`reveal plate is tilted (${t})`);
      const pr = p.getBoundingClientRect();
      const card = p.parentElement.querySelector('.mc');
      const fx = card && card.querySelector('.mc-frame-x');
      const cr = card && (fx && vis(fx) ? union(card.getBoundingClientRect(), fx.getBoundingClientRect()) : card.getBoundingClientRect());
      if (cr && (cr.left < pr.left - 1 || cr.right > pr.right + 1 || cr.top < pr.top - 1 || cr.bottom > pr.bottom + 1)) out.push('reveal card pokes out of its plate');
    }
    // 3: a clipping ancestor cuts into a painted border
    const clipsOf = (s) => s.overflowX !== 'visible' || s.overflowY !== 'visible' || (s.clipPath && s.clipPath !== 'none') || /paint|strict|content/.test(s.contain || '');
    for (const { c, box, name } of cards) {
      const cb = c.getBoundingClientRect();
      const a = { left: Math.max(0, box.left), top: Math.max(0, box.top), right: Math.min(innerWidth, box.right), bottom: Math.min(innerHeight, box.bottom) };
      for (let el = c.parentElement; el && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (!clipsOf(s)) continue;
        const r = el.getBoundingClientRect();
        const bx = { l: r.left + parseFloat(s.borderLeftWidth), r: r.right - parseFloat(s.borderRightWidth), t: r.top + parseFloat(s.borderTopWidth), b: r.bottom - parseFloat(s.borderBottomWidth) };
        if (cb.left < bx.l - 1 || cb.right > bx.r + 1 || cb.top < bx.t - 1 || cb.bottom > bx.b + 1) break; // scrolled out: the list's own scroll
        const all = (s.clipPath && s.clipPath !== 'none') || /paint|strict|content/.test(s.contain || '');
        const cx = all || s.overflowX !== 'visible' ? Math.max(bx.l - a.left, a.right - bx.r) : 0;
        const cy = all || s.overflowY !== 'visible' ? Math.max(bx.t - a.top, a.bottom - bx.b) : 0;
        const cut = Math.max(cx, cy);
        if (cut > 1) out.push(`border ${name} clipped ${Math.round(cut)}px by .${(el.className || el.tagName).toString().split(' ')[0]}`);
      }
    }
    return { out: [...new Set(out)], seen: cards.length };
  }, { fanned });
}

async function expectClean(page, name, { min = 1, fanned = false } = {}) {
  await page.waitForTimeout(500); // pop-ins land
  await shot(page, name);
  const r = await borderDefects(page, { fanned });
  expect(r.seen, `${name}: cards rendered`).toBeGreaterThanOrEqual(min);
  expect.soft(r.out, `${name}: no painted border cut`).toEqual([]);
}

for (const [w, h] of SIZES) {
  test(`@${w}x${h} YOUR GEAR + EQUIP + INDEX + GEAR SHEET: borders never cut each other`, async ({ page }) => {
    test.setTimeout(90_000);
    await boot(page, w, h);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await expectClean(page, 'menu-your-gear', { min: 0 });
    await page.locator('.menu-mark').first().click();
    const equip = page.getByTestId('equip-screen');
    await expect(equip.locator('.mx-tile').first()).toBeVisible();
    await expectClean(page, 'equip-picker', { min: 2 });
    await page.keyboard.press('Escape');
    await expect(equip).toHaveCount(0);
    await navControl(page, 'gears').first().click();
    await page.locator('.rs-overlay').waitFor();
    await expectClean(page, 'gears-screen', { min: 0 });
    await page.getByTestId('roll-index').click();
    await page.locator('.mx-panel').waitFor();
    await expectClean(page, 'gears-index', { min: 2 });
    // the index scrolled to its end (the extreme: the last row against the panel's floor)
    await page.locator('.mx-panel').evaluate((el) => { const s = [el, ...el.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (s) s.scrollTop = s.scrollHeight; });
    await expectClean(page, 'gears-index-end', { min: 1 });
    await page.locator(`.mx-tile[data-mark="${MYTHIC}"]`).first().scrollIntoViewIfNeeded();
    await page.locator(`.mx-tile[data-mark="${MYTHIC}"]`).first().click();
    await expect(page.locator('.mx-sheet')).toBeVisible();
    await expectClean(page, 'gear-sheet-mythic');
    await page.keyboard.press('Escape');
    await page.locator(`.mx-tile[data-mark="${LEGENDARY}"]`).first().click();
    await expect(page.locator('.mx-sheet')).toBeVisible();
    await expectClean(page, 'gear-sheet-legendary');
  });

  for (const [tier, rnd] of [['legendary', 0], ['mythic', 0.9996]]) test(`@${w}x${h} ROLL ${tier} reveal + result: borders never cut each other`, async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page, w, h, {
      extra: {
        'taw.markRolls': JSON.stringify({ v: 3, rolls: 600, sinceEpic: 3, sinceLegendary: 59, everEpic: true, starter: true, marks: { 'mk-detonator': { n: 1, first: 1 } }, milestones: [] }),
        'taw.mark': 'mk-detonator',
        'taw.gems': JSON.stringify({ v: 1, bal: 1000, peak: 12, streak: 0, mig: 1 }),
        'taw.wins': '50000000',
      },
    });
    // MYTHIC is forced by pinning the roll's Math.random for the press only (as e2e/roll-shards.spec.js)
    if (rnd) await page.addInitScript((r) => { const real = Math.random; Math.random = () => (window.__rollRng ? r : real()); }, rnd);
    await page.goto('/?portal=1');
    await menuReady(page);
    await navControl(page, 'gears').first().click();
    await page.locator('.rs-overlay').waitFor();
    await page.evaluate(() => { window.__rollRng = true; });
    await holdRoll(page);
    const cut = page.getByTestId('roll-cutscene');
    await expect(cut).toHaveClass(/is-on/, { timeout: 12_000 });
    await page.evaluate(() => { window.__rollRng = false; });
    // the dice can beat what we aim for: the LEGENDARY pity means LEGENDARY OR BETTER, and the seeded gears' roll luck can
    // climb the pinned MYTHIC to SECRET — every one of them must keep its borders clean, so any of them is a pass
    await expect(cut).toHaveClass(tier === 'mythic' ? /is-(mythic|secret)/ : /is-(legendary|mythic|secret)/);
    // a MYTHIC / SECRET reveal holds its telegraph for seconds on a slow machine: wait for the face itself, then let it settle
    await expect.poll(async () => (await borderDefects(page)).seen, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(1200);
    await expectClean(page, `roll-reveal-${tier}`);
    await cut.click();
    await expect(cut).not.toHaveClass(/is-on/, { timeout: 3000 });
    await expect(page.locator('[data-testid="mark-roll-result"]')).toHaveCount(1);
    await expectClean(page, `roll-result-${tier}`, { min: 0 });
  });

  test(`@${w}x${h} LEADERBOARD profile gear chips + sheet: borders never cut each other`, async ({ page }) => {
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
    await expectClean(page, 'lb-profile', { min: 0 });
    await pc.getByTestId('profile-gear-1').click();
    await expect(page.locator('.mx-sheet')).toBeVisible();
    await expectClean(page, 'lb-gear-sheet');
  });
}
