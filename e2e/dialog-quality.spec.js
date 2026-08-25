// e2e/dialog-quality.spec.js — items 1 & 4: the mode dialog opens with <= 3 concurrent
// animations and NO canvas (the rAF draw loop is gone), and no element in any dialog is cut off
// by a non-scroll clip ancestor at any viewport.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function menu(page, level) {
  await installBackendMock(page);
  if (level != null) {
    await page.addInitScript((lv) => {
      try {
        localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 }));
        localStorage.setItem('taw.wins', '999999');
      } catch { /* ignore */ }
    }, level);
  }
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(1500);
}

// Report elements exceeding their nearest NON-scroll clipping ancestor (a genuine cut-off),
// ignoring decorative SVG geometry (clipped by the svg's own overflow).
function scanFn() {
  return (panelSel) => {
    const SVG = new Set(['svg', 'line', 'path', 'circle', 'g', 'rect', 'polygon', 'ellipse']);
    const panel = document.querySelector(panelSel);
    if (!panel) return ['NO PANEL'];
    const bad = [];
    for (const el of panel.querySelectorAll('*')) {
      if (SVG.has(el.tagName.toLowerCase())) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let anc = el.parentElement;
      let clip = null;
      while (anc && anc !== document.body) {
        const s = getComputedStyle(anc);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const scrollable = anc.scrollHeight > anc.clientHeight + 2 || anc.scrollWidth > anc.clientWidth + 2;
          if (!scrollable) { clip = anc; break; }
          break; // scroll container: overflow is scrollable, not a cut
        }
        anc = anc.parentElement;
      }
      if (!clip) continue;
      const cr = clip.getBoundingClientRect();
      const over = Math.max(r.right - cr.right, cr.left - r.left, r.bottom - cr.bottom, cr.top - r.top);
      if (over > 2) bad.push(`${(el.className || '').toString().split(' ')[0]} +${over.toFixed(0)}`);
    }
    return [...new Set(bad)];
  };
}

test('item 1: mode dialog opens with <= 3 animations and no canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await menu(page, 30);
  await page.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click();
  await page.waitForTimeout(60);
  const info = await page.evaluate(() => {
    const inDialog = (a) => { const t = a.effect && a.effect.target; return t && t.closest && t.closest('.mode-dialog-overlay'); };
    const anims = document.getAnimations().filter((a) => a.playState === 'running' && inDialog(a));
    return { count: anims.length, canvas: !!document.querySelector('.mode-dialog-bg-canvas') };
  });
  expect(info.canvas, 'canvas element must be gone').toBe(false);
  expect(info.count, 'concurrent dialog animations').toBeLessThanOrEqual(3);
});

const VIEWPORTS = [
  { w: 2560, h: 1440 }, { w: 1920, h: 1080 }, { w: 1440, h: 900 },
  { w: 1366, h: 768 }, { w: 1163, h: 501 }, { w: 390, h: 844 }, { w: 360, h: 640 },
];
for (const { w, h } of VIEWPORTS) {
  test(`item 4: no cut-off elements in the mode dialog @ ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await menu(page, 30);
    await page.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click();
    await page.waitForTimeout(250);
    const bad = await page.evaluate(scanFn(), '.mode-dialog-shell');
    expect(bad, `cut-off elements @ ${w}x${h}: ${bad.join(', ')}`).toEqual([]);
  });
}
