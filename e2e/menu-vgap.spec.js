// e2e/menu-vgap.spec.js — item 3: the content column keeps a 16-40px breathing gap at the
// stage's inner TOP edge and the same at the BOTTOM, at every viewport (was ~0/negative on
// most and ~124px loose at 2560 before the --menu-scale vertical reserve).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 2560, h: 1440 },
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
  { w: 1163, h: 501 },
];

for (const { w, h } of VIEWPORTS) {
  test(`${w}x${h}: content column is 16-40px inside the stage's top and bottom inner edges`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const stage = document.querySelector('.homepage-stage');
      const cs = getComputedStyle(stage);
      const sb = stage.getBoundingClientRect();
      const innerTop = sb.top + parseFloat(cs.paddingTop);
      const innerBottom = sb.bottom - parseFloat(cs.paddingBottom);
      let top = Infinity;
      let bottom = -Infinity;
      for (const el of stage.children) {
        const s = getComputedStyle(el);
        if (s.position === 'absolute' || s.position === 'fixed') continue;
        const rr = el.getBoundingClientRect();
        if (rr.height <= 0) continue;
        top = Math.min(top, rr.top);
        bottom = Math.max(bottom, rr.bottom);
      }
      return { gapTop: +(top - innerTop).toFixed(1), gapBottom: +(innerBottom - bottom).toFixed(1) };
    });
    // eslint-disable-next-line no-console
    console.log(`[menu-vgap] ${w}x${h} top=${r.gapTop} bottom=${r.gapBottom}`);
    expect(r.gapTop, `top gap @ ${w}x${h}`).toBeGreaterThanOrEqual(16);
    expect(r.gapTop, `top gap @ ${w}x${h}`).toBeLessThanOrEqual(40);
    expect(r.gapBottom, `bottom gap @ ${w}x${h}`).toBeGreaterThanOrEqual(16);
    expect(r.gapBottom, `bottom gap @ ${w}x${h}`).toBeLessThanOrEqual(40);
  });
}
