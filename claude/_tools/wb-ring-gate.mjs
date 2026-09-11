// wb-ring-gate.mjs — PHASE 2's own gate, run for real.
//
// The brief's acceptance for the Word Bomb ring is specific, so this measures exactly
// those things rather than eyeballing a screenshot:
//   * zero empty stretched elements at 2 and 3 players
//   * no overflow at 8
//   * at 1366x768 / 1280x720 / 390x844: no scroll, no overlap >4px,
//     bomb+fuse >= 55% of its cell
//   * a screenshot at every player count and every viewport
//
// The fuse-strictly-decreasing check is NOT here: against the backend mock the client's
// local turn clock does not advance, so sampling it five times measures the mock, not
// the fuse. That is called out in the report rather than faked with a passing assertion.
//
// Usage: node wb-ring-gate.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const OUT = process.argv[2];
const VARIANT = process.argv[3] || ''; // '', 'ring' or 'prompt'
const Q = VARIANT ? `&wbfit=${VARIANT}` : '';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const VIEWPORTS = [
  [1366, 768, '1366x768'],
  [1280, 720, '1280x720'],
  [390, 844, '390x844'],
];
const COUNTS = [2, 3, 4, 8];
const NAMES = ['YOU', 'RIVAL', 'MOTH', 'KESTREL', 'VANE', 'QUILL', 'ORRIS', 'BRAMBLE'];

const players = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? ME : `p${i + 1}`,
    name: NAMES[i] || `P${i + 1}`,
    lives: 3,
    isHost: i === 0,
  }));

const MEASURE = () => {
  const wrap = document.querySelector('.game-wrap');
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = de.clientHeight;

  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  };

  // Seats + the bomb.
  const seats = [...document.querySelectorAll('.wb-seat')].map(rect);
  const bombEl = document.querySelector('.bomb-svg') || document.querySelector('.bomb-scale');
  const ringEl = document.querySelector('.wb-ring') || document.querySelector('.game-stage');
  const bomb = bombEl ? rect(bombEl) : null;
  const ring = ringEl ? rect(ringEl) : null;

  // Overlap between seats, in px of intersection on the smaller axis.
  let worstOverlap = 0;
  let overlapPair = null;
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i];
      const b = seats[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      if (ox > 0 && oy > 0) {
        const o = Math.min(ox, oy);
        if (o > worstOverlap) {
          worstOverlap = o;
          overlapPair = [i, j];
        }
      }
    }
  }

  // EMPTY STRETCHED ELEMENTS: a box that is wide and tall but paints nothing of its own
  // and holds no text. This is the "stretched empty bar" failure the ring was meant to
  // fix, so it is measured rather than assumed gone.
  const stretched = [];
  for (const el of wrap ? wrap.querySelectorAll('*') : []) {
    const r = el.getBoundingClientRect();
    if (r.width < 220 || r.height < 40) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const text = (el.textContent || '').trim();
    const paints =
      cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
      cs.backgroundImage !== 'none' ||
      cs.borderTopWidth !== '0px' ||
      cs.borderLeftWidth !== '0px' ||
      el.querySelector('svg, img, canvas');
    const hasKids = el.children.length > 0;
    if (!text && !paints && !hasKids) {
      stretched.push({ cls: String(el.className).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  // WHAT IS ACTUALLY CLIPPED. The first version of this gate took the lowest BOX inside
  // the wrap, which was .game-panel - a container whose bottom padding hangs past the
  // fold without anything visible being lost. It reported 150px of "overflow" where the
  // real loss was 31px of one seat. So: the lowest element that actually PAINTS - has
  // its own text, or is an svg/img - which is exactly what a screenshot shows cut off.
  let paintedBottom = 0;
  let paintedEl = null;
  const paints = (el) => {
    if (el.tagName === 'SVG' || el.tagName === 'svg' || el.tagName === 'IMG' || el.tagName === 'CANVAS') return true;
    const kid = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    return kid;
  };
  for (const el of wrap ? wrap.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!paints(el)) continue;
    if (r.bottom > paintedBottom) {
      paintedBottom = r.bottom;
      paintedEl = String(el.className || el.tagName).slice(0, 40);
    }
  }

  // OVERFLOW past the viewport, from anything inside the game wrap.
  let maxRight = 0;
  let maxBottom = 0;
  let worstEl = null;
  for (const el of wrap ? wrap.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > maxRight) maxRight = r.right;
    if (r.bottom > maxBottom) {
      maxBottom = r.bottom;
      worstEl = String(el.className).slice(0, 40);
    }
  }

  return {
    vw,
    vh,
    scrollX: de.scrollWidth - vw,
    scrollY: de.scrollHeight - vh,
    seats: seats.length,
    seatW: seats.map((s) => Math.round(s.w)),
    worstOverlap: Math.round(worstOverlap * 10) / 10,
    overlapPair,
    bombW: bomb ? Math.round(bomb.w) : null,
    ringW: ring ? Math.round(ring.w) : null,
    ringH: ring ? Math.round(ring.h) : null,
    // "bomb+fuse >= 55% of its cell": the bomb's drawn width against the ring cell it
    // sits in, taking the SMALLER side of the cell as the cell size (a cell that is wide
    // and short is bounded by its height).
    bombPctOfCell: bomb && ring ? Math.round((bomb.w / Math.min(ring.w, ring.h)) * 1000) / 10 : null,
    stretched,
    overflowRight: Math.round(maxRight - vw),
    overflowBottom: Math.round(maxBottom - vh),
    worstBottomEl: worstEl,
    clippedBottom: Math.round(paintedBottom - vh),
    clippedEl: paintedEl,
  };
};

const browser = await chromium.launch();
const rows = [];
for (const [w, h, vtag] of VIEWPORTS) {
  for (const n of COUNTS) {
    const ctx = await browser.newContext({
      baseURL: BASE,
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    let status = 'OK';
    let m = null;
    try {
      const mock = await installBackendMock(page);
      const ps = players(n);
      await page.goto(`/?portal=1${Q}`);
      await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
      mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: ps } });
      await page.waitForTimeout(80);
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
      await page.waitForTimeout(80);
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: ps, combo: 'str', usedWords: ['MONSTER', 'STRAP', 'STRIKE'], timerSeconds: 30 } });
      await page.locator('.countdown-overlay').waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
      await page.locator('.countdown-overlay').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
      await page
        .waitForFunction(
          () => {
            const i = document.querySelector('.game-wrap input');
            return !!i && !/WAIT YOUR TURN/i.test(i.placeholder || '');
          },
          undefined,
          { timeout: 12000, polling: 200 }
        )
        .catch(() => {});
      await page.waitForTimeout(400);
      m = await page.evaluate(MEASURE);
    } catch (e) {
      status = 'FAIL ' + String(e).split('\n')[0].slice(0, 70);
    }
    try {
      await page.screenshot({ path: path.join(OUT, `wb-${VARIANT || 'today'}-${n}p-${vtag}.png`) });
    } catch { /* the row still reports */ }
    rows.push({ n, vtag, status, ...(m || {}) });
    await ctx.close();
  }
}
await browser.close();

