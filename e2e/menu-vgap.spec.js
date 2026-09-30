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
//
// THE PHONE MENU (<=480px) IS A DIFFERENT TREE WITH NO FRAME, SO IT GETS ITS OWN CHECK.
// Since PR #47 the phone renders <MobileMenu> instead of the desktop panel, and MobileMenu.css
// deliberately makes it the WHOLE SCREEN: `.homepage-stage.is-phone-menu` has border-width 0 and
// padding 0, and its one in-flow child `.hp-m` fills it (flex: 1). The desktop measurement read
// that wrapper, so on a phone it reported top 0 / bottom 0 forever — not a layout bug, a wrapper
// measured against a frame that does not exist. Measured on main at 390x844 and 360x640, the
// phone's real content (the .hp-m rows) sits 12px from the top and 10px from the bottom, and 12px
// from each side: one even gutter (`.hp-m` padding: 12px 12px calc(10px + safe-area)). That is
// the design, and pushing it into the desktop 16-32 band would steal 8-12px from the mode bands
// on a 640px screen to buy breathing room from a frame that isn't drawn.
// So at <=480px this spec measures the CONTENT ROWS against the SCREEN and requires:
//   • the stage to be frameless and to fill the app's content column edge to edge and the
//     viewport top to bottom (the premise above — if a frame or inset ever comes back, this
//     fails and the desktop band should be reapplied). The COLUMN, not innerWidth: .app-scroll
//     reserves `scrollbar-gutter: stable both-edges`, which is 15px a side in desktop Chromium's
//     classic scrollbars (what Playwright runs) and 0 on a phone's overlay scrollbars.
//   • top and bottom gaps in the 8-16px phone-gutter band and within 4px of each other,
//   • the vertical gutter to MATCH the side gutter (±1px) — stricter than the desktop check,
//     it catches a lopsided edit to either axis,
//   • no scroll in EITHER axis (the phone menu is one screen by design).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, PHONE_MENU_MAX } from './support/menu.js';

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
    await menuReady(page);
    await page.waitForTimeout(350);
    if (w <= PHONE_MENU_MAX) {
      const p = await page.evaluate(() => {
        const stage = document.querySelector('.homepage-stage.is-phone-menu');
        const m = stage && stage.querySelector('.hp-m');
        if (!m) return null;
        const sb = stage.getBoundingClientRect();
        const cs = getComputedStyle(stage);
        const col = document.querySelector('.view-transition-root').getBoundingClientRect();
        let top = Infinity;
        let bottom = -Infinity;
        let left = Infinity;
        let right = -Infinity;
        for (const el of m.children) {
          const rr = el.getBoundingClientRect();
          if (rr.height <= 0 || rr.width <= 0) continue;
          top = Math.min(top, rr.top);
          bottom = Math.max(bottom, rr.bottom);
          left = Math.min(left, rr.left);
          right = Math.max(right, rr.right);
        }
        const de = document.documentElement;
        return {
          stage: { top: sb.top, bottom: sb.bottom, left: sb.left, right: sb.right, border: parseFloat(cs.borderTopWidth) },
          col: { left: col.left, right: col.right },
          vh: innerHeight,
          gapTop: +(top - sb.top).toFixed(1),
          gapBottom: +(sb.bottom - bottom).toFixed(1),
          gapLeft: +(left - sb.left).toFixed(1),
          gapRight: +(sb.right - right).toFixed(1),
          hOverflow: de.scrollWidth - de.clientWidth,
          vOverflow: de.scrollHeight - de.clientHeight,
        };
      });
      expect(p, `phone menu tree @ ${w}x${h}`).not.toBeNull();
      // eslint-disable-next-line no-console
      console.log(`[menu-vgap] ${w}x${h} PHONE top=${p.gapTop} bottom=${p.gapBottom} left=${p.gapLeft} right=${p.gapRight}`);
      // Premise: frameless, full-screen.
      expect(p.stage.border, `phone stage border @ ${w}x${h}`).toBe(0);
      expect(p.stage.top, `phone stage top @ ${w}x${h}`).toBe(0);
      expect(p.stage.bottom, `phone stage bottom @ ${w}x${h}`).toBe(p.vh);
      expect(p.stage.left, `phone stage left @ ${w}x${h}`).toBe(p.col.left);
      expect(p.stage.right, `phone stage right @ ${w}x${h}`).toBe(p.col.right);
      for (const [k, v] of [['top', p.gapTop], ['bottom', p.gapBottom]]) {
        expect(v, `${k} gap @ ${w}x${h}`).toBeGreaterThanOrEqual(8);
        expect(v, `${k} gap @ ${w}x${h}`).toBeLessThanOrEqual(16);
      }
      expect(Math.abs(p.gapTop - p.gapBottom), `top↔bottom skew @ ${w}x${h}`).toBeLessThanOrEqual(4);
      expect(Math.abs(p.gapTop - p.gapLeft), `vertical vs side gutter @ ${w}x${h}`).toBeLessThanOrEqual(1);
      expect(Math.abs(p.gapLeft - p.gapRight), `left↔right gutter @ ${w}x${h}`).toBeLessThanOrEqual(1);
      expect(p.hOverflow, `horizontal overflow @ ${w}x${h}`).toBeLessThanOrEqual(0);
      expect(p.vOverflow, `vertical overflow @ ${w}x${h}`).toBeLessThanOrEqual(0);
      return;
    }
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
