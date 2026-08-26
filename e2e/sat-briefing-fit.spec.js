// e2e/sat-briefing-fit.spec.js
//
// Item 6b: the SAT Rush BRIEFING heading ("THE BRIEFING") was clipped above the top of the
// viewport (the classic flex-centre overflow — a page taller than the screen got centred, so
// its top went off-screen where scroll couldn't reach). The fix top-aligns the briefing scroll
// container. This test drives the briefing at every required viewport and asserts the whole
// heading sits inside the viewport (top >= 0, bottom <= height). One test per viewport = the
// per-viewport report the task asked for.
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

async function toBriefing(page) {
  await installBackendMock(page);
  await page.goto('/?satRush=1&portal=1');
  await page.locator('[data-game="sat-rush"] .game-card').click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.sr-modeselect')).toBeVisible();
  await page.getByRole('button', { name: /BRIEFING/ }).click();
  await expect(page.locator('.sr-brief-page')).toBeVisible();
}

test.describe('SAT briefing heading fits the viewport (item 6b)', () => {
  for (const { w, h } of VIEWPORTS) {
    test(`${w}x${h}: "THE BRIEFING" heading fully inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await toBriefing(page);
      const title = page.locator('.sr-brief-title');
      await expect(title).toBeVisible();
      const box = await title.boundingBox();
      expect(box, 'heading has a layout box').not.toBeNull();
      // The whole heading must be within [0, viewportHeight] — no clipping above the top
      // (the bug) and none below the bottom. Allow 1px for sub-pixel rounding.
      expect(box.y, `heading top clipped above viewport (y=${box.y})`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `heading bottom past viewport (bottom=${box.y + box.height}, h=${h})`).toBeLessThanOrEqual(h + 1);
    });
  }
});
