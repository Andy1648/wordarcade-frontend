// e2e/ext-rebirth-ladder.spec.js — EXTENSION d, the REBIRTH LADDER chips on Stats (dormant behind
// ?ladder=1, claude/specs/rebirth-ladder.md). Flag off: the plain REBIRTH row, no chips. Flag on: the
// row's slot holds BASE / NOW / NEXT chips, and the REBIRTH row is gone.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

async function openStats(page, query) {
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('rbl.seeded')) return;
    sessionStorage.setItem('rbl.seeded', '1');
    localStorage.clear();
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.rebirths', '2');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 10, f: 0, rc: 2, v: 10 }));
  });
  await page.goto(`/?portal=1${query}`);
  await menuReady(page);
  await navControl(page, 'stats').click();
  await page.locator('.stats-panel').waitFor({ state: 'visible' });
}

test('flag off: no ladder, the plain REBIRTH row', async ({ page }) => {
  await openStats(page, '');
  await expect(page.locator('.stats-ladder')).toHaveCount(0);
  await expect(page.locator('.stats-chip')).toHaveCount(0);
  await expect(page.locator('.stats-row dt', { hasText: /^REBIRTH$/ })).toHaveCount(1);
});

test('flag on: BASE / NOW / NEXT chips replace the REBIRTH row', async ({ page }) => {
  await openStats(page, '&ladder=1');
  const chips = page.locator('.stats-ladder .stats-chip');
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toHaveText('BASE ×1');
  await expect(page.locator('.stats-chip.is-now')).toHaveText('R2 ×3');
  await expect(page.locator('.stats-chip.is-next')).toHaveText(/^R3 ×4 · LV \d+ · \+33%$/);
  await expect(page.locator('.stats-row dt', { hasText: /^REBIRTH$/ })).toHaveCount(0);
  const box = await page.locator('.stats-chip.is-next').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
});
