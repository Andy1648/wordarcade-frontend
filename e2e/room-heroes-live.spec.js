// e2e/room-heroes-live.spec.js — HEROES IN EVERY SEAT (oct21, Andy: "no one is addicted to getting rare heroes yet")
// against a REAL backend: two browser contexts in one room, each with a different equipped hero. Each must see the OTHER
// player's real hero in the lobby seat and in the Word Bomb seat (backend set_hero → room_update.players[].hero), and
// the game must start for both (no freeze, no kick to the waiting screen). Andy does not run 2-device play-tests, so this
// IS the multi-device check for this Tier-1 change.
//
// OPT-IN (it needs a running backend and a build pointed at it, so the normal suite skips it):
//   PORT=3911 node server.js                                   (chain-reaction-backend, the set_hero branch)
//   VITE_BACKEND_WS_URL=ws://localhost:3911 npx vite build && npx vite preview --port 4394
//   LIVE_BASE=http://localhost:4394 PW_PORT=4394 npx playwright test e2e/room-heroes-live.spec.js
import { test, expect } from '@playwright/test';
import { menuReady, revealMode } from './support/menu.js';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.RH_SHOT_DIR || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

async function freshPage(browser, hero, viewport = { width: 1366, height: 768 }) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport, reducedMotion: 'reduce' });
  await ctx.addInitScript((h) => {
    try {
      if (sessionStorage.getItem('rh.seeded')) return;
      sessionStorage.setItem('rh.seeded', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
      localStorage.setItem('taw.s2.heroes', JSON.stringify([h])); // owned (bought)
      localStorage.setItem('taw.main', h); // equipped
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  }, hero);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  return page;
}

async function intoRoom(page, name) {
  const field = page.getByRole('textbox', { name: 'YOUR NAME' });
  const room = page.locator('.room-wrap');
  await Promise.race([field.waitFor({ timeout: 30000 }), room.waitFor({ timeout: 30000 })]);
  if (await field.isVisible()) {
    await field.fill(name);
    await page.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await room.waitFor({ timeout: 30000 });
}

// the hero image the OTHER player's lobby seat shows (the chip that is not yours)
const otherSeatHero = (page) => page.locator('.room-player-chip:not(:has(.room-you-badge)) .rh-btn.is-static img').first();

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: each player sees the OTHER's real hero — lobby seat + Word Bomb seat`, async ({ browser }) => {
    test.setTimeout(180000);
    const host = await freshPage(browser, 'mecha', vp);
    await host.goto('/?portal=1&season2=1'); // the URL wins over the suite's season-1 storage switch
    await menuReady(host);
    await (await revealMode(host, 'word-bomb')).click();
    await host.locator('.mode-dialog-btn-create:visible').first().click();
    await intoRoom(host, 'HOSTBOT');
    const code = (await host.locator('.room-code').getAttribute('aria-label')).replace('Room code ', '').trim();

    const guest = await freshPage(browser, 'hex', vp);
    await guest.goto(`${BASE}/room/${code}?season2=1`);
    await intoRoom(guest, 'GUESTBOT');
    await expect(host.locator('.room-player-chip')).toHaveCount(2, { timeout: 15000 });

    // LOBBY: each sees the other's equipped hero (not a seat-colour stand-in)
    await expect(otherSeatHero(guest)).toHaveAttribute('src', /\/cast\/mecha-hero\.webp$/, { timeout: 10000 });
    await expect(otherSeatHero(host)).toHaveAttribute('src', /\/cast\/hex-hero\.webp$/, { timeout: 10000 });
    await expect(host.locator('[data-testid="room-hero"] img')).toHaveAttribute('src', /mecha-hero/);
    if (SHOTS) await guest.screenshot({ path: `${SHOTS}/lobby-guest-${vp.width}.png` });

    // GAME: start, both clients in (the documented non-host kick trap), the other's seat is their hero
    await host.locator('.room-start-btn').click();
    await expect(host.locator('.room-wrap')).toHaveCount(0, { timeout: 20000 });
    await expect(guest.locator('.room-wrap')).toHaveCount(0, { timeout: 20000 });
    const seatSrcs = async (page) => page.locator('.wb-seat-char:not(.wb-seat-ring)').evaluateAll((els) => els.map((e) => (e.tagName === 'IMG' ? e.getAttribute('src') : (e.querySelector('img') || {}).getAttribute?.('src') || '')));
    await expect.poll(async () => (await seatSrcs(guest)).join(' '), { timeout: 15000 }).toMatch(/mecha/);
    await expect.poll(async () => (await seatSrcs(host)).join(' '), { timeout: 15000 }).toMatch(/hex/);
    // MECHA is a LEGEND: its painted seat ring shows on the guest's screen too
    await expect(guest.locator('.wb-seat-ring[src*="seat-ring-legend"]')).toHaveCount(1);
    if (SHOTS) { await guest.waitForTimeout(600); await guest.screenshot({ path: `${SHOTS}/game-guest-${vp.width}.png` }); }

    for (const p of [host, guest]) expect(p.errors, 'no page errors').toEqual([]);
  });
}
