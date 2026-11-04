// e2e/spectate-live.spec.js — SPECTATE (Andy nov4: "public rooms stay listed once a game starts, with SPECTATE") against a
// REAL backend (backend #44). Browser contexts: a host opens a public room; a viewer on the menu sees it as IN LOBBY → JOIN,
// the host starts, and the same row flips to PLAYING → SPECTATE. SPECTATE puts the viewer on the live board read-only
// (no input, a SPECTATING badge, never a seat on the host's board) and the board keeps moving; a phone-width viewer
// reaches the same row through N OPEN → JOIN ROOM and watches too; LEAVE takes a viewer back to the menu. Category Blitz:
// a watcher lands mid-round with no 3-2-1 and no answer field. No page errors, no red console errors.
//
// OPT-IN (needs a running backend + a build pointed at it):
//   npx vite build && npx vite preview --port 4173      (no VITE_BACKEND_WS_URL = the LIVE Render backend)
//   LIVE_BASE=http://localhost:4173 npx playwright test e2e/spectate-live.spec.js --workers=1
import { test, expect } from '@playwright/test';
import { menuReady, revealMode } from './support/menu.js';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.SP_LIVE_SHOTS || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

const BLOCK = /posthog\.com|googlesyndication|googletagmanager|google-analytics|sentry\.io|vercel-insights|\/_vercel\/insights/;
const NOISE = /Failed to load resource|net::ERR_|posthog|adsbygoogle|sentry/i;
const SEATS = '.wb-seat-char:not(.wb-seat-ring)';

async function freshPage(browser, tag, name, viewport = { width: 1366, height: 768 }) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport, reducedMotion: 'reduce' });
  await ctx.route(BLOCK, (route) => route.abort());
  await ctx.addInitScript((n) => {
    try {
      if (sessionStorage.getItem('spl.seeded')) return;
      sessionStorage.setItem('spl.seeded', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
      localStorage.setItem('taw.reveal', 'all');
      if (n) localStorage.setItem('wa_playername', n);
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  }, name);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) page.errors.push(`${tag} console: ${m.text()}`); });
  return page;
}

