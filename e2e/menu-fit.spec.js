// e2e/menu-fit.spec.js — item 1 acceptance: the container-driven --menu-scale keeps the
// TYPE A WORD title clear of the XP bar, the menu fits one screen (no vertical overflow, no
// horizontal scroll), and the tall card region fills large screens rather than floating.
import { test, expect } from '@playwright/test';
import { gotoMenu } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
  { w: 1280, h: 720 },
  { w: 1163, h: 501 },
  { w: 1024, h: 600 },
];

async function measure(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const title = q('.homepage-logo');
    const xp = q('.menu-xp-bar');
    const stage = q('.homepage-stage');
    const t = title.getBoundingClientRect();
    const x = xp.getBoundingClientRect();
    // Union bbox of the stage's in-flow children = how much of the screen the menu occupies.
    let top = Infinity;
    let bottom = -Infinity;
    for (const el of stage.children) {
      const cs = getComputedStyle(el);
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.height <= 0) continue;
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    return {
      gap: Math.round((x.top - t.bottom) * 10) / 10,
      contentH: Math.round(bottom - top),
      bodyScrollW: document.body.scrollWidth,
      bodyClientW: document.body.clientWidth,
      docScrollH: document.documentElement.scrollHeight,
      docClientH: document.documentElement.clientHeight,
      scale: Number(getComputedStyle(stage).getPropertyValue('--menu-scale')) || 1,
    };
  });
}

test.describe('menu fit (item 1)', () => {
  for (const { w, h } of VIEWPORTS) {
    test(`${w}x${h}: title clears XP bar, fits one screen, no h-scroll`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await gotoMenu(page);
      // Let the layout effect run its two passes.
      await page.waitForTimeout(120);
      const m = await measure(page);
      // eslint-disable-next-line no-console
      console.log(`[menu-fit] ${w}x${h}  gap=${m.gap}px  content=${m.contentH}px (${Math.round((m.contentH / h) * 100)}% of vh)  scale=${m.scale}  hscroll=${m.bodyScrollW - m.bodyClientW}`);

      // No overlap: a real gap between the title and the XP bar.
      expect(m.gap, `title↔XP gap at ${w}x${h}`).toBeGreaterThanOrEqual(12);
      // No horizontal scroll.
      expect(m.bodyScrollW, `body h-overflow at ${w}x${h}`).toBeLessThanOrEqual(m.bodyClientW + 1);
      // No vertical overflow of the one-screen menu.
      expect(m.docScrollH, `vertical overflow at ${w}x${h}`).toBeLessThanOrEqual(m.docClientH + 1);
    });
  }

  test('1920x1080: the menu fills the screen (content ≥ 80% of viewport height)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoMenu(page);
    await page.waitForTimeout(120);
    const m = await measure(page);
    expect(m.contentH, 'menu content height at 1920').toBeGreaterThanOrEqual(1080 * 0.8);
  });
});
