// e2e/second-device.spec.js — Andy oct17: "when you log into a new device with the same account it resets account
// (already signed in), on one device its the same but leaderboard is as if it reset". A board name is a device secret
// shared by every device that holds it; the save is per browser. Season 2 (?season2=1, board mock `season2` +
// `season2Reset`, 029's write rule as finalRules.js models it after 054):
//   1. device A (the real save) backs up to the cloud; device B (same name, fresh season-2 save) restores it on its first
//      menu load — and the shared board row never drops to B's LV 1;
//   2. with NO cloud copy to restore, device B still never pushes its lower numbers onto the row.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady } from './support/menu.js';

const SECRET = 'd'.repeat(48);
const ID = 'me-2dev';
const HOUR = 3600 * 1000;

const sharedDb = () => ({
  rows: [{ id: ID, username: 'TwoDevices', level: 40, rebirths: 3, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13, stars: 0, submitted_at: Date.now() - HOUR }],
  secrets: new Map([[SECRET, ID]]),
  saves: new Map(),
  grants: new Map(),
});

async function device(browser, shared, { save }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true, season2Reset: true });
  await page.addInitScript(({ secret, id, save: s }) => {
    if (sessionStorage.getItem('2dev.seeded')) return;
    sessionStorage.setItem('2dev.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.reduceMotion', '1');
    // "already signed in": the same name + secret on both devices
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'TwoDevices' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '13'); // past the season-2 boot wipe
    if (s) {
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.25, rc: 3, v: 10 }));
      localStorage.setItem('taw.s2.rebirths', '3');
      localStorage.setItem('taw.s2.wins', '777');
    }
  }, { secret: SECRET, id: ID, save });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  return { ctx, page, board };
}
// RAW season-2 keys (named access is unmapped); a read during the restore's reload is just "not yet"
const raw = (page, k) => page.evaluate((key) => localStorage[key] ?? null, k).catch(() => null);
const row = (shared) => shared.rows.find((r) => r.id === ID);

test('a second device with the same name restores the account save; the board row never drops to its LV 1', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  // device A pushes its stats and backs the season-2 save up (lb_save2, econ 13)
  await expect.poll(() => shared.saves.size, { timeout: 15_000 }).toBe(1);

  const b = await device(browser, shared, { save: false });
  // device B: the cloud copy is ahead → imported, page reloads into LV 40 R3
  await expect.poll(async () => JSON.parse((await raw(b.page, 'taw.s2.xp')) || '{}').lv, { timeout: 15_000 }).toBe(40);
  await expect.poll(() => raw(b.page, 'taw.s2.rebirths'), { timeout: 15_000 }).toBe('3');
  expect(await raw(b.page, 'taw.s2.wins')).toBe('777');
  await menuReady(b.page);
  // and the shared row is still the account's
  await b.page.waitForTimeout(1500);
  expect([row(shared).level, row(shared).rebirths]).toEqual([40, 3]);
  await a.ctx.close();
  await b.ctx.close();
});

test('with no cloud copy, a second device behind the row never pushes its lower numbers', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const b = await device(browser, shared, { save: false });
  // the guard read its own row (leaderboard_s2 ?id=) and held the push back — no board write at all
  await b.page.waitForTimeout(3000);
  expect(b.board.calls.submitS2 || 0).toBe(0);
  expect([row(shared).level, row(shared).rebirths]).toEqual([40, 3]);
  expect(JSON.parse((await raw(b.page, 'taw.lb.profile')) || '{}').username).toBe('TwoDevices');
  await b.ctx.close();
});
