// e2e/public-autostart-live.spec.js — PUBLIC ROOMS START ON THEIR OWN (Andy nov12: "they must start after like + 5 sec
// (for every player joining) after the first"). Against a REAL backend, three browser contexts: a host opens a PUBLIC
// Word Bomb room; the second player's arrival starts a countdown everyone sees (STARTS IN); a third arrival adds ~5 s; at
// zero the game starts on every screen with nobody pressing START. The server owns the clock; clients only draw it.
//
// OPT-IN (a running backend + a build pointed at it):
//   AUTO_START_BASE_MS=12000 LOBBY_BOT_MS=600000 HOUSE_ROOMS=0 PORT=3914 node server.js   (chain-reaction-backend)
//   VITE_BACKEND_WS_URL=ws://localhost:3914 npx vite build --outDir dist-live && npx vite preview --outDir dist-live --port 4397
//   LIVE_BASE=http://localhost:4397 npx playwright test e2e/public-autostart-live.spec.js --workers=1
import { test, expect } from '@playwright/test';
import { menuReady, revealMode } from './support/menu.js';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.PA_SHOTS || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');
const NOISE = /Failed to load resource|net::ERR_|posthog|adsbygoogle|sentry|supabase|lb\.e2e/i;

async function player(browser, name) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await ctx.route(/posthog\.com|googlesyndication|googletagmanager|google-analytics|sentry\.io|vercel-insights|supabase\.co|lb\.e2e\.invalid/, (r) => r.abort());
  await ctx.addInitScript((n) => {
    try {
      if (sessionStorage.getItem('pa.seeded')) return;
      sessionStorage.setItem('pa.seeded', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
      localStorage.setItem('taw.reveal', 'all'); // every mode card unlocked on the menu
      localStorage.setItem('wa_playername', n);
      localStorage.setItem('taw.playerName', n);
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  }, name);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${name} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) page.errors.push(`${name} console: ${m.text()}`); });
  return page;
}
const secs = async (p) => Number(((await p.getByTestId('room-autostart').textContent()) || '').replace(/\D+/g, '')) || 0;

test('2 join → a visible countdown; a 3rd join adds ~5 s; it starts on its own for everyone', async ({ browser }) => {
  test.setTimeout(180000);
  const host = await player(browser, 'HOSTY');
  await host.goto('/?portal=1&season2=1');
  await menuReady(host);
  await (await revealMode(host, 'word-bomb')).click();
  await host.locator('.mode-dialog-btn-create:visible').first().click();
  const field = host.getByRole('textbox', { name: 'YOUR NAME' });
  await Promise.race([field.waitFor({ timeout: 45000 }), host.locator('.room-wrap').waitFor({ timeout: 45000 })]);
  if (await field.isVisible()) {
    await field.fill('HOSTY');
    await host.getByRole('button', { name: /PUBLIC/ }).click();
    await host.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await host.locator('.room-wrap').waitFor({ timeout: 45000 });
  const code = (await host.locator('.room-code').getAttribute('aria-label')).replace('Room code ', '').trim();
  // alone: no clock
  await expect(host.getByTestId('room-autostart')).toHaveCount(0);

  const two = await player(browser, 'TWOFER');
  await two.goto(`/?join=${code}`);
  await two.locator('.room-wrap').waitFor({ timeout: 45000 });
  for (const p of [host, two]) await expect(p.getByTestId('room-autostart')).toContainText(/STARTS IN/, { timeout: 15000 });
  const before = await secs(host);
  if (SHOTS) await two.screenshot({ path: `${SHOTS}/autostart-2.png` });

  const three = await player(browser, 'THIRDY');
  await three.goto(`/?join=${code}`);
  await three.locator('.room-wrap').waitFor({ timeout: 45000 });
  await expect(three.getByTestId('room-autostart')).toContainText(/STARTS IN/, { timeout: 15000 });
  // the third arrival added time: the clock reads more than it would have without it (allow a couple of seconds' travel)
  const after = await secs(host);
  expect(after, `before ${before}s, after ${after}s`).toBeGreaterThanOrEqual(before + 2);
  if (SHOTS) await three.screenshot({ path: `${SHOTS}/autostart-3.png` });

  // nobody presses START: it starts for all three
  for (const p of [host, two, three]) await expect(p.locator('.room-wrap')).toHaveCount(0, { timeout: 60000 });
  for (const p of [host, two, three]) expect(p.errors, 'no page errors, no red console errors').toEqual([]);
});
