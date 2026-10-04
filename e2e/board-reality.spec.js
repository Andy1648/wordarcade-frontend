// e2e/board-reality.spec.js — BOARD MUST MATCH REALITY (Andy oct3 13:01; 017_board_reality.sql, mocked with
// the real write rule via boardMock's `rules`).
//  1. NoBuffCookies: his row is LV12 R7 (a local-only reset left it behind), he is LV175 R0 locally. Before 017
//     every submit was dropped (rebirths went DOWN); now a lower submit is a RESET baseline, so ONE menu load
//     puts his real level on the board.
//  2. XAVI: a row that hasn't submitted on econ v10 (econ < 10) shows "—" for wins/word, never a stale number.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const SECRET = 'b'.repeat(48);
const HOUR = 3600 * 1000;

async function boot(page, shared, { level = 1, rebirths = 0 } = {}) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  const board = await mockBoard(page, [], { caps: true, shared, rules: true, econ: true, boardEcon: true });
  await page.addInitScript(({ secret, level: lv, rebirths: rb }) => {
    if (sessionStorage.getItem('br.seeded')) return;
    sessionStorage.setItem('br.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me-1', username: 'NoBuffCookies' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.xp', JSON.stringify({ lv, f: 0, rc: rb, v: 10 }));
    localStorage.setItem('taw.rebirths', String(rb));
  }, { secret: SECRET, level, rebirths });
  return board;
}

test('a claimed player whose row is R7 LV12 but who is R0 LV175 locally: one menu load puts LV175 on the board', async ({ page }) => {
  const shared = {
    rows: [
      { id: 'top', username: 'Ahead', level: 400, rebirths: 0, lifetime_words: 5000, lifetime_letters: 25000, wins_per_word: 9, econ: 10, submitted_at: Date.now() - HOUR },
      // his last ACCEPTED submit is hours old — every submit since his local-only reset was dropped
      { id: 'me-1', username: 'NoBuffCookies', level: 12, rebirths: 7, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 0, submitted_at: Date.now() - 5 * HOUR },
    ],
    secrets: new Map([[SECRET, 'me-1']]),
    saves: new Map(),
  };
  const board = await boot(page, shared, { level: 175, rebirths: 0 });
  await page.goto('/?portal=1');
  await menuReady(page);
  const me = () => shared.rows.find((r) => r.id === 'me-1');
  await expect.poll(() => me().level).toBe(175);
  expect(board.calls.lastDecision).toBe('reset');
  expect(me().rebirths).toBe(0);
  expect(me().econ).toBe(10);

  await page.locator('.homepage-nav-btn.is-board').click();
  const row = page.locator('.lb-row.is-me');
  await expect(row.locator('.lb-level')).toHaveText('LV175');
  await expect(row).toHaveAttribute('data-rank', '2');
});

test('an econ<10 row shows "—" for wins/word; a v10 row shows its number', async ({ page }) => {
  const shared = {
    rows: [
      { id: 'xavi', username: 'XAVI', level: 900, rebirths: 3, lifetime_words: 40000, lifetime_letters: 200000, wins_per_word: 1e9, econ: 0, submitted_at: Date.now() - HOUR },
      { id: 'v10', username: 'Current', level: 300, rebirths: 0, lifetime_words: 8000, lifetime_letters: 40000, wins_per_word: 12.5, econ: 10, submitted_at: Date.now() - HOUR },
      { id: 'me-1', username: 'NoBuffCookies', level: 5, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 0 },
    ],
    secrets: new Map([[SECRET, 'me-1']]),
    saves: new Map(),
  };
  await boot(page, shared, { level: 5, rebirths: 0 });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.homepage-nav-btn.is-board').click();
  const byName = (n) => page.locator('.lb-row').filter({ has: page.locator('.lb-name', { hasText: n }) });
  await expect(byName('XAVI').locator('.lb-rate')).toHaveText('—');
  await expect(byName('Current').locator('.lb-rate')).toHaveText('12.5');
  // every number goes through formatNum: XAVI's 40,000 words read 40K, never raw digits
  await expect(byName('XAVI').locator('.lb-words-sub')).toHaveText('40K WORDS');
});
