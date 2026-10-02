// e2e/admin-reset.spec.js — Andy oct2: ADMIN FULL RESET by username (012_admin_reset.sql, mocked).
// `update profiles set reset_all = true where username = 'NAME'` → on that player's next boot the
// progress is wiped like Stats → RESET ALL PROGRESS, the claimed name + device secret are KEPT, the
// fresh (lower) save replaces the cloud copy, the board row reads LV 1, the flag is cleared, a one-line
// notice says why — and a reload does NOT reset (or restore the old save) again.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const NAME = 'Reset_Me';

test('flag set → LV 1 / 0 wins, name kept, flag cleared, notice once, no repeat on reload', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 551 });
  await installBackendMock(page);
  const shared = { rows: [], secrets: new Map(), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('ar.seeded')) return;
    sessionStorage.setItem('ar.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 77, into: 0 }));
    localStorage.setItem('taw.rebirths', '2');
    localStorage.setItem('taw.wins', '4242');
    localStorage.setItem('taw.letters', '9000');
  });
  await page.goto('/?portal=1');
  await menuReady(page);

  // claim → the save (LV 77, R2) is in the cloud
  await page.locator('.homepage-nav-btn.is-board').click();
  await page.locator('.lb-claim-input').fill(NAME);
  await expect(page.locator('.lb-verdict')).toHaveText(/FREE/);
  await page.locator('.lb-claim-btn').click();
  await expect(page.locator('.lb-you-name')).toHaveText(NAME);
  await expect.poll(() => shared.saves.size).toBe(1);
  const before = await page.evaluate(() => ({ secret: localStorage.getItem('taw.lb.secret'), profile: localStorage.getItem('taw.lb.profile') }));
  const row = shared.rows.find((r) => r.username === NAME);
  expect(row).toBeTruthy();
  await expect.poll(() => row.level).toBe(77);
  const oldScore = BigInt(shared.saves.get(row.id).score);

  // Andy: update profiles set reset_all = true where username = 'Reset_Me';
  row.reset_all = true;
  await page.goto('/?portal=1');

  // the wipe + the reload it triggers land on a fresh menu with the notice
  await expect(page.locator('.dev-reset-card')).toHaveText('YOUR PROGRESS WAS RESET BY THE DEV.', { timeout: 20000 });
  const after = await page.evaluate(() => ({
    lv: JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv,
    wins: Number(localStorage.getItem('taw.wins') || 0),
    rebirths: Number(localStorage.getItem('taw.rebirths') || 0),
    letters: Number(localStorage.getItem('taw.letters') || 0),
    secret: localStorage.getItem('taw.lb.secret'),
    profile: localStorage.getItem('taw.lb.profile'),
  }));
  expect(after).toMatchObject({ lv: 1, wins: 0, rebirths: 0, letters: 0, secret: before.secret, profile: before.profile });
  expect(row.reset_all).toBe(false);
  expect(row).toMatchObject({ level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, username: NAME });
  expect(BigInt(shared.saves.get(row.id).score) < oldScore, 'the lower fresh save replaced the cloud copy').toBe(true);
  expect(board.calls.resetAck).toBe(1);
  await expect(page.locator('.dev-reset-card')).toBeHidden({ timeout: 6000 }); // finite

  // the next load: no second reset, no notice, and the OLD save does not come back
  await page.reload();
  await menuReady(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('.dev-reset-card')).toHaveCount(0);
  expect(board.calls.resetAck).toBe(1);
  const lv = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv);
  expect(lv).toBe(1);
  await page.locator('.homepage-nav-btn.is-board').click();
  await expect(page.locator('.lb-row.is-me .lb-name')).toHaveText(NAME);
});
