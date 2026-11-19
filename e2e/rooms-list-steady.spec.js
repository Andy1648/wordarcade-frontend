// e2e/rooms-list-steady.spec.js — THE JOIN ROOM SCREEN HOLDS STILL while its list refreshes (Andy nov18: "why was the
// join public room screen vibrating back and forth"). Live, house rooms churn every 5 s refresh: counts drift, rooms
// come and go, a room's status flickers playing ↔ waiting. Each change used to (a) change the box's height — and the box
// is centred, so the whole screen jumped up and down, and useFitZoom re-fit the zoom on top — and (b) re-sort the rows.
// Mocked socket: feed a churning public_rooms list over several refreshes and assert
//   - the .browser-box top / height / width and its zoom stay put (±1 px),
//   - rows already on screen keep their order (a newcomer joins the end of its group, a vanished room just leaves),
//   - a one-refresh status flicker changes the row IN PLACE, never moves it between groups; a 'finished' room (game
//     just ended, still joinable) reads GAME OVER / JOIN in its old slot,
//   - phones (390x844, 360x640) still fit with no page scroll (only the list scrolls).
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';
import { menuReady, joinControl } from './support/menu.js';

const SHOTS = process.env.RL_SHOTS || '';
const L = (code, n, extra = {}) => ({ code, gameType: 'word-bomb', playerCount: n, maxPlayers: 8, status: 'waiting', hostName: `HOST ${code}`, ...extra });
const P = (code, n) => ({ code, gameType: 'category-blitz', playerCount: n, maxPlayers: 8, status: 'playing', hostName: `HOST ${code}`, watch: 'open', canSpectate: true });

// five refreshes of churn, each one a change that used to move the screen
const FRAMES = [
  [L('AAAA1', 3), L('BBBB2', 2), L('CCCC3', 1), P('LIVE1', 4), P('LIVE2', 6)],
  // count drift: CCCC3 becomes the fullest lobby, LIVE1 the busiest game (a fresh sort would swap both)
  [L('AAAA1', 3), L('BBBB2', 2), L('CCCC3', 7), P('LIVE1', 8), P('LIVE2', 6)],
  // a room appears (fullest, would sort first) and a group grows
  [L('NEWW1', 6), L('AAAA1', 4), L('BBBB2', 2), L('CCCC3', 7), P('LIVE1', 8), P('LIVE2', 6), P('LIVE3', 2)],
  // a room vanishes, and LIVE2 flickers to waiting for one refresh
  [L('NEWW1', 6), L('AAAA1', 4), L('CCCC3', 7), P('LIVE1', 8), L('LIVE2', 6), P('LIVE3', 2)],
  // LIVE2 back to playing; LIVE3's game just ended (a newer server says 'finished': GAME OVER / JOIN, stays put)
  [L('NEWW1', 5), L('AAAA1', 4), L('CCCC3', 7), P('LIVE1', 8), P('LIVE2', 6), { ...P('LIVE3', 2), status: 'finished' }],
  // a whole group can empty without the box changing size
  [P('LIVE1', 8), P('LIVE2', 6)],
  [],
];

async function openJoinRoom(page) {
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems', 'taw.seenGameSpotlight']) localStorage.setItem(k, '1');
      localStorage.setItem('wa_playername', 'TESTER');
    } catch { /* blocked */ }
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await mock.waitForSent('list_public_rooms', 10000);
  mock.pushToClient({ type: 'public_rooms', payload: { rooms: FRAMES[0] } });
  await (await joinControl(page)).click(); // the Word Bomb dialog's JOIN WITH CODE opens the JOIN ROOM screen
  await expect(page.locator('.browser-wrap')).toBeVisible();
  return mock;
}

