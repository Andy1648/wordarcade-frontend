// e2e/game-fill.spec.js — fix/game-fill GATE: the in-game solo stage (.solo-root) must FILL the
// viewport, the same bar menu-fill.spec.js holds the menu to. This is the guard that was MISSING:
// the fill gate only covered the menu, so the game screens silently rendered as a narrow centred
// column (CHAIN at 1280x551 filled ~36% of the width — two-thirds backdrop). CHAIN + FUSE are now
// exempt from the .view-screen --app-scale zoom (App.jsx) and fill the window like the menu does.
//
// TWO assertions, mirroring menu-fill (the second is the important one):
//   1) FILL — .solo-root fills >=90% of BOTH axes at every desktop viewport.
//   2) NO-ANCESTOR-ZOOM — nothing from .solo-root up to <body> carries a `zoom` != 1. A fill built
//      on ancestor zoom breaks per-browser (recent Chrome does not compound the reciprocal); the
//      menu regression came from exactly that, so we forbid it here too.
//
// fix/game-fill-2: all five modes are now exempt from the --app-scale zoom and fill the width.
// Word Bomb + Category Blitz get a wide-aspect / short-window reflow so the stage fills width AND
// fits height (no overflow). SAT Rush is a poster on a full-bleed board: the BOARD (.sr-app) is the
// filling surface (the poster is aspect-locked content on it, like the menu cards on the menu stage),
// so SAT is gated on .sr-app. This gate covers all five, plus the FUSE 26-tile strip.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
async function enterMpGame(page, gameType) {
  const players = gameType === 'word-bomb'
    ? [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }]
    : [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType } });
  await page.waitForTimeout(60);
  if (gameType === 'word-bomb') {
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER'], timerSeconds: 22 } });
  } else {
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
  }
  await page.locator('.game-stage').waitFor({ state: 'visible' });
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
}
async function enterSat(page) {
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } });
  await installBackendMock(page);
  await page.goto('/?satRush=1&portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await page.locator('[data-game="sat-rush"] .game-card').click({ force: true });
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /BRIEFING/ }).click();
  await page.locator('.sr-brief-page').waitFor({ state: 'visible', timeout: 6000 });
  await page.getByRole('button', { name: 'Start the run' }).click();
  await page.locator('.sr-slots').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(400);
}
async function fillOf(page, sel) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { err: 'no ' + sel };
    const r = el.getBoundingClientRect();
    const zoomed = [];
    let e = el;
    while (e) { const z = getComputedStyle(e).zoom; if (z && z !== '1' && z !== 'normal') zoomed.push(`${(e.className || e.tagName).toString().split(' ')[0]}=${z}`); e = e.parentElement; }
    const de = document.documentElement;
    const pageVScroll = Math.max(de.scrollHeight, document.body.scrollHeight) > de.clientHeight + 2;
    return { fw: r.width / window.innerWidth, fh: r.height / window.innerHeight, zoomed, pageVScroll };
  }, sel);
}

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1568, h: 675 }, // short height
  { w: 1366, h: 768 },
  { w: 1280, h: 551 }, // wide-short — the reported regression case
];
const MIN_FILL = 0.9;
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);

async function enterSolo(page, id) {
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ }
  });
  await installBackendMock(page);
  await page.goto('/?portal=1&soloms=20000');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await card(page, id).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.solo-root');
    const r = root.getBoundingClientRect();
    const zoomed = [];
    let el = root;
    while (el) {
      const z = getComputedStyle(el).zoom;
      if (z && z !== '1' && z !== 'normal') {
        zoomed.push(`${el.id ? '#' + el.id : '.' + (el.className || el.tagName).toString().split(' ')[0]}=${z}`);
      }
      el = el.parentElement;
    }
    // OVERFLOW: no in-flow element inside .solo-root may spill past the frame's own box.
    // (This is the guard for the CHAIN input that sat wider than its column.) Decorative art
    // (aria-hidden / SVG) and viewport-anchored overlays (fixed / the game-over layer) are
    // exempt — they are intentionally not bounded by the card.
    const TOL = 1;
    const over = [];
    for (const node of root.querySelectorAll('*')) {
      if (node === root) continue;
      if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') continue;
      if (node.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') < 0.01) continue;
      if (cs.position === 'fixed') continue;
      if (node.closest('.solo-over, .solo-fx, .solo-lucky')) continue;
      const b = node.getBoundingClientRect();
      if (b.width < 1 && b.height < 1) continue;
      if (b.right > r.right + TOL || b.left < r.left - TOL || b.bottom > r.bottom + TOL || b.top < r.top - TOL) {
        const cls = (node.className || node.tagName).toString().split(' ')[0];
        over.push(`${cls} [${Math.round(b.left)},${Math.round(b.right)}] vs root [${Math.round(r.left)},${Math.round(r.right)}]`);
      }
    }
    return { w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight, zoomed, over };
  });
}

