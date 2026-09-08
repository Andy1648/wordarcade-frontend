// e2e/run-short-height.spec.js (fix/run-short-height) — the RUN screens on a SHORT viewport
// (phone landscape). The round/wall top-align phones get via .is-round must also hold at
// max-height 520px: during a round the clock row's top is inside the viewport and the input's
// bottom is inside it too; on the wall screen START ROUND is inside the viewport without any
// scrolling. Seeded past the RUN level gate like run-round-screen.spec.js; ?seed=1 rolls LONG.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const URL = '/?portal=1&rs=25&seed=1';

async function openWall(page) {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch { /* ignore */ }
  });
  await page.goto(URL);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
}

const scrollState = (page) => page.evaluate(() => {
  const root = document.querySelector('.run-root');
  return { rootTop: root ? root.scrollTop : 0, winY: window.scrollY, inner: window.innerHeight };
});

for (const vp of [{ width: 844, height: 390 }, { width: 932, height: 430 }]) {
  test.describe(`run screens @ ${vp.width}×${vp.height} (phone landscape)`, () => {
    test.use({ viewport: vp, isMobile: true, hasTouch: true });

    test('wall: START ROUND is inside the viewport without scrolling', async ({ page }) => {
      await openWall(page);
      const s = await scrollState(page);
      expect(s.rootTop).toBe(0);
      expect(s.winY).toBe(0);
      const go = await page.locator('.run-btn-go').boundingBox();
      expect(go.y).toBeGreaterThanOrEqual(0);
      expect(go.y + go.height).toBeLessThanOrEqual(vp.height);
      // And the panel's top edge is not stranded above the viewport.
      const panel = await page.locator('.run-panel').boundingBox();
      expect(panel.y).toBeGreaterThanOrEqual(0);
    });

    test('round: the clock row top ≥ 0 and the input bottom ≤ viewport height', async ({ page }) => {
      await openWall(page);
      await page.locator('.run-btn-go').click();
      await expect(page.locator('.run-round')).toBeVisible();
      await expect(page.locator('.run-round-mode b')).toHaveText('LONG');
      const s = await scrollState(page);
      expect(s.rootTop).toBe(0);
      const top = await page.locator('.run-round-top').boundingBox();
      expect(top.y).toBeGreaterThanOrEqual(0);
      const input = await page.locator('.run-input').boundingBox();
      expect(input.y + input.height).toBeLessThanOrEqual(vp.height);
      // The input is still usable: a word is accepted and the toast lands.
      await page.locator('.run-input').fill('planet');
      await page.locator('.run-input').press('Enter');
      await expect(page.locator('.run-toast')).toHaveText(/^PLANET \+\d+$/);
      // Mobile rule: the input never drops under 16px.
      const size = await page.locator('.run-input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(16);
    });
  });
}
