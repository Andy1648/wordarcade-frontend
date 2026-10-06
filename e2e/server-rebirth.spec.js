// e2e/server-rebirth.spec.js — SERVER-CHECKED REBIRTH (021_server_rebirth.sql; Andy oct5 phase 1, anti-exploit).
// A claimed board player's rebirth is lb_rebirth (mocked with the REAL rule, src/leaderboard/rebirthRules.js, via
// boardMock's `rebirth`):
//  1. a double click while the request is pending → ONE request, ONE rebirth; the button is disabled ("…") until
//     the server answers; the ceremony plays on ok, and local rebirths land on the server's count;
//  2. the server's stored level is below the gate → refused with a numbers-first line, nothing applied locally;
//  3. 021 not run yet (no rebirth_rpc cap) → today's local rebirth, lb_rebirth never called.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';

const SECRET = 'c'.repeat(48);
const CONFIRM = '.shop-confirm-actions .shop-card-btn.danger';

async function boot(page, { row, rebirth = { delayMs: 0 }, rules = false }) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth, rules });
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('sr.seeded')) return;
    sessionStorage.setItem('sr.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Rebirther' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 25, f: 0, rc: 0, v: 10 }));
    localStorage.setItem('taw.rebirths', '0');
    localStorage.setItem('taw.wins', '400');
  }, { secret: SECRET, id: row.id });
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator('.homepage-nav-btn.is-rebirth').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
  return { board, shared };
}
const local = (page) => page.evaluate(() => ({ rebirths: Number(localStorage.getItem('taw.rebirths')), level: window.__tawXp ? window.__tawXp().level : null }));

test('double click while pending → one lb_rebirth, one rebirth; the button stays disabled until the server answers', async ({ page }) => {
  const row = { id: 'me-1', username: 'Rebirther', level: 25, rebirths: 0, lifetime_words: 400, lifetime_letters: 2400, wins_per_word: 0, econ: 10 };
  const { board, shared } = await boot(page, { row, rebirth: { delayMs: 1200 } });
  await page.locator('.shop-rebirth').click(); // arm
  const confirm = page.locator(CONFIRM);
  await expect(confirm).toHaveText('CONFIRM REBIRTH 1');
  // two clicks in the same task: the second lands before React re-renders, so only the single-flight guard stops it
  await page.evaluate((sel) => { const b = document.querySelector(sel); b.click(); b.click(); }, CONFIRM);
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveText('…');
  expect((await local(page)).rebirths, 'nothing applied before the server answers').toBe(0);
  await confirm.click({ force: true }).catch(() => {}); // a third, on the disabled button
  const cer = page.locator('.rbc-card');
  await expect(cer.locator('.rbc-kicker')).toHaveText('REBIRTH 1');
  expect(board.calls.rebirth).toBe(1);
  expect(shared.rows[0].rebirths).toBe(1);
  expect(shared.rows[0].level).toBe(1);
  const after = await local(page);
  expect(after.rebirths).toBe(1);
  expect(after.level).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('taw.lb.rbreq')), 'the answered request id is cleared').toBeNull();
});

test('stored level below the gate → refused with "LV 10 / 25", nothing applied, the button comes back', async ({ page }) => {
  // the row's last submit is "in the future" → every submit this test is throttled, so the server keeps LV10
  const row = { id: 'me-1', username: 'Rebirther', level: 10, rebirths: 0, lifetime_words: 400, lifetime_letters: 2400, wins_per_word: 0, econ: 10, submitted_at: Date.now() + 10 * 60 * 1000 };
  const { board, shared } = await boot(page, { row, rules: true });
  await page.locator('.shop-rebirth').click();
  await page.locator(CONFIRM).click();
  await expect(page.locator('.shop-rb-msg')).toHaveText('LV 10 / 25 — NOT THERE YET');
  await expect(page.locator(CONFIRM)).toBeEnabled();
  await expect(page.locator('.rbc-card')).toHaveCount(0);
  expect(board.calls.rebirth).toBe(1);
  expect(shared.rows[0].rebirths).toBe(0);
  const after = await local(page);
  expect(after.rebirths).toBe(0);
  expect(after.level).toBe(25);
});

test('021 not run yet (no rebirth_rpc cap): a board player keeps today\'s local rebirth; lb_rebirth is never called', async ({ page }) => {
  const row = { id: 'me-1', username: 'Rebirther', level: 25, rebirths: 0, lifetime_words: 400, lifetime_letters: 2400, wins_per_word: 0, econ: 10 };
  const { board } = await boot(page, { row, rebirth: null });
  await page.locator('.shop-rebirth').click();
  await page.locator(CONFIRM).click();
  await expect(page.locator('.rbc-card .rbc-kicker')).toHaveText('REBIRTH 1');
  expect(board.calls.rebirth || 0).toBe(0);
  expect((await local(page)).rebirths).toBe(1);
});