// FUSE's core mechanic is lighting every letter for a life, so all 26 alphabet tiles MUST be
// visible and countable — a grid once clipped the 13th tile in each row (m / z vanished). Checked
// down to 390x844 (phone portrait), where the strip is a single column of its own.
test.describe('FUSE alphabet strip shows all 26 tiles', () => {
  for (const { w, h } of [...VIEWPORTS, { w: 390, h: 844 }]) {
    test(`fuse ${w}x${h}: strip has 26 visible tiles, none past the container`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await enterSolo(page, 'fuse');
      await page.locator('.solo-strip-big').waitFor({ state: 'visible', timeout: 8000 });
      const r = await page.evaluate(() => {
        const strip = document.querySelector('.solo-strip-big');
        if (!strip) return { err: 'no .solo-strip-big' };
        const sb = strip.getBoundingClientRect();
        const cells = [...strip.querySelectorAll('span')];
        const visible = cells.filter((c) => {
          const cs = getComputedStyle(c); const b = c.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width >= 1 && b.height >= 1;
        });
        const past = cells.filter((c) => {
          const b = c.getBoundingClientRect();
          return b.right > sb.right + 0.5 || b.left < sb.left - 0.5 || b.bottom > sb.bottom + 0.5;
        }).map((c) => c.textContent);
        const letters = cells.map((c) => c.textContent).join('');
        return { total: cells.length, visible: visible.length, past, letters };
      });
      // eslint-disable-next-line no-console
      console.log(`[strip] fuse ${w}x${h}  tiles=${r.total} visible=${r.visible} past=${JSON.stringify(r.past)}`);
      expect(r.err, 'strip present').toBeUndefined();
      expect(r.letters, 'strip is the full a–z').toBe('abcdefghijklmnopqrstuvwxyz');
      expect(r.visible, `all 26 tiles visible at ${w}x${h}`).toBe(26);
      expect(r.past, `no tile spills past the strip container at ${w}x${h}`).toEqual([]);
    });
  }
});

for (const id of ['chain', 'fuse']) {
  test.describe(`${id} fills the viewport`, () => {
    for (const { w, h } of VIEWPORTS) {
      test(`${id} ${w}x${h}: .solo-root fills >=90% of both axes with no ancestor zoom`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await enterSolo(page, id);
        const m = await measure(page);
        const fillW = m.w / m.vw;
        const fillH = m.h / m.vh;
        // eslint-disable-next-line no-console
        console.log(`[game-fill] ${id} ${w}x${h}  root=${Math.round(m.w)}x${Math.round(m.h)}  fillW=${(fillW * 100).toFixed(1)}%  fillH=${(fillH * 100).toFixed(1)}%  overflow=${m.over.length}  zoomedAncestors=${JSON.stringify(m.zoomed)}`);
        expect(m.zoomed, `${id} fill must not depend on ancestor zoom at ${w}x${h}`).toEqual([]);
        expect(m.over, `${id} no element may exceed .solo-root's bounds at ${w}x${h}`).toEqual([]);
        expect(fillW, `${id} .solo-root width fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
        expect(fillH, `${id} .solo-root height fill at ${w}x${h}`).toBeGreaterThanOrEqual(MIN_FILL);
      });
    }
  });
}

// --- fix/game-fill-2: WB / BLITZ / SAT fill the viewport (no ancestor zoom, no overflow) ---
const FILL_VPS = [
  { w: 1920, h: 1080 }, { w: 1568, h: 675 }, { w: 1366, h: 768 }, { w: 1280, h: 551 }, { w: 390, h: 844 },
];
for (const gt of ['word-bomb', 'category-blitz']) {
  test.describe(`${gt} fills the viewport`, () => {
    for (const { w, h } of FILL_VPS) {
      test(`${gt} ${w}x${h}: .game-stage fills width, no overflow, no ancestor zoom`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await enterMpGame(page, gt);
        const m = await fillOf(page, '.game-stage');
        // eslint-disable-next-line no-console
        console.log(`[game-fill] ${gt} ${w}x${h} fillW=${(m.fw * 100).toFixed(1)}% fillH=${(m.fh * 100).toFixed(1)}% vscroll=${m.pageVScroll} zoom=${JSON.stringify(m.zoomed)}`);
        expect(m.err).toBeUndefined();
        expect(m.zoomed, `no ancestor zoom @ ${w}x${h}`).toEqual([]);
        expect(m.pageVScroll, `no page vertical overflow @ ${w}x${h}`).toBe(false);
        expect(m.fh, `stage within viewport height @ ${w}x${h}`).toBeLessThanOrEqual(1.02);
        // width: >=0.85 (desktop hits ~0.90; the narrow-phone stage sits a touch lower).
        expect(m.fw, `.game-stage width fill @ ${w}x${h}`).toBeGreaterThanOrEqual(0.85);
      });
    }
  });
}
test.describe('SAT Rush board fills the viewport', () => {
  for (const { w, h } of FILL_VPS) {
    test(`sat ${w}x${h}: .sr-app board fills, no ancestor zoom`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await enterSat(page);
      const m = await fillOf(page, '.sr-app');
      // eslint-disable-next-line no-console
      console.log(`[game-fill] sat ${w}x${h} boardW=${(m.fw * 100).toFixed(1)}% boardH=${(m.fh * 100).toFixed(1)}% zoom=${JSON.stringify(m.zoomed)}`);
      expect(m.err).toBeUndefined();
      expect(m.zoomed, `no ancestor zoom @ ${w}x${h}`).toEqual([]);
      expect(m.fw, `.sr-app width fill @ ${w}x${h}`).toBeGreaterThanOrEqual(0.9);
      expect(m.fh, `.sr-app height fill @ ${w}x${h}`).toBeGreaterThanOrEqual(0.9);
    });
  }
});
