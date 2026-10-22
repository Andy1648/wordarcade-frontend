// e2e/blitz-round-break-live.spec.js — the scaled Blitz round break against a REAL backend (no mock): N browser contexts
// in one room, a real round played out. Andy does not run 2-device play-tests (oct21), so this IS the multi-device check
// for the Tier-1 round break: on EVERY client the results count down from 4s + 1s/player, the next round_start arrives
// exactly that long after round_end (wire timestamps), and no client is out of step with the others.
//
// OPT-IN (it needs a running backend and a build pointed at it, so the normal suite skips it):
//   PORT=3911 node server.js                                   (chain-reaction-backend)
//   VITE_BACKEND_WS_URL=ws://localhost:3911 npx vite build && npx vite preview --port 4394
//   LIVE_BASE=http://localhost:4394 PW_PORT=4394 npx playwright test e2e/blitz-round-break-live.spec.js
import { test, expect } from '@playwright/test';
import { gotoMenu } from './support/backendMock.js';

const BASE = process.env.LIVE_BASE || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

async function freshPage(browser) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  });
  const page = await ctx.newPage();
  // wire-level timestamps (Node clock, shared by every client): when each client RECEIVED round_end / the next round_start
  page.wire = {};
  page.on('websocket', (ws) => ws.on('framereceived', (f) => {
    const m = /"type":"(round_end|round_start)"/.exec(String(f.payload));
    if (m) (page.wire[m[1]] = page.wire[m[1]] || []).push(Date.now());
  }));
  return page;
}

// The name screen (an unnamed visitor) comes before the room: fill it and CONTINUE, then wait for the room.
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

// Watch one client: when the results countdown first appears, what it says, and when the next round replaces it.
function watch(page) {
  return page.evaluate(() => new Promise((resolve) => {
    let shownAt = 0; let firstText = '';
    const tick = () => {
      const el = document.querySelector('.cb-next-round');
      if (el && !shownAt) { shownAt = performance.timeOrigin + performance.now(); firstText = el.textContent; }
      if (!el && shownAt) return resolve({ shownAt, goneAt: performance.timeOrigin + performance.now(), firstText });
      requestAnimationFrame(tick);
    };
    tick();
  }));
}

for (const n of [2, 3]) {
  test(`${n} players: the break is ${Math.min(10, 4 + n)}s on every client, in sync`, async ({ browser }) => {
    test.setTimeout(180000);
    const expectS = Math.min(10, 4 + n);
    const host = await freshPage(browser);
    await gotoMenu(host);
    await host.getByRole('button', { name: /CATEGORY BLITZ/i }).first().click();
    await host.locator('.mode-dialog-btn-create').first().click();
    await intoRoom(host, 'HOSTBOT');
    const code = (await host.locator('.room-code').getAttribute('aria-label')).replace('Room code ', '').trim();

    const guests = [];
    for (let i = 1; i < n; i += 1) {
      const g = await freshPage(browser);
      await g.goto(`${BASE}/room/${code}`);
      await intoRoom(g, `GUEST${i}`);
      guests.push(g);
    }
    const all = [host, ...guests];
    await expect(host.locator('.room-player-chip')).toHaveCount(n, { timeout: 15000 });
    await host.locator('.room-start-btn').click();
    for (const p of all) await p.locator('.game-input').waitFor({ timeout: 30000 });

    // play: everyone types one plausible answer so the round has content (accepted or not doesn't matter here)
    for (const p of all) {
      await p.locator('.game-input').fill('pizza');
      await p.keyboard.press('Enter');
    }
    const results = await Promise.all(all.map((p) => watch(p)));
    const lens = results.map((r) => (r.goneAt - r.shownAt) / 1000);
    console.log(`LIVE n=${n}`, JSON.stringify(results.map((r, i) => ({ text: r.firstText, len: lens[i].toFixed(2) }))));
    for (const r of results) expect(r.firstText).toContain(`IN ${expectS} SECONDS`);
    for (const len of lens) expect(Math.abs(len - expectS)).toBeLessThan(1.0);
    const wireEnd = all.map((p) => p.wire.round_end?.[0]);
    const wireNext = all.map((p) => p.wire.round_start?.[1]);
    const wireGap = all.map((p, i) => (wireNext[i] - wireEnd[i]) / 1000);
    console.log(`WIRE n=${n}`, JSON.stringify({ gaps: wireGap, endSpreadMs: Math.max(...wireEnd) - Math.min(...wireEnd), nextSpreadMs: Math.max(...wireNext) - Math.min(...wireNext) }));
    for (const g of wireGap) expect(Math.abs(g - expectS)).toBeLessThan(0.3);
    expect(Math.max(...wireEnd) - Math.min(...wireEnd)).toBeLessThan(200);
    expect(Math.max(...wireNext) - Math.min(...wireNext)).toBeLessThan(200);
    const starts = results.map((r) => r.shownAt);
    const ends = results.map((r) => r.goneAt);
    console.log(`PAINT n=${n}`, JSON.stringify({ startSpreadMs: Math.round(Math.max(...starts) - Math.min(...starts)), endSpreadMs: Math.round(Math.max(...ends) - Math.min(...ends)) }));
    // paint timing is the headless renderer under machine load (3 browsers), so it gets a looser bound than the wire
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(1000);
    expect(Math.max(...ends) - Math.min(...ends)).toBeLessThan(1000);
  });
}
