// e2e/season2-update.spec.js — THE SEASON 2 CONVERSION, client half (Andy oct6: NO RESET; 025_season2_convert.sql,
// src/progress/v3/convertLocal.js + season2Update.js, claude/mockups/v2/Season2.dc.html restyled as UPDATE), behind
// ?season2=1 with the board mock's `season2Convert` (025's one-shot conversion of the row on the REAL rule, convert.js):
//   * a season-1 save at R13 KEY 6 converts to R10 · ★ · POWER 9 — levels, wins and gems unchanged, NO key removed;
//   * the UPDATE card shows ONCE (what's new + the converted ★ / POWER; no "starts fresh", no gems gift);
//   * the first season-2 board write keeps the converted R10 + the level (022's switch branch — not words / 100);
//   * an R29 row converts to ★1 (1 per 10 rebirths above R10).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';

const SECRET = 'u'.repeat(48);

async function boot(page, { rebirths, keyTier, level, words }) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  // the server BEFORE 025 (the mock runs 025 at start): a season-1 row
  const row = { id: 'me-s2u', username: 'OldTimer', level, rebirths, lifetime_words: words, lifetime_letters: words * 5, wins_per_word: 1e10, econ: 12, stars: 0, submitted_at: Date.now() - 3600e3 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true, season2Convert: true });
  await page.addInitScript(({ secret, id, rebirths, keyTier, level }) => {
    if (sessionStorage.getItem('s2u.seeded')) return;
    sessionStorage.setItem('s2u.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'OldTimer' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.reduceMotion', '1');
    // the SEASON-1 save
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.rebirths', String(rebirths));
    localStorage.setItem('taw.keytier', String(keyTier));
    localStorage.setItem('taw.xp', JSON.stringify({ lv: level, f: 0.5, rc: rebirths, v: 10 }));
    localStorage.setItem('taw.xpv10', JSON.stringify({ lv: level, f: 0.5, rc: rebirths, v: 10 }));
    localStorage.setItem('taw.wins', '5000');
    localStorage.setItem('taw.winsLifetime', '987654');
    localStorage.setItem('taw.gems', JSON.stringify({ v: 1, bal: 900, peak: level, streak: 0, mig: 1 }));
    localStorage.setItem('taw.owned', JSON.stringify(['pop-fire']));
  }, { secret: SECRET, id: row.id, rebirths, keyTier, level });
  await page.goto('/?portal=1&season2=1');
  return { board, row };
}
// every taw.* key, RAW (named access: season 2 maps getItem('taw.wins') to taw.s2.wins at the storage layer)
const store = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('taw.')).map((k) => [k, localStorage[k]])));
/** The boot has settled once a season-2 board push lands (submitStats waits on it). */
const settled = (board, after = 0) => expect.poll(() => board.calls.submitS2 || 0, { timeout: 15_000 }).toBeGreaterThan(after);

test('SEASON 2 CONVERSION: R13 KEY 6 → R10 · ★ · POWER; levels, wins, gems kept; the UPDATE card once; no wipe', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const { board, row } = await boot(page, { rebirths: 13, keyTier: 6, level: 40, words: 300 });

  const card = page.getByTestId('season2-update');
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('#s2u-title')).toHaveText('UPDATE');
  await expect(card).toContainText('YOUR PROGRESS IS KEPT');
  await expect(card).not.toContainText(/STARTS FRESH|MAINTENANCE|YOU GET|COLLECT/);
  await expect(page.getByTestId('season2-update-before')).toHaveText('R13');
  await expect(page.getByTestId('season2-update-rebirths')).toHaveText('R10');
  await expect(page.getByTestId('season2-update-stars')).toHaveText('★0');
  await expect(page.getByTestId('season2-update-power')).toHaveText('P9');
  await expect(page.getByTestId('season2-update-kept')).toContainText('LV 40');
  await expect(page.getByTestId('season2-collect')).toHaveCount(0);

  // the season-2 save = the converted one; the season-1 save is untouched (NO WIPE)
  const k = await store(page);
  expect(k['taw.s2.rebirths']).toBe('10');
  expect(k['taw.s2.keytier']).toBe('9');
  expect(k['taw.s2.stars']).toBe('0');
  expect(JSON.parse(k['taw.s2.xp'])).toMatchObject({ lv: 40, f: 0.5, rc: 10, v: 10 });
  expect(k['taw.s2.wins']).toBe('5000');
  expect(k['taw.s2.winsLifetime']).toBe('987654');
  expect(JSON.parse(k['taw.s2.gems']).bal).toBe(900);
  for (const [key, v] of Object.entries({ 'taw.econ': '12', 'taw.rebirths': '13', 'taw.keytier': '6', 'taw.wins': '5000', 'taw.winsLifetime': '987654' })) {
    expect(k[key], `${key} untouched`).toBe(v);
  }
  expect(JSON.parse(k['taw.xp'])).toEqual({ lv: 40, f: 0.5, rc: 13, v: 10 });
  expect(JSON.parse(k['taw.gems']).bal).toBe(900);
  expect(k['taw.owned']).toBe(JSON.stringify(['pop-fire']));
  expect(JSON.parse(k['taw.lb.profile']).username).toBe('OldTimer');
  expect(k['taw.lb.secret']).toBe(SECRET);
  expect(JSON.parse(k['taw.s2.conv'])).toMatchObject({ st: 'shown', had: true, srv: 1 });
  expect(board.calls.season2Conv).toBe(1);
  await expect.poll(() => board.calls.season2Seen || 0).toBe(1);

  // PLAY closes it
  await page.getByTestId('season2-update-play').click();
  await expect(card).toHaveCount(0);

  // the first season-2 board write keeps the converted R10 + the level (not words / 100 = R3)
  await settled(board);
  expect(row).toMatchObject({ rebirths: 10, stars: 0, level: 40, econ: 13 });

  // a reload: no card again; the numbers stay
  const pushes = board.calls.submitS2 || 0;
  await page.reload();
  await settled(board, pushes);
  await expect(page.getByTestId('season2-update')).toHaveCount(0);
  const k2 = await store(page);
  expect([k2['taw.s2.rebirths'], k2['taw.s2.keytier'], k2['taw.s2.wins'], JSON.parse(k2['taw.s2.gems']).bal]).toEqual(['10', '9', '5000', 900]);
  expect(k2['taw.rebirths']).toBe('13');
});

test('SEASON 2 CONVERSION: an R29 row → R10 · ★1 · POWER 11, shown on the card (phone)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { board, row } = await boot(page, { rebirths: 29, keyTier: 28, level: 558, words: 1170 });
  await expect(page.getByTestId('season2-update')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('season2-update-before')).toHaveText('R29');
  await expect(page.getByTestId('season2-update-rebirths')).toHaveText('R10');
  await expect(page.getByTestId('season2-update-stars')).toHaveText('★1');
  await expect(page.getByTestId('season2-update-power')).toHaveText('P11');
  // the PLAY button is reachable on a phone
  await page.getByTestId('season2-update-play').click();
  await expect(page.getByTestId('season2-update')).toHaveCount(0);
  const k = await store(page);
  expect([k['taw.s2.rebirths'], k['taw.s2.stars'], k['taw.s2.keytier']]).toEqual(['10', '1', '11']);
  expect(JSON.parse(k['taw.s2.xp']).lv).toBe(558);
  await settled(board);
  expect(row).toMatchObject({ rebirths: 10, stars: 1, level: 558, econ: 13 });
});
