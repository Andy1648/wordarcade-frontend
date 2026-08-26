// e2e/menu-vgap.spec.js — the menu's content column must keep a symmetric breathing gap at
// the stage's TOP and BOTTOM edges at every viewport.
//
// This guards the two gaps INDEPENDENTLY (the previous single 16-40 check let top/bottom drift
// up to 24px apart, and — more importantly — it measured content-to-inner-edge, i.e. AFTER the
// stage padding, which HID a real asymmetry: on phones the stage padding was `18px … 0` (18 top /
// 0 bottom). We now measure content-to-FRAME (the stage's rendered border, padding included) —
// what the eye actually reads as the gap to the neon frame — and require:
//   • each of the top and bottom frame gaps in the 16-32px band, and
//   • the two within 8px of EACH OTHER (symmetry), at every viewport,
//   • no horizontal scroll.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 2560, h: 1440 },
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
  { w: 1163, h: 501 },
  { w: 390, h: 844 },
  { w: 360, h: 640 },
];

for (const { w, h } of VIEWPORTS) {
  test(`${w}x${h}: menu top & bottom frame gaps are symmetric and in the 16-32px band`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const stage = document.querySelector('.homepage-stage');
      const sb = stage.getBoundingClientRect();
      let top = Infinity;
      let bottom = -Infinity;
      for (const el of stage.children) {
        const s = getComputedStyle(el);
        if (s.position === 'absolute' || s.position === 'fixed') continue; // glow/spotlight/corner nav
        const rr = el.getBoundingClientRect();
        if (rr.height <= 0) continue;
        top = Math.min(top, rr.top);
        bottom = Math.max(bottom, rr.bottom);
      }
      const de = document.documentElement;
      // frame gap = content edge → stage border (padding INCLUDED — this is the visible gap).
      return {
        gapTop: +(top - sb.top).toFixed(1),
        gapBottom: +(sb.bottom - bottom).toFixed(1),
        hOverflow: de.scrollWidth - de.clientWidth,
      };
    });
    // eslint-disable-next-line no-console
    console.log(`[menu-vgap] ${w}x${h} top=${r.gapTop} bottom=${r.gapBottom} skew=${(r.gapTop - r.gapBottom).toFixed(1)}`);
    expect(r.gapTop, `top gap @ ${w}x${h}`).toBeGreaterThanOrEqual(16);
    expect(r.gapTop, `top gap @ ${w}x${h}`).toBeLessThanOrEqual(32);
    expect(r.gapBottom, `bottom gap @ ${w}x${h}`).toBeGreaterThanOrEqual(16);
    expect(r.gapBottom, `bottom gap @ ${w}x${h}`).toBeLessThanOrEqual(32);
    // The two gaps must be within 8px of each other — this is what catches asymmetry.
    expect(Math.abs(r.gapTop - r.gapBottom), `top↔bottom skew @ ${w}x${h}`).toBeLessThanOrEqual(8);
    // No horizontal scrollbar at any width.
    expect(r.hOverflow, `horizontal overflow @ ${w}x${h}`).toBeLessThanOrEqual(0);
  });
}
