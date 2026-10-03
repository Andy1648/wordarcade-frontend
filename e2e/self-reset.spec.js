// e2e/self-reset.spec.js — N2 (Andy oct2): Stats → RESET ALL PROGRESS also resets the BOARD ROW and the
// CLOUD SAVE (014 lb_self_reset → the 012 admin path, mocked) and keeps the claimed name. Before, it
// wiped only the browser (secret included), orphaning the row at its old level — NoBuffCookies LV5222.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const NAME = 'Reset_Self';

async function claimAt77(page, opts) {
  await page.setViewportSize({ width: 1280, height: 551 });
  await installBackendMock(page);
  const shared = { rows: [], secrets: new Map(), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared, ...opts });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sr.seeded')) return;
    sessionStorage.setItem('sr.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 77, into: 0 }));
    localStorage.setItem('taw.rebirths', '2');
    localStorage.setItem('taw.wins', '4242');
    localStorage.setItem('taw.letters', '9000');
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.homepage-nav-btn.is-board').click();
  await page.locator('.lb-claim-input').fill(NAME);
  await expect(page.locator('.lb-verdict')).toHaveText(/FREE/);
  await page.locator('.lb-claim-btn').click();
  await expect(page.locator('.lb-you-name')).toHaveText(NAME);
  await expect.poll(() => shared.saves.size).toBe(1);
  const row = shared.rows.find((r) => r.username === NAME);
  await expect.poll(() => row.level).toBe(77);
  await page.keyboard.press('Escape');
  return { shared, board, row };
}

async function resetFromStats(page) {
  await page.locator('.homepage-nav-btn.is-stats').click();
  // with rewards waiting, STATS opens the claims first; Stats is one tap on
  await page.locator('.stats-panel, .claims-panel').first().waitFor({ state: 'visible' });
  if (await page.locator('.claims-panel').count()) await page.locator('.claims-to-stats').click();
  await page.locator('.stats-panel').waitFor({ state: 'visible' });
  await page.locator('.stats-reset').click();
  await expect(page.locator('.stats-danger-warn')).toContainText('BOARD ROW');
  await Promise.all([page.waitForEvent('load'), page.locator('.stats-reset-confirm').click()]);
  await menuReady(page);
  await page.waitForTimeout(1500);
}

test('RESET ALL PROGRESS → board row LV 1, cloud save replaced, name kept, no restore on reload', async ({ page }) => {
  test.setTimeout(90000);
  const { shared, board, row } = await claimAt77(page);
  const before = await page.evaluate(() => ({ secret: localStorage.getItem('taw.lb.secret'), profile: localStorage.getItem('taw.lb.profile') }));
  const oldScore = BigInt(shared.saves.get(row.id).score);
  await resetFromStats(page);
  expect(board.calls.selfReset).toBe(1);
  expect(row).toMatchObject({ level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, username: NAME });
  expect(BigInt(shared.saves.get(row.id).score) < oldScore, 'the fresh save replaced the cloud copy').toBe(true);
  const after = await page.evaluate(() => ({
    lv: JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv,
    wins: Number(localStorage.getItem('taw.wins') || 0),
    secret: localStorage.getItem('taw.lb.secret'),
    profile: localStorage.getItem('taw.lb.profile'),
  }));
  expect(after).toMatchObject({ lv: 1, wins: 0, secret: before.secret, profile: before.profile });
  // a reload does NOT pull the old LV77 save back down
  await page.reload();
  await menuReady(page);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv)).toBe(1);
});

test('without 014 (RPC missing) the reset still sticks locally: name + secret dropped, nothing restored', async ({ page }) => {
  test.setTimeout(90000);
  const { row } = await claimAt77(page, { selfReset: false });
  await resetFromStats(page);
  const after = await page.evaluate(() => ({
    lv: JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv,
    secret: localStorage.getItem('taw.lb.secret'),
  }));
  expect(after).toEqual({ lv: 1, secret: null });
  expect(row.level, 'the server row is untouched without 014').toBe(77);
});