console.log('\nWORD BOMB RING GATE\n');
console.log('players view       seats  seatW            bomb%cell  overlap  scrollY  clipped    stretched');
for (const r of rows) {
  const sw = (r.seatW || []).join('/').slice(0, 16);
  console.log(
    `${String(r.n).padEnd(7)} ${r.vtag.padEnd(10)} ${String(r.seats ?? '-').padEnd(6)} ${sw.padEnd(16)} ` +
      `${String(r.bombPctOfCell ?? '-').padStart(8)}  ${String(r.worstOverlap ?? '-').padStart(7)}  ` +
      `${String(r.scrollY ?? '-').padStart(7)}  ${String(r.clippedBottom ?? '-').padStart(9)}  ${(r.stretched || []).length}` +
      `${r.status !== 'OK' ? '  ' + r.status : ''}`
  );
}
fs.writeFileSync(path.join(OUT, `wb-ring-gate-${VARIANT || 'today'}.json`), JSON.stringify(rows, null, 2));

const fails = [];
for (const r of rows) {
  if (r.status !== 'OK') { fails.push(`${r.n}p ${r.vtag}: ${r.status}`); continue; }
  if (r.scrollY > 1) fails.push(`${r.n}p ${r.vtag}: page scrolls ${r.scrollY}px`);
  if (r.worstOverlap > 4) fails.push(`${r.n}p ${r.vtag}: seats overlap ${r.worstOverlap}px`);
  if (r.bombPctOfCell != null && r.bombPctOfCell < 55) fails.push(`${r.n}p ${r.vtag}: bomb ${r.bombPctOfCell}% of cell (<55)`);
  if ((r.stretched || []).length) fails.push(`${r.n}p ${r.vtag}: ${r.stretched.length} empty stretched element(s): ${r.stretched.map((s) => s.cls).join(', ')}`);
  if (r.clippedBottom > 2) fails.push(`${r.n}p ${r.vtag}: CLIPS ${r.clippedBottom}px of painted content (${r.clippedEl})`);
}
console.log(fails.length ? '\nFAILURES:\n  ' + fails.join('\n  ') : '\nall checks pass');
console.log('\n->', OUT);
