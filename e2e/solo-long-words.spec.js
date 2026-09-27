// e2e/solo-long-words.spec.js — fix/solo-long-words: the accept lists used to stop at 15
// letters, and the solo input's maxLength is derived from them, so a 28-letter word could not
// even be typed. Now the field admits the longest accepted word from the FIRST run, and a
// 28-letter word fits the box (no overflow, type still >= the 16px input floor).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const LONG = 'antidisestablishmentarianism'; // 28
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1366, height: 625 },
];

for (const mode of ['chain', 'fuse']) {
  for (const vp of VIEWPORTS) {
    test(`${mode} @ ${vp.width}x${vp.height}: a 28-letter word types in full and fits the input`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.addInitScript(() => {
        try {
          localStorage.setItem('taw.chain.runs', '5');
          localStorage.setItem('taw.fuse.runs', '5');
          localStorage.setItem('taw.seenMenuSpotlight', '1');
          localStorage.setItem('taw.seenGameSpotlight', '1');
        } catch { /* storage blocked */ }
      });
      await installBackendMock(page);
      // The mock aborts every non-local request, Google Fonts included. This spec measures
      // glyph widths, so let the real face through (later routes take precedence).
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.continue());
      await page.goto(`/?${mode}=1&portal=1`);
      const input = page.locator('.solo-input');
      await input.waitFor({ state: 'visible', timeout: 20000 });
      // Measure with the REAL face: the monospace fallback is ~10% narrower than Space Mono
      // and hid a phone-width overflow the first time this spec was written.
      // (document.fonts.check() is true even when the face FAILED, so assert a loaded FontFace.)
      await page.evaluate(() => document.fonts.load('16px "Space Mono"'));
      await expect
        .poll(() => page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Space Mono') && f.status === 'loaded')), { timeout: 15000 })
        .toBe(true);

      // Data-derived cap, admitting the longest accepted word before the extension loads.
      const maxLength = Number(await input.getAttribute('maxlength'));
      expect(maxLength).toBeGreaterThanOrEqual(LONG.length);

      await input.click();
      await input.pressSequentially(LONG, { delay: 0 });
      await expect(input).toHaveValue(LONG);

      const m = await input.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const cs = getComputedStyle(el);
        // Chromium's input scrollWidth can equal clientWidth while the value is clipped, so
        // also measure the real glyph run and probe for a horizontal scroll range.
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const tracking = parseFloat(cs.letterSpacing) || 0;
        const textWidth = ctx.measureText(el.value.toUpperCase()).width + tracking * el.value.length;
        const contentWidth = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        el.scrollLeft = 1e6;
        const scrollLeft = el.scrollLeft;
        el.scrollLeft = 0;
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          textWidth: Math.round(textWidth * 10) / 10,
          contentWidth,
          scrollLeft,
          tracking,
          fontSize: parseFloat(cs.fontSize),
          left: r.left,
          right: r.right,
          vw: window.innerWidth,
          onTop: el.contains(document.elementFromPoint(cx, cy)),
        };
      });
      test.info().annotations.push({ type: 'fit', description: JSON.stringify(m) });
      expect(m.scrollWidth, `overflow: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.scrollLeft, `scrollable: ${JSON.stringify(m)}`).toBe(0);
      expect(m.textWidth, `clipped: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.contentWidth);
      expect(m.fontSize).toBeGreaterThanOrEqual(16);
      // Visible, not clipped: the box is inside the viewport and nothing covers it.
      expect(m.left).toBeGreaterThanOrEqual(0);
      expect(m.right).toBeLessThanOrEqual(m.vw);
      expect(m.onTop).toBe(true);
    });
  }
}
