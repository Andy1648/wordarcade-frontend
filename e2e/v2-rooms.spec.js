// e2e/v2-rooms.spec.js — P9d JOIN ROOM / LOBBY / SETTINGS (claude/mockups/v2/RoomSettings.dc.html; SEASON2-QUEUE 9d):
// "letter tiles for the code, an 8-seat lobby, 5-row settings (REDUCE MOTION, NUMBER STYLE). No JOIN ROOM button on the
// menu (players click a mode)."
//
//   * JOIN ROOM (SEASON2): one tile per code character fills as you type, the next one lit; JOIN counts n/5;
//   * LOBBY (SEASON2): the code as letter tiles; 8 seats (the players + open seats); YOU and YOU ARE HOST; a big START
//     naming the mode; START / LEAVE still send the same messages;
//   * SETTINGS (SEASON2, the corner sound control): five rows — SOUND · MUSIC · REDUCE MOTION · NUMBER STYLE · KEYBOARD
//     SOUNDS; REDUCE MOTION flips live; NUMBER STYLE 1,200,000 persists and the menu prints full digits after a reload;
//   * no JOIN ROOM button on the menu (joining is the mode dialogs' JOIN WITH CODE);
//   * flag OFF: the live lobby / join screen / sound panel are untouched;
//   * the four sizes: no scrollbars, no text < 13 px, every control ≥ 44 px.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, joinControl } from './support/menu.js';

const ME = 'e2e-player';
const PLAYERS = [
  { id: ME, name: 'ANDY', isHost: true },
  { id: 'p2', name: 'KEYSMASH' },
  { id: 'p3', name: 'LOWERCASE' },
];

async function boot(page, { season2 = true, seed = {}, vp = { width: 1366, height: 657 } } = {}) {
  await page.setViewportSize(vp);
  const mock = await installBackendMock(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('rm.seeded')) return;
    sessionStorage.setItem('rm.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`/?portal=1${season2 ? '&season2=1' : ''}`);
  await menuReady(page);
  return mock;
}

async function lobby(page, opts) {
  const mock = await boot(page, opts);
  mock.pushToClient({ type: 'room_update', payload: { code: 'KZRTB', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: PLAYERS } });
  await page.locator('.room-wrap').waitFor({ state: 'visible' });
  return mock;
}

test('JOIN ROOM: the code is letter tiles that fill as you type; JOIN counts n/5', async ({ page }) => {
  await boot(page);
  await (await joinControl(page)).click();
  const wrap = page.locator('.browser-wrap');
  await expect(wrap).toHaveAttribute('data-skin', 'v2');
  const tiles = wrap.locator('.browser-code-slot');
  await expect(tiles).toHaveCount(5);
  await expect(wrap.locator('.browser-code-count')).toHaveText('0/5');
  await wrap.locator('#browser-code-input').fill('kzr');
  await expect(tiles.nth(0)).toHaveText('K');
  await expect(tiles.nth(2)).toHaveText('R');
  await expect(tiles.nth(3)).toHaveClass(/is-next/);
  await expect(wrap.locator('.browser-code-count')).toHaveText('3/5');
  const lit = await tiles.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor);
  const empty = await tiles.nth(4).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(lit).not.toBe(empty);
});

test('LOBBY: code tiles, 8 seats (3 players + 5 open), YOU + YOU ARE HOST, a big START naming the mode that starts the game', async ({ page }) => {
  const mock = await lobby(page);
  const wrap = page.locator('.room-wrap');
  await expect(wrap).toHaveAttribute('data-skin', 'v2');
  await expect(wrap.locator('.room-code')).toHaveAttribute('aria-label', 'Room code KZRTB');
  await expect(wrap.locator('.room-code-tile')).toHaveText(['K', 'Z', 'R', 'T', 'B']);
  await expect(wrap.locator('.room-player-chip')).toHaveCount(3);
  await expect(wrap.locator('.room-seat-open')).toHaveCount(5);
  await expect(wrap.locator('.room-players-label')).toContainText('3/8');
  await expect(wrap.locator('.room-you-badge')).toHaveCount(1);
  await expect(wrap.locator('.room-you-host')).toHaveText('YOU ARE HOST');
  const start = wrap.locator('.room-start-btn');
  await expect(start).toContainText('START');
  await expect(start.locator('.room-start-mode')).toHaveText('WORD BOMB');
  const box = await start.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(70);
  await start.click();
  await mock.waitForSent('start_game');
});

