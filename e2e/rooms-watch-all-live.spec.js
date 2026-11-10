// e2e/rooms-watch-all-live.spec.js — SPECTATE EVERY LIVE MODE + HOUSE ROOMS (Andy nov9: "some i can spectate some i
// cant... i oftentimes wait so long for someone to start room") against a REAL backend (backend #47). Browser contexts:
//   1. MINER and WORD RACE: a host opens a public room and starts; a viewer on the menu sees it flip to PLAYING →
//      SPECTATE, watches read-only (SPECTATING, no input, a watch line where the input sits, the board moving), and the
//      HOST's screen says 1 WATCHING - which drops when the watcher leaves.
//   2. HOUSE ROOM (houseRooms.js has the rule): with nobody else around the list shows a small lobby hosted by a persona;
//      two humans join it, the roster grows one player at a time, and the host starts it - no countdown, nobody presses
//      START - with both humans in the game.
// No page errors, no red console errors.
//
// OPT-IN (a running backend + a build pointed at it):
//   HOUSE_TIME_SCALE=0.5 HOUSE_TICK_MS=1000 PORT=3912 node server.js                   (chain-reaction-backend)
//   VITE_BACKEND_WS_URL=ws://localhost:3912 npx vite build --outDir dist-live && npx vite preview --outDir dist-live --port 4395
//   LIVE_BASE=http://localhost:4395 npx playwright test e2e/rooms-watch-all-live.spec.js --workers=1
import { test, expect } from '@playwright/test';
import { menuReady, revealMode, joinControl } from './support/menu.js';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.RW_SHOTS || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

const BLOCK = /posthog\.com|googlesyndication|googletagmanager|google-analytics|sentry\.io|vercel-insights|\/_vercel\/insights|supabase\.co|lb\.e2e\.invalid/;
const NOISE = /Failed to load resource|net::ERR_|posthog|adsbygoogle|sentry|supabase|lb\.e2e/i;

async function freshPage(browser, tag, name, viewport = { width: 1366, height: 768 }) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport, reducedMotion: 'reduce' });
  await ctx.route(BLOCK, (route) => route.abort());
  await ctx.addInitScript((n) => {
    try {
      if (sessionStorage.getItem('rw.seeded')) return;
      sessionStorage.setItem('rw.seeded', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
      localStorage.setItem('taw.reveal', 'all');
      if (n) { localStorage.setItem('wa_playername', n); localStorage.setItem('taw.playerName', n); }
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  }, name);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) page.errors.push(`${tag} console: ${m.text()}`); });
  return page;
}

