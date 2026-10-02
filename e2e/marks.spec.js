// e2e/marks.spec.js — STEP 49 (Andy oct2): ONE marks system. Marks unlock at LV 10 with a NEW SYSTEM
// reveal; a new mark is CLAIMED (REWARDS badge until then); claiming reveals it and opens the picker;
// the worn mark is the player's MAIN — its title chip shows the tier bonus, and the picker says it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test('reveal → claim a mark → wear it as MAIN (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('mk.seeded')) return;
    sessionStorage.setItem('mk.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 }));
    localStorage.setItem('taw.achievements', JSON.stringify(['m-wb-5']));
    localStorage.setItem('taw.marksOwned', '[]');
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  const rewards = page.locator('.homepage-nav-btn.is-rewards');
  await expect(rewards).toBeVisible();
  await rewards.click();
  await page.locator('.claims-panel').waitFor();
  // The NEW SYSTEM reveal.
  await page.locator('.claims-row', { hasText: 'MARKS' }).filter({ hasText: 'NEW SYSTEM' }).locator('.claims-btn').click();
  await expect(page.locator('.sticker')).toContainText('NEW SYSTEM');
  await page.locator('.sticker').click();
  // The mark itself, claimed → its reveal → the picker opens on dismiss.
  await rewards.click();
  await page.locator('.claims-row', { hasText: 'BOMBER' }).locator('.claims-btn').click();
  await expect(page.locator('.sticker')).toContainText('BOMBER');
  await expect(page.locator('.sticker')).toContainText('+100%');
  await page.locator('.sticker').click();
  await page.locator('.marks-overlay').waitFor();
  const card = page.locator('.mark-card', { hasText: 'BOMBER' });
  await expect(card.locator('.mark-tier')).toHaveText('COMMON');
  await expect(card.locator('.mark-main')).toContainText('+100% WINS');
  await card.click();
  await expect(card.locator('.mark-on')).toHaveText('MAIN');
  await page.locator('.marks-close').click();
  await expect(page.locator('.menu-mark .menu-mark-mult')).toHaveText('×2');
  // The mark claims are gone; what is left is the LETTER FORGE reveal (LV 12 ≥ 8).
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]').map((c) => c.id));
  expect(left.filter((id) => id.startsWith('mark-') || id === 'layer-marks')).toEqual([]);
  expect(left).toContain('layer-forge');
});

test('before LV 10 there is no marks layer at all', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 5, into: 0 }));
    localStorage.setItem('taw.achievements', JSON.stringify(['m-wb-5']));
    localStorage.setItem('taw.marksOwned', '[]');
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  const claims = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]'));
  expect(claims.filter((c) => c.kind === 'mark' || c.id === 'layer-marks')).toEqual([]);
});