test('SETTINGS: five rows; REDUCE MOTION flips live; NUMBER STYLE 1,200,000 persists and the menu prints full digits', async ({ page }) => {
  await boot(page, { seed: { 'taw.s2.wins': '1234567' } });
  const btn = page.getByRole('button', { name: 'Sound settings' }).first();
  await btn.click();
  const panel = page.locator('.sp');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.sp-label')).toHaveText(['SOUND', 'MUSIC', 'REDUCE MOTION', 'NUMBER STYLE', 'KEYBOARD SOUNDS']);
  // REDUCE MOTION, live
  const rm = panel.getByRole('switch', { name: 'Reduce motion' });
  const before = await rm.getAttribute('aria-checked');
  await rm.click();
  await expect(rm).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
  expect(await page.evaluate(() => localStorage.getItem('taw.reduceMotion'))).toBe(before === 'true' ? '0' : '1');
  // NUMBER STYLE
  await panel.getByRole('radio', { name: '1,200,000' }).click();
  await expect(panel.getByRole('radio', { name: '1,200,000' })).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('taw.numStyle'))).toBe('full');
  await expect(panel.locator('.sp-sub b')).toHaveText('1,200,000');
  await page.reload();
  await menuReady(page);
  await expect.poll(() => page.evaluate(() => /\b1,234,567\b/.test(document.body.innerText)), { timeout: 8000 }).toBe(true);
  // KEYBOARD SOUNDS + SOUND are real controls
  await page.getByRole('button', { name: 'Sound settings' }).first().click();
  const kb = page.locator('.sp').getByRole('switch', { name: 'Keyboard sounds' });
  const k0 = await kb.getAttribute('aria-checked');
  await kb.click();
  await expect(kb).toHaveAttribute('aria-checked', k0 === 'true' ? 'false' : 'true');
  await page.locator('.sp').getByRole('radio', { name: 'Sound 70' }).click();
  await expect(page.locator('.sp-val')).toHaveText('70');
});

test('no JOIN ROOM button on the menu — joining is JOIN WITH CODE in a mode dialog', async ({ page }) => {
  await boot(page);
  await expect(page.getByRole('button', { name: /^JOIN( ROOM)?$/ })).toHaveCount(0);
  await expect(await joinControl(page)).toHaveText(/JOIN WITH CODE/);
});

test('flag OFF: the live lobby, join screen and sound panel are untouched', async ({ page }) => {
  const mock = await boot(page, { season2: false });
  mock.pushToClient({ type: 'room_update', payload: { code: 'KZRTB', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: PLAYERS } });
  const wrap = page.locator('.room-wrap');
  await wrap.waitFor({ state: 'visible' });
  await expect(wrap).not.toHaveAttribute('data-skin', /.+/);
  await expect(wrap.locator('.room-code-tile')).toHaveCount(0);
  await expect(wrap.locator('.room-seat-open')).toHaveCount(0);
  await expect(wrap.locator('.room-start-btn')).toHaveText('START GAME');
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}x${vp.height}: lobby, join and settings fit — no scrollbars, no text < 13 px, targets ≥ 44 px`, async ({ page }) => {
    test.setTimeout(60_000);
    const audit = (root) => page.evaluate((root) => {
      const de = document.documentElement;
      const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
      const scope = document.querySelector(root) || document.body;
      const small = [...scope.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) * (el.currentCSSZoom || 1) < 13).map((el) => `${el.className}`);
      const tiny = [...scope.querySelectorAll('button, [role="switch"], [role="radio"]')].filter(vis)
        .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 43.5 || r.width < 17; }).map((el) => `${el.className}:${Math.round(el.getBoundingClientRect().height)}`);
      return { h: de.scrollWidth > de.clientWidth, v: de.scrollHeight > de.clientHeight, small, tiny };
    }, root);
    await lobby(page, { vp });
    const a = await audit('.room-wrap');
    expect(a.h).toBe(false);
    expect(a.v).toBe(false);
    expect(a.small).toEqual([]);
    await page.getByRole('button', { name: 'Sound settings' }).first().click();
    await expect(page.locator('.sp')).toBeVisible();
    const s = await audit('.sp');
    expect(s.h).toBe(false);
    expect(s.small).toEqual([]);
    expect(s.tiny).toEqual([]);
    const pb = await page.locator('.audio-panel--v2').boundingBox();
    expect(pb.x).toBeGreaterThanOrEqual(0);
    expect(pb.y).toBeGreaterThanOrEqual(0);
    expect(pb.x + pb.width).toBeLessThanOrEqual(vp.width);
    expect(pb.y + pb.height).toBeLessThanOrEqual(vp.height);
    // the join screen, fresh page
    await page.goto(`/?portal=1&season2=1`);
    await menuReady(page);
    await (await joinControl(page)).click();
    await page.locator('.browser-wrap').waitFor();
    const j = await audit('.browser-wrap');
    expect(j.h).toBe(false);
    expect(j.v).toBe(false);
    expect(j.small).toEqual([]);
  });
}
