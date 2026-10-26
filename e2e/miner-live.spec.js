// e2e/miner-live.spec.js — MINER against a REAL backend (no mock): three browser contexts (desktop, Chromebook,
// phone) quick-match into ONE mine and play it to the core. Andy does not run 2-device play-tests (oct21), so this
// IS the multi-device check for the Tier-1 MINER wire: every client sees the same prompt, a locked answer is private
// until the reveal, a blank caves in, depth lands on every client, the first to 500m wins on every client — and no
// screen scrolls, no console error.
//
// OPT-IN (it needs a running backend and a build pointed at it, so the normal suite skips it):
//   MINER_FILL_WAIT_MS=6000 PORT=3911 node server.js            (chain-reaction-backend)
//   VITE_BACKEND_WS_URL=ws://localhost:3911 npx vite build && npx vite preview --port 4394
//   LIVE_BASE=http://localhost:4394 BACKEND_DIR=../crb-miner npx playwright test e2e/miner-live.spec.js
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.LIVE_BASE || '';
const SHOTS = process.env.MINER_SHOTS || '';
test.skip(!BASE, 'live check: set LIVE_BASE to a build pointed at a running backend (see header)');

const CANON = BASE ? JSON.parse(readFileSync(join(process.env.BACKEND_DIR || '../crb-miner', 'blitzCanon.json'), 'utf8')) : {};
const head = (prompt) => CANON[prompt][0].canon;
const deep = (prompt) => {
  const list = CANON[prompt];
  return list[Math.floor(list.length * 0.8)].canon; // DIAMOND band
};

const errors = [];
async function freshPage(browser, viewport, name) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport, reducedMotion: 'reduce' });
  await ctx.addInitScript((n) => {
    try {
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
      localStorage.setItem('taw.playerName', n);
    } catch { /* storage blocked */ }
  }, name);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/posthog|sentry|vercel|analytics|Failed to load resource|Content Security Policy|google/i.test(m.text())) errors.push(`${name}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  return page;
}

async function noScroll(page) {
  return page.evaluate(() => ({
    v: document.scrollingElement.scrollHeight - window.innerHeight,
    h: document.scrollingElement.scrollWidth - window.innerWidth,
  }));
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

test('three devices quick-match into one mine and dig it to the core', async ({ browser }) => {
  test.setTimeout(240000);
  const a = await freshPage(browser, { width: 1366, height: 768 }, 'ANNA');
  const b = await freshPage(browser, { width: 1280, height: 600 }, 'BO');
  const c = await freshPage(browser, { width: 390, height: 844 }, 'CY');
  const all = [a, b, c];

  // all three in parallel: a quick-match mine launches 8s after it opens, so a slow third load would open its own mine
  await Promise.all(all.map((p) => p.goto('/miner/play')));
  await Promise.all(all.map((p) => p.getByTestId('miner-lobby').waitFor({ timeout: 30000 })));
  await shot(a, 'lobby-1366');
  await shot(c, 'lobby-390');
  const codes = await Promise.all(all.map((p) => p.locator('.mn-code').textContent()));
  expect(new Set(codes).size, 'everyone landed in the same mine').toBe(1);

  let round = 0;
  while (round < 12) {
    round += 1;
    await Promise.all(all.map((p) => p.getByTestId('miner-prompt').waitFor({ timeout: 30000 })));
    const prompts = await Promise.all(all.map((p) => p.getByTestId('miner-prompt').textContent()));
    expect(new Set(prompts).size, `round ${round}: one prompt for everyone`).toBe(1);
    const prompt = prompts[0];
    for (const p of all) expect(await noScroll(p), `no scroll while digging (round ${round})`).toEqual({ v: 0, h: 0 });

    // A digs deep, B digs the obvious answer; C blanks round 1 (a cave-in) and digs the obvious one after.
    await a.locator('.mn-input').fill(deep(prompt));
    await a.locator('.mn-input').press('Enter');
    await a.getByTestId('miner-locked').waitFor();
    if (round === 1) {
      await shot(a, 'dig-locked-1366');
      await b.locator('.mn-input').fill('zzzz not a thing');
      await b.locator('.mn-input').press('Enter');
      await expect(b.locator('.mn-toast.is-reject')).toHaveText('NOT ON THE LIST');
      await shot(b, 'dig-reject-1280x600');
      await shot(c, 'dig-390');
    }
    await b.locator('.mn-input').fill(head(prompt));
    await b.locator('.mn-input').press('Enter');
    if (round > 1) {
      await c.locator('.mn-input').fill(head(prompt));
      await c.locator('.mn-input').press('Enter');
    }
    await Promise.all(all.map((p) => p.getByTestId('miner-reveal').or(p.getByTestId('miner-over')).waitFor({ timeout: 20000 })));
    if (round === 1) {
      await shot(a, 'reveal-1366');
      await shot(c, 'reveal-390');
      await expect(c.locator('.mn-pick.is-cave')).toHaveCount(1);
    }
    if (await a.getByTestId('miner-over').isVisible().catch(() => false)) break;
    const overSoon = await a.getByTestId('miner-over').waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    if (overSoon) break;
  }

  await Promise.all(all.map((p) => p.getByTestId('miner-over').waitFor({ timeout: 20000 })));
  await expect(a.locator('.mn-over-title')).toHaveText('YOU HIT THE CORE!');
  await expect(b.locator('.mn-over-title')).toHaveText(/PLACE/);
  for (const p of all) expect(await noScroll(p), 'no scroll on the results').toEqual({ v: 0, h: 0 });
  await shot(a, 'over-1366');
  await shot(b, 'over-1280x600');
  await shot(c, 'over-390');
  expect(round, 'a deep digger reaches 500m in 5 rounds').toBe(5);
  expect(errors, errors.join('\n')).toEqual([]);
});
