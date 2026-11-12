// e2e/miner-heroes-live.spec.js — EVERY MINER WEARS THEIR OWN HERO (Andy nov12: "for miner idk why the avatar is the miner
// avatar instead of the actual player's avatar"). Two browser contexts with DIFFERENT equipped heroes share one mine
// against a REAL backend: in the lobby seats and in the game's lanes, each screen draws ME as my hero and the OTHER
// player as theirs (the MINER lobby now announces the hero with set_hero, like the Word Bomb / Blitz lobby always did).
//
// OPT-IN (a running backend + a build pointed at it):
//   PORT=3913 node server.js                                                            (chain-reaction-backend)
//   VITE_BACKEND_WS_URL=ws://localhost:3913 npx vite build --outDir dist-live && npx vite preview --outDir dist-live --port 4396
//   LIVE_BASE=http://localhost:4396 npx playwright test e2e/miner-heroes-live.spec.js --workers=1
import { test, expect } from '@playwright/test';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.MH_SHOTS || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

const NOISE = /Failed to load resource|net::ERR_|posthog|adsbygoogle|sentry|supabase|lb\.e2e/i;

async function player(browser, name, hero) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await ctx.route(/posthog\.com|googlesyndication|googletagmanager|google-analytics|sentry\.io|vercel-insights|supabase\.co|lb\.e2e\.invalid/, (r) => r.abort());
  await ctx.addInitScript(([n, h]) => {
    try {
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
      localStorage.setItem('taw.playerName', n);
      localStorage.setItem('wa_playername', n);
      localStorage.setItem('taw.main', h);
      localStorage.setItem('taw.s2.heroes', JSON.stringify(['riot', 'glitch', 'hype', 'brawl', 'hex', h]));
      localStorage.setItem('taw.s2.heroes.gf', '1');
    } catch { /* storage blocked */ }
    window.__TAW_NO_AUTONAME = true;
  }, [name, hero]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${name} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) page.errors.push(`${name} console: ${m.text()}`); });
  return page;
}

/** hero shown in the lane / seat whose name reads `label` ('YOU' for me) */
const laneHero = (page, label) => page.locator('.mn-run').filter({ has: page.locator('.mn-run-name', { hasText: new RegExp(`^${label}$`) }) }).locator('.mn-run-digger').getAttribute('data-hero');

test('MINER: two players, two heroes - each screen draws me as mine and the other as theirs (lobby + lanes)', async ({ browser }) => {
  test.setTimeout(180000);
  const a = await player(browser, 'ANNA', 'hype');
  const b = await player(browser, 'BO', 'hex');
  await a.goto('/miner/play');
  await a.locator('.lobby-continue-btn').click({ timeout: 30000 });
  await a.getByTestId('miner-lobby').waitFor({ timeout: 30000 });
  const code = (await a.locator('.mn-code').textContent()).trim();
  await b.goto(`/?join=${code}`);
  await b.getByTestId('miner-lobby').waitFor({ timeout: 30000 });

  // LOBBY: both seats carry the right hero on BOTH screens (the other player's hero arrives with set_hero → room_update)
  for (const p of [a, b]) {
    await expect.poll(() => p.locator('.mn-seat-digger[data-hero]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hero')).sort().join(',')), { timeout: 20000 })
      .toContain('hex');
    await expect.poll(() => p.locator('.mn-seat-digger[data-hero]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hero')).sort().join(',')), { timeout: 20000 })
      .toContain('hype');
  }
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/miner-lobby-heroes.png` });

  await a.getByRole('button', { name: /^START$/ }).click();
  await Promise.all([a, b].map((p) => p.locator('.mn-run').first().waitFor({ timeout: 30000 })));
  // LANES: me = my hero, the other = theirs, on each screen
  expect(await laneHero(a, 'YOU')).toBe('hype');
  expect(await laneHero(a, 'BO')).toBe('hex');
  expect(await laneHero(b, 'YOU')).toBe('hex');
  expect(await laneHero(b, 'ANNA')).toBe('hype');
  // and nobody wears the old generic miner sprite
  for (const p of [a, b]) expect(await p.locator('img[src*="miner-hero"]').count()).toBe(0);
  if (SHOTS) { await a.screenshot({ path: `${SHOTS}/miner-lanes-a.png` }); await b.screenshot({ path: `${SHOTS}/miner-lanes-b.png` }); }
  for (const p of [a, b]) expect(p.errors, 'no page errors, no red console errors').toEqual([]);
});
