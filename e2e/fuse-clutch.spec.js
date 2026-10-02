// e2e/fuse-clutch.spec.js — STEP 56: a FUSE word accepted with <= 2 s left is a CLUTCH — the moment
// plays and the bonus is paid through the labelled ledger (toast now, receipt line at run end).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test('a word with under 2 s on the fuse is a CLUTCH: moment + labelled bonus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    window.__credits = [];
  });
  // soloms caps every fuse at 2.6 s (dev/test hook); portal keeps the query through the canonical URL.
  await page.goto('/?fuse=1&soloms=2600&portal=1');
  await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible' });
  const word = (await page.locator('.teach-strip-eg-word').innerText()).trim().toLowerCase();
  const input = page.locator('.solo-root input').first();
  await input.fill(word.slice(0, 1)); // arms the clock
  await page.waitForTimeout(1100); // ~1.5 s left of 2.6
  await input.fill(word);
  await input.press('Enter');
  await expect(page.locator('.clutch-burst')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.clutch-tag')).toContainText('S LEFT');
  await expect(page.locator('.wct-row', { hasText: 'CLUTCH!' })).toBeVisible({ timeout: 3000 });
});