/** The host opens a PUBLIC room of `mode` with one bot opponent; returns its code. */
async function hostPublicRoom(host, mode, name) {
  await host.goto('/?portal=1&season2=1');
  await menuReady(host);
  await (await revealMode(host, mode)).click();
  await host.locator('.mode-dialog-btn-create:visible').first().click();
  const field = host.getByRole('textbox', { name: 'YOUR NAME' });
  await Promise.race([field.waitFor({ timeout: 45000 }), host.locator('.room-wrap').waitFor({ timeout: 45000 })]);
  if (await field.isVisible()) {
    await field.fill(name);
    await host.getByRole('button', { name: /PUBLIC/ }).click();
    await host.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await host.locator('.room-wrap').waitFor({ timeout: 45000 });
  // a rival: the host's bot opponent (independent of the lobby-bots opt-in)
  await host.getByRole('button', { name: /ADD BOT OPPONENT/ }).click();
  await host.getByRole('button', { name: /^EASY/ }).click();
  await expect.poll(() => host.locator('.room-player-chip').count(), { timeout: 20000, intervals: [1000] }).toBeGreaterThanOrEqual(2);
  return (await host.locator('.room-code').getAttribute('aria-label')).replace('Room code ', '').trim();
}

test('Word Bomb: a live public game stays listed (IN LOBBY → JOIN, then PLAYING → SPECTATE); watching is read-only; LEAVE returns to the menu', async ({ browser }) => {
  test.setTimeout(300000);
  const host = await freshPage(browser, 'host', null);
  const code = await hostPublicRoom(host, 'word-bomb', 'SPHOST');

  // THE VIEWER on the menu: the room is IN LOBBY → JOIN
  const viewer = await freshPage(browser, 'viewer', 'SPWATCH');
  await viewer.goto('/?portal=1&season2=1');
  await menuReady(viewer);
  const row = viewer.locator(`.mr-row[data-code="${code}"]`);
  await expect(row).toBeVisible({ timeout: 30000 });
  await expect(row.getByTestId('menu-room-status')).toHaveText('IN LOBBY');
  await expect(row.locator('.mr-join')).toHaveText('JOIN');

  await host.locator('.room-start-btn').click();
  await expect(host.locator('.room-wrap')).toHaveCount(0, { timeout: 30000 });
  await expect.poll(() => host.locator(SEATS).count(), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  const seats = await host.locator(SEATS).count();

  // ...the SAME row stays listed and flips to PLAYING → SPECTATE (the menu polls every 8 s)
  await expect(row.getByTestId('menu-room-status')).toHaveText('PLAYING', { timeout: 30000 });
  await expect(row.locator('.mr-join')).toHaveText('SPECTATE');
  if (SHOTS) await viewer.screenshot({ path: `${SHOTS}/spectate-menu-1366.png` });

  // SPECTATE: the viewer lands on the live board, read-only
  await row.locator('.mr-join').click();
  await expect(viewer.getByTestId('watch-chip')).toBeVisible({ timeout: 20000 });
  await expect(viewer.getByTestId('watch-bar')).toBeInViewport();
  await expect(viewer.locator('.game-input')).toHaveCount(0);
  await expect(viewer.locator('.room-wrap')).toHaveCount(0);
  await expect.poll(() => viewer.locator(SEATS).count(), { timeout: 15000 }).toBe(seats);

  // A PHONE-width viewer reaches the same live row through N OPEN → JOIN ROOM, and watches too (two in the audience)
  const phone = await freshPage(browser, 'phone', 'SPPHONE', { width: 390, height: 844 });
  await phone.goto('/?portal=1&season2=1');
  await menuReady(phone);
  await phone.getByTestId('menu-rooms-chip').click();
  const prow = phone.locator('[data-testid="browser-room-row"][data-status="playing"]', { hasText: code });
  await expect(prow).toBeVisible({ timeout: 30000 });
  await expect(prow.locator('.browser-row-status')).toHaveText('SPECTATE');
  if (SHOTS) await phone.screenshot({ path: `${SHOTS}/spectate-browse-390.png` });
  await prow.click();
  await expect(phone.getByTestId('watch-bar')).toBeInViewport({ timeout: 20000 });
  await expect(phone.locator('.game-input')).toHaveCount(0);

  // never a seat: the host's board is unchanged
  expect(await host.locator(SEATS).count()).toBe(seats);

  // the board keeps moving for the watcher (turns pass: the prompt changes)
  const snap = () => viewer.locator('.wb-top').innerText().catch(() => '');
  const first = await snap();
  await expect.poll(snap, { timeout: 60000, intervals: [1500] }).not.toBe(first);
  if (SHOTS) {
    await viewer.screenshot({ path: `${SHOTS}/spectate-watching-1366.png` });
    await phone.screenshot({ path: `${SHOTS}/spectate-watching-390.png` });
  }

  // LEAVE: back to the menu; the host's game carries on
  await viewer.locator('.game-leave-btn').first().click();
  await menuReady(viewer);
  await phone.locator('.game-leave-btn').first().click();
  await menuReady(phone);
  await expect(host.locator('.room-wrap')).toHaveCount(0);

  for (const p of [host, viewer, phone]) expect(p.errors, 'no page errors, no red console errors').toEqual([]);
});

test('Category Blitz: a watcher lands mid-round - no 3-2-1, no answer field', async ({ browser }) => {
  test.setTimeout(240000);
  const host = await freshPage(browser, 'host', null);
  const code = await hostPublicRoom(host, 'category-blitz', 'CBHOST');
  await host.locator('.room-start-btn').click();
  await expect(host.locator('.room-wrap')).toHaveCount(0, { timeout: 30000 });

  const viewer = await freshPage(browser, 'viewer', 'CBWATCH');
  await viewer.goto('/?portal=1&season2=1');
  await menuReady(viewer);
  const row = viewer.locator(`.mr-row[data-code="${code}"]`);
  await expect(row.getByTestId('menu-room-status')).toHaveText('PLAYING', { timeout: 30000 });
  await viewer.waitForTimeout(4000); // past the host's round-1 countdown: the watcher joins a running round
  await row.locator('.mr-join').click();
  await expect(viewer.getByTestId('watch-bar')).toBeInViewport({ timeout: 20000 });
  await expect(viewer.locator('.countdown-overlay')).toHaveCount(0);
  await expect(viewer.locator('.game-input')).toHaveCount(0);
  // the category is on the card (its spray reveal lands, with no countdown in front of it)
  await expect(viewer.locator('.cb-category-display')).toContainText(/[A-Z]{3,}/, { timeout: 5000 });
  if (SHOTS) {
    await viewer.waitForTimeout(2000); // the screen wipe settles before the shot
    await viewer.screenshot({ path: `${SHOTS}/spectate-blitz-1366.png` });
  }

  await viewer.locator('.game-leave-btn').first().click();
  await menuReady(viewer);
  for (const p of [host, viewer]) expect(p.errors, 'no page errors, no red console errors').toEqual([]);
});
