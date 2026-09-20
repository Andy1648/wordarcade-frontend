// Frames of the first-run teach, per mode, per viewport. Not a gate.
import { test } from '@playwright/test';
import { installBackendMock } from '../e2e/support/backendMock.js';
import { SHOT_VIEWPORTS } from '../e2e/support/screens.js';

const OUT = process.env.SHOTS || 'claude/shots/teach';

for (const vp of SHOT_VIEWPORTS) {
  test.describe(`@ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const mode of ['chain', 'fuse']) {
      test(`teach-${mode}`, async ({ page }) => {
        test.setTimeout(60000);
        await installBackendMock(page);
        await page.goto('/?portal=1');
        await page.evaluate(() => {
          try {
            localStorage.clear();
            localStorage.setItem('taw.seenMenuSpotlight', '1');
            localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
          } catch { /* blocked */ }
        });
        await page.goto('/?portal=1&soloms=350');
        await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
        await page.waitForTimeout(400);
        await page.locator(`.game-card-magnet[data-game="${mode}"] .game-card`).click({ force: true });
        await page.locator('.mode-dialog-btn-create').click();
        await page.locator('.solo-root').waitFor({ state: 'visible' });
        await page.locator('.teach-strip').waitFor({ state: 'visible' });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/${mode}-${vp.name}.png` });
      });
    }
  });
}
