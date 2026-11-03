// e2e/menu-rooms-live.spec.js — OPEN ROOMS on the menu (Andy nov2) against a REAL backend: two browser contexts.
// A creates a PUBLIC Word Bomb room; B, sitting on the menu, sees it appear in the right-column panel (host name + host
// hero from list_public_rooms) within one 8s poll, taps JOIN, and both are in the room; A starts and BOTH reach the game
// (the documented non-host kick trap). Andy does not run 2-device play-tests, so this IS the multi-device check for this
// Tier-1 change.
//
// OPT-IN (needs a running backend and a build pointed at it, so the normal suite skips it):
//   PORT=3917 node server.js                                   (chain-reaction-backend, feat/public-rooms-host)
//   VITE_BACKEND_WS_URL=ws://localhost:3917 npx vite build && npx vite preview --port 4517
//   LIVE_BASE=http://localhost:4517 PW_PORT=4517 npx playwright test e2e/menu-rooms-live.spec.js --workers=1
// Against a backend WITHOUT hostName/hostHero the row falls back to the mode name + icon: set MR_OLD_BACKEND=1.
import { test, expect } from '@playwright/test';
import { menuReady, revealMode } from './support/menu.js';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.MR_SHOT_DIR || '';
const OLD_BACKEND = !!process.env.MR_OLD_BACKEND;
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

async function freshPage(browser, hero, name) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ h, n }) => {
    try {
      if (sessionStorage.getItem('mr.seeded')) return;
      sessionStorage.setItem('mr.seeded', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
      localStorage.setItem('taw.s2.heroes', JSON.stringify([h]));
      localStorage.setItem('taw.main', h);
      localStorage.setItem('taw.reveal', 'all');
      localStorage.setItem('wa_playername', n);
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  }, { h: hero, n: name });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && /key|collision/i.test(m.text())) page.errors.push(m.text()); });
  return page;
}

async function intoRoom(page, name) {
  const field = page.getByRole('textbox', { name: 'YOUR NAME' });
  const room = page.locator('.room-wrap');
  await Promise.race([field.waitFor({ timeout: 30000 }), room.waitFor({ timeout: 30000 })]);
  if (await field.isVisible()) {
    await field.fill(name);
    const pub = page.getByRole('button', { name: /PUBLIC/ });
    if (await pub.count()) await pub.first().click();
    await page.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await room.waitFor({ timeout: 30000 });
}

test('two browsers: a public room appears on the OTHER menu, JOIN puts both in the room, both reach the game', async ({ browser }) => {
  test.setTimeout(240000);
  const host = await freshPage(browser, 'mecha', 'HOSTBOT');
  await host.goto('/?portal=1&season2=1');
  await menuReady(host);
  await (await revealMode(host, 'word-bomb')).click();
  await host.locator('.mode-dialog-btn-create:visible').first().click();
  await intoRoom(host, 'HOSTBOT');
  const code = (await host.locator('.room-code').getAttribute('aria-label')).replace('Room code ', '').trim();

  const guest = await freshPage(browser, 'hex', 'GUESTBOT');
  await guest.goto('/?portal=1&season2=1');
  await menuReady(guest);
  const row = guest.locator(`.mr-row[data-code="${code}"]`);
  await expect(row).toBeVisible({ timeout: 20000 }); // first request on mount, then every 8s
  if (OLD_BACKEND) {
    await expect(row.locator('.mr-host')).toHaveText('WORD BOMB');
  } else {
    await expect(row.locator('.mr-host')).toHaveText('HOSTBOT');
    await expect(row.locator('.mr-face img')).toHaveAttribute('src', /\/cast\/mecha-hero\.webp$/);
  }
  await expect(row.locator('.mr-count')).toHaveText(/^1\/\d+$/);
  if (SHOTS) {
    await guest.evaluate(() => document.fonts && document.fonts.ready);
    await guest.screenshot({ path: `${SHOTS}/live-guest-menu-1366.png` });
  }

  // JOIN from the menu → the existing join_room → App's room_update path puts the guest in the room
  await row.locator('.mr-join').click();
  await guest.locator('.room-wrap').waitFor({ timeout: 20000 });
  await expect(host.locator('.room-player-chip')).toHaveCount(2, { timeout: 15000 });

  // START: both clients leave the waiting screen (no freeze, non-host not kicked back to waiting)
  await host.locator('.room-start-btn').click();
  await expect(host.locator('.room-wrap')).toHaveCount(0, { timeout: 20000 });
  await expect(guest.locator('.room-wrap')).toHaveCount(0, { timeout: 20000 });
  await expect(guest.locator('.wb-seat-char, .game-screen, [class*="wb-"]').first()).toBeVisible({ timeout: 15000 });

  expect(host.errors, host.errors.join('\n')).toEqual([]);
  expect(guest.errors, guest.errors.join('\n')).toEqual([]);
});
