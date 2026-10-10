// e2e/rail-centre.spec.js — THE RAIL TILES ARE CENTRED (Andy oct9: "a lot of things are off center (on menu page - the
// gear icon, 'upgrades')"). For each of the four rail tiles — UPGRADES · GEARS · REBIRTH · STATS — the label, the icon
// and the number sit on the tile's vertical centre line, to 1px, at the laptop / desktop / phone sizes.
//
// THE ICON IS MEASURED BY ITS INK, not its box: a kit icon's art is not centred in its 100-unit viewBox (GEARS is drawn
// around the small cog the rail hides), so a centred BOX still reads off-centre. The icon's svg is rasterised (a clone
// on a canvas, stroke included, the CSS hard drop excluded) and the ink's centre is mapped onto the icon's on-screen
// box. The label is measured by its text (a Range over its glyphs), not its span.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const VIEWPORTS = [[1366, 657], [1280, 720], [1440, 900], [390, 844]];
const TOL = 1;

async function measure(page) {
  return page.evaluate(async () => {
    async function inkFrac(svg) {
      // the ink's centre as a fraction of the svg box (0.5 = centred), drawn with a margin so nothing clips
      const c = svg.cloneNode(true);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      c.setAttribute('width', '600');
      c.setAttribute('height', '600');
      c.setAttribute('viewBox', '-25 -25 150 150');
      c.removeAttribute('style');
      c.querySelectorAll('.x').forEach((n) => n.remove()); // the rail hides the extras (KitIcon extras={false})
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(c))}`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = 600;
      cv.height = 600;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, 600, 600).data;
      let L = 600, R = -1;
      for (let y = 0; y < 600; y += 1) {
        for (let x = 0; x < 600; x += 1) {
          if (d[(y * 600 + x) * 4 + 3] > 40) { if (x < L) L = x; if (x > R) R = x; }
        }
      }
      const f = (px) => (px - 100) / 400; // canvas px → a fraction of the 100-unit box (25 units = 100 px of margin)
      return { l: f(L), r: f(R + 1), c: f((L + R + 1) / 2) };
    }
    const range = document.createRange();
    const out = [];
    for (const id of ['shop', 'gears', 'rebirth', 'stats']) {
      const btn = document.querySelector(`.hp-rail [data-nav="${id}"]`);
      const face = btn.querySelector('.kb-rface').getBoundingClientRect();
      const mid = face.left + face.width / 2;
      const svg = btn.querySelector('.kb-rface svg.kit-icon');
      const sb = svg.getBoundingClientRect();
      if (!sb.width) { out.push({ id, label: NaN, icon: NaN, value: null, labelFits: false, noIcon: true }); continue; } // no icon drawn = a fail
      const fr = await inkFrac(svg);
      const ink = { l: sb.left + sb.width * fr.l, r: sb.left + sb.width * fr.r, c: sb.left + sb.width * fr.c };
      const lbl = btn.querySelector('.kb-rlabel');
      range.selectNodeContents(lbl);
      const lr = range.getBoundingClientRect();
      // the number: the visible value (desktop tile: the big number; phone: the short value; locked: the gate)
      const vals = [...btn.querySelectorAll('.kb-rval-big, .kb-rval-short, .kb-rval.is-lock')].filter((e) => e.getBoundingClientRect().width > 0);
      let vr = null;
      if (vals.length) { range.selectNodeContents(vals[0]); vr = range.getBoundingClientRect(); }
      // phone: the icon and its number are ONE row — the row (the icon's ink → the number's last glyph) is centred
      const row = getComputedStyle(btn.querySelector('.kb-rface')).flexDirection === 'row';
      let iconDx = ink.c - mid;
      let valDx = null;
      if (row && vr) iconDx = (Math.min(ink.l, vr.left) + Math.max(ink.r, vr.right)) / 2 - mid;
      else if (vr) valDx = (vr.left + vr.right) / 2 - mid;
      out.push({
        id,
        label: +((lr.left + lr.right) / 2 - mid).toFixed(2),
        icon: +iconDx.toFixed(2),
        value: valDx == null ? null : +valDx.toFixed(2),
        labelFits: lr.left >= face.left - 0.5 && lr.right <= face.right + 0.5,
      });
    }
    return out;
  });
}

const STATES = {
  open: { 'taw.s2.rebirths': '2', 'taw.s2.xp': JSON.stringify({ lv: 18, f: 0, rc: 0, v: 10 }) },
  fresh: {}, // R0: REBIRTH is LOCKED — its padlock is the icon, its gate the number
};

for (const [w, h] of VIEWPORTS) {
  for (const [name, seed] of Object.entries(STATES)) {
    test(`${w}x${h} (${name}): every rail tile's label, icon and number sit on its centre line (±${TOL}px)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      await page.addInitScript((s) => {
        try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* ignore */ }
      }, seed);
      await page.goto('/?portal=1&season2=1');
      await menuReady(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const rows = await measure(page);
      // eslint-disable-next-line no-console
      console.log(`[rail-centre] ${w}x${h} ${name} ${rows.map((r) => `${r.id}: label ${r.label} icon ${r.icon}${r.value == null ? '' : ` value ${r.value}`}`).join(' | ')}`);
      for (const r of rows) {
        expect(Math.abs(r.label), `${r.id} label off-centre at ${w}x${h}`).toBeLessThanOrEqual(TOL);
        expect(Math.abs(r.icon), `${r.id} icon off-centre at ${w}x${h}`).toBeLessThanOrEqual(TOL);
        if (r.value != null) expect(Math.abs(r.value), `${r.id} number off-centre at ${w}x${h}`).toBeLessThanOrEqual(TOL);
        expect(r.labelFits, `${r.id} label inside its tile at ${w}x${h}`).toBe(true);
      }
    });
  }
}
