// measure-empty.mjs — BE-PICKY largest-empty-rectangle proxy. Rasterises the card region,
// marks pixels covered by any content-bearing (text / img / svg / bordered) element, then
// finds the largest all-empty axis-aligned rectangle (classic histogram method). Prints the
// area as a % of the root's area. Flat colour fields count as EMPTY (per BE-PICKY).
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

async function openSolo(p, game) {
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch {} });
  await p.goto('/?portal=1&soloms=20000'); await waitImg(p); await p.waitForTimeout(300);
  await p.locator(`.game-card-magnet[data-game="${game}"] .game-card`).click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root').waitFor();
  const i = p.locator('.solo-root input').first(); await i.waitFor(); await i.fill(game === 'chain' ? 'e' : 'a'); await p.waitForTimeout(600);
}

async function largestEmptyPct(page, rootSel) {
  return page.evaluate((rootSel) => {
    const root = document.querySelector(rootSel);
    const rb = root.getBoundingClientRect();
    const CELL = 6; // px grid
    const cols = Math.max(1, Math.floor(rb.width / CELL));
    const rows = Math.max(1, Math.floor(rb.height / CELL));
    const filled = new Uint8Array(cols * rows);
    const mark = (r) => {
      const x0 = Math.max(rb.left, r.left), y0 = Math.max(rb.top, r.top);
      const x1 = Math.min(rb.right, r.right), y1 = Math.min(rb.bottom, r.bottom);
      if (x1 <= x0 || y1 <= y0) return;
      const c0 = Math.floor((x0 - rb.left) / CELL), c1 = Math.ceil((x1 - rb.left) / CELL);
      const rr0 = Math.floor((y0 - rb.top) / CELL), rr1 = Math.ceil((y1 - rb.top) / CELL);
      for (let yy = rr0; yy < rr1 && yy < rows; yy++) for (let xx = c0; xx < c1 && xx < cols; xx++) filled[yy * cols + xx] = 1;
    };
    const walk = (el) => {
      for (const child of el.children) {
        const cs = getComputedStyle(child);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.06) continue;
        const tag = child.tagName.toLowerCase();
        const hasBorder = ['top', 'right', 'bottom', 'left'].some((s) => parseFloat(cs['border' + s[0].toUpperCase() + s.slice(1) + 'Width']) > 0.5 && cs['border' + s[0].toUpperCase() + s.slice(1) + 'Style'] !== 'none');
        const directText = Array.from(child.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length);
        const isArt = tag === 'img' || tag === 'svg';
        // treat faint decorative motif (opacity handled above) + very-low-opacity as content only if >=0.06
        if (directText || isArt || hasBorder) mark(child.getBoundingClientRect());
        walk(child);
      }
    };
    walk(root);
    // largest all-empty rectangle via max-rectangle-in-histogram over the empty grid
    const height = new Int32Array(cols);
    let best = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) height[x] = filled[y * cols + x] ? 0 : height[x] + 1;
      const stack = [];
      for (let x = 0; x <= cols; x++) {
        const h = x < cols ? height[x] : 0;
        let start = x;
        while (stack.length && stack[stack.length - 1][1] >= h) {
          const [sx, sh] = stack.pop();
          best = Math.max(best, sh * (x - sx));
          start = sx;
        }
        stack.push([start, h]);
      }
    }
    const areaCells = cols * rows;
    return { pct: Math.round((best / areaCells) * 1000) / 10, root: { w: Math.round(rb.width), h: Math.round(rb.height) } };
  }, rootSel);
}

const browser = await chromium.launch();
const results = {};
for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  for (const game of ['chain', 'fuse']) {
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); await installBackendMock(p);
    try { await openSolo(p, game); const r = await largestEmptyPct(p, '.solo-root'); results[`${game}-play-${tag}`] = r; }
    catch (e) { results[`${game}-play-${tag}`] = { err: String(e).split('\n')[0].slice(0, 80) }; }
    await ctx.close();
  }
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