/** The host opens a PUBLIC room of a T5 mode through the menu's mode dialog → CREATE; returns the room code. */
async function hostT5Room(host, mode, lobbySel) {
  await host.goto('/?portal=1&season2=1');
  await menuReady(host);
  await (await revealMode(host, mode)).click();
  await host.locator('.mode-dialog-btn-create:visible').first().click();
  const field = host.getByRole('textbox', { name: 'YOUR NAME' });
  await Promise.race([field.waitFor({ timeout: 45000 }), host.locator(lobbySel).waitFor({ timeout: 45000 })]);
  if (await field.isVisible()) {
    const pub = host.getByRole('button', { name: /PUBLIC/ });
    if (await pub.isVisible().catch(() => false)) await pub.click();
    await host.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await host.locator(lobbySel).waitFor({ timeout: 45000 });
  const codeText = await host.evaluate(() => {
    const el = document.querySelector('.mn-code, .wr-code, [data-testid="room-code"], .room-code');
    return el ? (el.getAttribute('aria-label') || el.textContent || '') : '';
  });
  const code = (codeText.match(/[A-Z0-9]{5}/) || [])[0];
  expect(code, 'the lobby shows its code').toBeTruthy();
  return code;
}

async function viewerOnMenu(browser, name) {
  const viewer = await freshPage(browser, 'viewer', name);
  await viewer.goto('/?portal=1&season2=1');
  await menuReady(viewer);
  return viewer;
}

/** The viewer opens the full JOIN ROOM list (every row, no panel cap) through the menu. */
async function openList(viewer) {
  await (await joinControl(viewer)).click(); // the Word Bomb dialog's JOIN WITH CODE: the JOIN ROOM screen
  await viewer.locator('.browser-wrap').waitFor();
}

for (const { mode, lobby, start, input, label } of [
  { mode: 'miner', lobby: '[data-testid="miner-lobby"]', start: /^START$/, input: '.mn-input', label: 'MINER' },
  { mode: 'word-race', lobby: '.wr-lobby', start: /START RACE/, input: '.wr-input', label: 'WORD RACE' },
]) {
  test(`${label}: a live public game is SPECTATE-able; the watcher is read-only; the host sees 1 WATCHING`, async ({ browser }) => {
    test.setTimeout(240000);
    const host = await freshPage(browser, 'host', `${label.slice(0, 4)}HOST`);
    const code = await hostT5Room(host, mode, lobby);
    await host.getByRole('button', { name: start }).click();
    await expect(host.locator(lobby)).toHaveCount(0, { timeout: 30000 });

    const viewer = await viewerOnMenu(browser, `${label.slice(0, 4)}WATCH`);
    await openList(viewer);
    const row = viewer.locator(`[data-testid="browser-room-row"][data-code="${code}"]`);
    await expect(row).toHaveAttribute('data-status', 'playing', { timeout: 30000 });
    await expect(row.locator('[data-col="action"]')).toContainText('SPECTATE');
    await expect(row).toBeEnabled();
    if (SHOTS) await viewer.screenshot({ path: `${SHOTS}/${mode}-list.png` });
    await row.click();

    await expect(viewer.getByTestId('watch-chip')).toBeVisible({ timeout: 20000 });
    await expect(viewer.getByTestId('watch-bar').first()).toBeVisible({ timeout: 20000 });
    await expect(viewer.locator(input)).toHaveCount(0);
    await expect(host.getByTestId('watchers-chip')).toHaveText(/1\s*WATCHING/, { timeout: 15000 });
    if (mode === 'miner') {
      await expect(viewer.getByTestId('miner-prompt')).toBeVisible({ timeout: 30000 });
      await expect(viewer.getByTestId('miner-prompt')).toHaveText(await host.getByTestId('miner-prompt').textContent({ timeout: 30000 }));
    } else {
      await expect(viewer.locator('.wr-lanes li')).toHaveCount(await host.locator('.wr-lanes li').count());
    }
    if (SHOTS) {
      await viewer.screenshot({ path: `${SHOTS}/${mode}-watching-1366.png` });
      await host.screenshot({ path: `${SHOTS}/${mode}-host-1-watching.png` });
    }

    await viewer.locator('.mn-btn-ghost, .wr-btn-ghost').filter({ hasText: 'LEAVE' }).first().click();
    await menuReady(viewer);
    await expect(host.getByTestId('watchers-chip')).toHaveCount(0, { timeout: 15000 });
    for (const p of [host, viewer]) expect(p.errors, 'no page errors, no red console errors').toEqual([]);
  });
}

test('HOUSE ROOM reads as a real room: small while waiting, players drift in one at a time, the host starts it (no countdown), two humans play together', async ({ browser }) => {
  test.setTimeout(240000);
  const a = await viewerOnMenu(browser, 'HOUSEGUEST');
  const b = await freshPage(browser, 'phone', 'HOUSEPAL', { width: 390, height: 844 });
  await b.goto('/?portal=1&season2=1');
  await menuReady(b);
  await openList(a);
  // a house lobby is listed: its host + at most one more (never a room full of bots waiting for you)
  const row = a.locator('[data-testid="browser-room-row"][data-status="waiting"]').first();
  await expect(row).toBeVisible({ timeout: 60000 });
  const code = await row.getAttribute('data-code');
  const listed = Number(((await row.locator('[data-col="count"]').textContent()) || '').split('/')[0]);
  expect(listed, 'an unvisited house room is small').toBeLessThanOrEqual(2);
  await expect(row.locator('[data-col="action"]')).not.toContainText(/STARTS/);
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/house-list.png` });
  // the second human is on the list too, ready to join the same room
  await openList(b);
  const rowB = b.locator(`[data-testid="browser-room-row"][data-code="${code}"]`);
  await expect(rowB).toBeVisible({ timeout: 30000 });

  await row.click();
  await a.locator('.room-wrap').waitFor({ timeout: 30000 });
  await rowB.click();
  await b.locator('.room-wrap').waitFor({ timeout: 30000 });
  // a lobby like any other: WAITING FOR HOST, no countdown
  await expect(a.getByText('WAITING FOR HOST')).toBeVisible();
  await expect(a.getByTestId('room-autostart')).toHaveCount(0);
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/house-waiting.png` });
  // watch the roster until the game starts: it only ever grows by one at a time
  const counts = [];
  for (let i = 0; i < 240; i += 1) {
    if (!(await a.locator('.room-wrap').count())) break;
    counts.push(await a.locator('.room-player-chip').count());
    await a.waitForTimeout(250);
  }
  for (let i = 1; i < counts.length; i += 1) expect(counts[i] - counts[i - 1], `the roster grows one at a time (${counts.join(',')})`).toBeLessThanOrEqual(1);
  // nobody pressed START: the host started it, with both humans in the game
  await expect(a.locator('.room-wrap')).toHaveCount(0, { timeout: 60000 });
  await expect(b.locator('.room-wrap')).toHaveCount(0, { timeout: 15000 });
  if (SHOTS) { await a.waitForTimeout(4000); await a.screenshot({ path: `${SHOTS}/house-started.png` }); await b.screenshot({ path: `${SHOTS}/house-started-390.png` }); }
  await a.locator('.game-leave-btn').first().click();
  await b.locator('.game-leave-btn').first().click();
  for (const p of [a, b]) expect(p.errors, 'no page errors, no red console errors').toEqual([]);
});
