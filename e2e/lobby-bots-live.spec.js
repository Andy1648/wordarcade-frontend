// e2e/lobby-bots-live.spec.js — LOBBY BOTS against a REAL backend (backend #43; this client opts in with create_room
// { lobbyBots: true } for a PUBLIC room). Two browser contexts: the host opens a public Word Bomb room and waits -
// seeded-persona bots drift into the lobby, drawn as players (a hero in the seat, no BOT badge, no remove control); a
// second human joins by code and is never blocked; the host starts and BOTH humans reach the game with the bots seated
// in it; no page errors, no red console errors. Analytics / ads / error reporting are blocked.
// (That a human joining a FULL lobby takes a bot's seat is pinned server-side: lobbyBots.test.js + lobbyBots.server.test.js.)
//
// OPT-IN (needs a running backend + a build pointed at it):
//   npx vite build && npx vite preview --port 4173      (no VITE_BACKEND_WS_URL = the LIVE Render backend)
//   LIVE_BASE=http://localhost:4173 npx playwright test e2e/lobby-bots-live.spec.js --workers=1
import { test, expect } from '@playwright/test';
import { menuReady, revealMode } from './support/menu.js';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.LB_LIVE_SHOTS || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

const BLOCK = /posthog\.com|googlesyndication|googletagmanager|google-analytics|sentry\.io|vercel-insights|\/_vercel\/insights/;
const NOISE = /Failed to load resource|net::ERR_|posthog|adsbygoogle|sentry/i;

async function freshPage(browser, tag) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await ctx.route(BLOCK, (route) => route.abort());
  await ctx.addInitScript(() => {
    try {
      if (sessionStorage.getItem('lbl.seeded')) return;
      sessionStorage.setItem('lbl.seeded', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) page.errors.push(`${tag} console: ${m.text()}`); });
  return page;
}

async function nameAndGo(page, name, { makePublic = false } = {}) {
  const field = page.getByRole('textbox', { name: 'YOUR NAME' });
  const room = page.locator('.room-wrap');
  await Promise.race([field.waitFor({ timeout: 45000 }), room.waitFor({ timeout: 45000 })]);
  if (await field.isVisible()) {
    await field.fill(name);
    if (makePublic) await page.getByRole('button', { name: /PUBLIC/ }).click();
    await page.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await room.waitFor({ timeout: 45000 });
}

const chips = (page) => page.locator('.room-player-chip');

test('a public Word Bomb lobby fills with bots drawn as players; a second human joins; the game starts for both', async ({ browser }) => {
  test.setTimeout(300000);
  const host = await freshPage(browser, 'host');
  await host.goto('/?portal=1&season2=1');
  await menuReady(host);
  await (await revealMode(host, 'word-bomb')).click();
  await host.locator('.mode-dialog-btn-create:visible').first().click();
  await nameAndGo(host, 'LBHOST', { makePublic: true });
  const code = (await host.locator('.room-code').getAttribute('aria-label')).replace('Room code ', '').trim();

  // BOTS DRIFT IN (the first one 6-14 s after the host sits down, then one every 10-30 s): at least two seats more
  await expect.poll(() => chips(host).count(), { timeout: 90000, intervals: [2000] }).toBeGreaterThanOrEqual(3);
  // ...drawn as players: no BOT badge, no remove control, every seat has a name
  await expect(host.locator('.room-bot-badge')).toHaveCount(0);
  await expect(host.locator('.room-bot-remove')).toHaveCount(0);
  const names = await host.locator('.room-player-name').allTextContents();
  expect(names.every((n) => n.trim().length >= 3), `seat names: ${names.join(', ')}`).toBe(true);
  if (SHOTS) await host.screenshot({ path: `${SHOTS}/lobby-bots-host.png` });

  // A SECOND HUMAN joins by code - never blocked by the bots - and sees the same seated players
  const guest = await freshPage(browser, 'guest');
  await guest.goto(`${BASE}/room/${code}?season2=1`);
  await nameAndGo(guest, 'LBGUEST'); // a /room/CODE link may seat them straight away under an auto-name
  const guestName = (await guest.locator('.room-player-chip:has(.room-you-badge) .room-player-name').first().textContent()).trim();
  await expect(host.locator('.room-player-name', { hasText: guestName })).toHaveCount(1, { timeout: 20000 });
  await expect(guest.locator('.room-bot-badge')).toHaveCount(0);
  const seated = await chips(host).count();
  expect(seated).toBeGreaterThanOrEqual(3);
  expect(seated).toBeLessThan(8); // the last seat always stays free for a human

  // START: both humans reach the game (the non-host kick trap), with the bots seated in it
  await host.locator('.room-start-btn').click();
  await expect(host.locator('.room-wrap')).toHaveCount(0, { timeout: 30000 });
  await expect(guest.locator('.room-wrap')).toHaveCount(0, { timeout: 30000 });
  await expect.poll(() => host.locator('.wb-seat-char:not(.wb-seat-ring)').count(), { timeout: 15000 }).toBeGreaterThanOrEqual(3);
  // the game keeps running (bots take their turns) - no freeze back to a waiting screen
  await host.waitForTimeout(15000);
  await expect(host.locator('.room-wrap')).toHaveCount(0);
  await expect(guest.locator('.room-wrap')).toHaveCount(0);
  if (SHOTS) await guest.screenshot({ path: `${SHOTS}/lobby-bots-game-guest.png` });

  for (const p of [host, guest]) expect(p.errors, 'no page errors, no red console errors').toEqual([]);
});