const boxGeo = (page) => page.evaluate(() => {
  const el = document.querySelector('.browser-box');
  const r = el.getBoundingClientRect();
  const doc = document.scrollingElement;
  return {
    top: r.top, left: r.left, height: r.height, width: r.width,
    zoom: parseFloat(el.style.zoom || '1'),
    pageScrolls: doc.scrollHeight > window.innerHeight + 1 || doc.scrollWidth > window.innerWidth + 1,
    bottom: r.bottom, vh: window.innerHeight,
  };
});
const order = (page) => page.getByTestId('browser-room-row').evaluateAll((els) => els.map((e) => e.dataset.code));
const groupOf = (page, code) => page.locator(`[data-testid="browser-room-row"][data-code="${code}"]`)
  .evaluate((el) => el.closest('[data-testid="browser-group"]').className.includes('is-live') ? 'live' : 'lobby');

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1280, height: 551 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`@${vp.width}x${vp.height}: JOIN ROOM box holds still and rows keep their order across churning refreshes`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(vp);
    const mock = await openJoinRoom(page);
    const rows = page.getByTestId('browser-room-row');
    mock.pushToClient({ type: 'public_rooms', payload: { rooms: FRAMES[0] } });
    await expect(rows).toHaveCount(5);
    await freezeAnimations(page);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    // let any first fit (fonts, mount) settle, then take the baseline
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const base = await boxGeo(page);
    expect(base.pageScrolls, 'the page never scrolls').toBe(false);
    expect(base.bottom, 'the box fits the window').toBeLessThanOrEqual(vp.height + 1);
    expect(await order(page)).toEqual(['AAAA1', 'BBBB2', 'CCCC3', 'LIVE2', 'LIVE1']);

    const expected = [
      null,
      ['AAAA1', 'BBBB2', 'CCCC3', 'LIVE2', 'LIVE1'], // drift: nothing moves
      ['AAAA1', 'BBBB2', 'CCCC3', 'NEWW1', 'LIVE2', 'LIVE1', 'LIVE3'], // newcomers at the end of their group
      ['AAAA1', 'CCCC3', 'NEWW1', 'LIVE2', 'LIVE1', 'LIVE3'], // BBBB2 left; LIVE2 (now "waiting") stays put
      ['AAAA1', 'CCCC3', 'NEWW1', 'LIVE2', 'LIVE1', 'LIVE3'],
      ['LIVE2', 'LIVE1'],
      [],
    ];
    for (let i = 1; i < FRAMES.length; i += 1) {
      mock.pushToClient({ type: 'public_rooms', payload: { rooms: FRAMES[i] } });
      await expect(rows).toHaveCount(FRAMES[i].length);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      if (i === 3) {
        // the flicker changes the row in place: it says IN LOBBY / JOIN but is still in the PLAYING group
        expect(await groupOf(page, 'LIVE2')).toBe('live');
        await expect(page.locator('[data-testid="browser-room-row"][data-code="LIVE2"]')).toHaveAttribute('data-status', 'waiting');
      }
      if (i === 4) {
        const fin = page.locator('[data-testid="browser-room-row"][data-code="LIVE3"]');
        expect(await groupOf(page, 'LIVE3')).toBe('live');
        await expect(fin).toHaveAttribute('data-status', 'finished');
        await expect(fin.locator('[data-col="action"]')).toContainText('GAME OVER');
        await expect(fin.locator('[data-col="action"]')).toContainText('JOIN');
        await expect(fin).toBeEnabled();
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/steady-${vp.width}x${vp.height}-${i}.png` });
      const g = await boxGeo(page);
      expect(Math.abs(g.top - base.top), `frame ${i}: box top ${g.top} vs ${base.top}`).toBeLessThanOrEqual(1);
      expect(Math.abs(g.left - base.left), `frame ${i}: box left`).toBeLessThanOrEqual(1);
      expect(Math.abs(g.height - base.height), `frame ${i}: box height ${g.height} vs ${base.height}`).toBeLessThanOrEqual(1);
      expect(Math.abs(g.width - base.width), `frame ${i}: box width`).toBeLessThanOrEqual(1);
      expect(g.zoom, `frame ${i}: zoom`).toBe(base.zoom);
      expect(g.pageScrolls, `frame ${i}: the page never scrolls`).toBe(false);
      expect(await order(page), `frame ${i}: rows keep their order`).toEqual(expected[i]);
    }
  });
}
