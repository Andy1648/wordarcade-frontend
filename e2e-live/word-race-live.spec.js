// e2e-live/word-race-live.spec.js — WORD RACE against a REAL local backend (not the mock).
//
// Run: start chain-reaction-backend locally (`PORT=3001 node server.js`), then
//   RACE_WS=ws://127.0.0.1:3001 RACE_BACKEND_DIR=../chain-reaction-backend \
//     npx playwright test -c playwright.race-live.config.js
//
// Two HUMANS in two browser contexts + one BOT the host seats. The app's hardcoded Render socket is
// bridged (page.routeWebSocket) to the local server, so every frame is the real server's. Asserts:
//   - both clients see the identical fragment sequence
//   - every progress frame lands on both clients within 250ms of each other
//   - the winner is the same on both
//   - a word racer A used is still allowed for racer B
//   - a rejected word names its reason (a local one and a server one)
// Timings are printed (and attached to the report) for the run log.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';

const RACE_WS = process.env.RACE_WS;
const BACKEND_DIR = process.env.RACE_BACKEND_DIR;
const BACKEND_WS_RE = /chain-reaction-backend.*onrender\.com/;

test.skip(!RACE_WS || !BACKEND_DIR, 'needs RACE_WS + RACE_BACKEND_DIR (a local backend)');

// Real words for a fragment, from the backend's own curated bot list (always dictionary-valid).
function wordSource() {
  const req = createRequire(path.resolve(BACKEND_DIR, 'package.json'));
  const bot = req('./wordBombBot.js');
  return (frag, used) => bot.pickWord(frag, new Set(used));
}

async function bridge(page) {
  await page.routeWebSocket(BACKEND_WS_RE, (ws) => {
    const up = new WebSocket(RACE_WS);
    const pending = [];
    up.addEventListener('open', () => pending.splice(0).forEach((m) => up.send(m)));
    up.addEventListener('message', (e) => ws.send(String(e.data)));
    up.addEventListener('close', () => ws.close());
    ws.onMessage((m) => (up.readyState === 1 ? up.send(m) : pending.push(m)));
    ws.onClose(() => up.close());
  });
}

async function openApp(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await bridge(page);
  await page.addInitScript(() => {
    window.__TAW_RACE_LOG__ = [];
    try {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('wa_has_played', '1');
    } catch {
      /* storage blocked */
    }
  });
  await page.goto(`/?portal=1&race=1${query || ''}`);
  return { ctx, page };
}

const log = (page) => page.evaluate(() => window.__TAW_RACE_LOG__.slice());
const lastOf = (entries, type) => entries.filter((e) => e.type === type).pop();

test('two humans + a bot race: same sequence, synced progress, same winner, per-racer words, named rejects', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const pick = wordSource();

  // --- A creates a private race room -------------------------------------------------------
  const A = await openApp(browser);
  await A.page.locator('.game-card-magnet[data-game="word-race"] .game-card').click();
  await A.page.getByRole('button', { name: 'PRIVATE ROOM' }).click();
  await A.page.getByRole('button', { name: 'CONTINUE' }).click();
  const codeEl = A.page.locator('.wr-code');
  await expect(codeEl).toBeVisible({ timeout: 15_000 });
  const code = (await codeEl.getAttribute('aria-label')).replace('Room code ', '').trim();

  // --- B joins by code (the shipped ?join= invite link) ------------------------------------
  const B = await openApp(browser, `&join=${code}`);
  await expect(A.page.locator('.wr-roster li:not(.is-open)')).toHaveCount(2, { timeout: 15_000 });

  // --- A seats a bot and starts ------------------------------------------------------------
  await A.page.getByRole('button', { name: 'ADD BOT' }).click();
  await expect(A.page.locator('.wr-roster li:not(.is-open)')).toHaveCount(3);
  await A.page.getByRole('button', { name: 'START RACE' }).click();

  await expect(A.page.locator('.wr-root[data-race-status="racing"]')).toBeVisible({ timeout: 15_000 });
  await expect(B.page.locator('.wr-root[data-race-status="racing"]')).toBeVisible({ timeout: 15_000 });

  const [la, lb] = [await log(A.page), await log(B.page)];
  const sa = lastOf(la, 'race_start');
  const sb = lastOf(lb, 'race_start');
  expect(sa.payload.fragments).toEqual(sb.payload.fragments);
  expect(sa.payload.fragments).toHaveLength(12);
  expect(sa.payload.racers.map((r) => r.isBot)).toEqual([false, false, true]);
  const frags = sa.payload.fragments;

  // --- rejects name their reason ------------------------------------------------------------
  const inputB = B.page.getByLabel('Your word');
  await inputB.fill('ab');
  await inputB.press('Enter');
  await expect(B.page.locator('.wr-toast')).toHaveAttribute('data-reason', 'too_short');
  await expect(B.page.locator('.wr-toast')).toHaveText(/TOO SHORT/);
  await inputB.fill(`zq${frags[0]}zq`);
  await inputB.press('Enter');
  await expect(B.page.locator('.wr-toast')).toHaveAttribute('data-reason', 'not_a_word', { timeout: 5000 });
  await expect(B.page.locator('.wr-toast')).toHaveText(/NOT IN THE DICTIONARY/);

  // --- A plays word 1; B plays THE SAME word (per-racer used-words) --------------------------
  const inputA = A.page.getByLabel('Your word');
  const usedA = [];
  const submitLatency = [];
  async function playA(i) {
    const w = pick(frags[i], usedA);
    usedA.push(w);
    const t0 = Date.now();
    await inputA.fill(w);
    await inputA.press('Enter');
    await expect(A.page.locator(`.wr-lane[data-racer-id="${sa.payload.racers[0].id}"]`)).toHaveAttribute(
      'data-racer-index',
      String(i + 1),
      { timeout: 5000 },
    );
    submitLatency.push(Date.now() - t0);
    return w;
  }
  const shared = await playA(0);
  await inputB.fill(shared);
  await inputB.press('Enter');
  await expect(B.page.locator('.wr-toast')).toHaveText(new RegExp(`✓ ${shared.toUpperCase()}`), { timeout: 5000 });

  // --- A races to 12 — pausing halfway until the BOT has scored, so all three lanes move ------
  const botId = sa.payload.racers[2].id;
  for (let i = 1; i < 6; i++) await playA(i);
  await expect
    .poll(async () => Number(await A.page.locator(`.wr-lane[data-racer-id="${botId}"]`).getAttribute('data-racer-index')), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(1);
  if (process.env.RACE_SHOTS) {
    await A.page.screenshot({ path: path.join(process.env.RACE_SHOTS, 'race-A-1280.png') });
    await B.page.setViewportSize({ width: 390, height: 844 });
    await B.page.screenshot({ path: path.join(process.env.RACE_SHOTS, 'race-B-390.png') });
  }
  for (let i = 6; i < 12; i++) await playA(i);

  await expect(A.page.locator('.wr-over-title')).toHaveText('YOU WIN!', { timeout: 10_000 });
  await expect(B.page.locator('.wr-over')).toBeVisible({ timeout: 10_000 });

  // --- cross-client comparisons from the arrival logs ---------------------------------------
  const [fa, fb] = [await log(A.page), await log(B.page)];
  const oa = lastOf(fa, 'race_over');
  const ob = lastOf(fb, 'race_over');
  expect(oa.payload.winnerId).toBe(sa.payload.racers[0].id);
  expect(ob.payload.winnerId).toBe(oa.payload.winnerId);

  const key = (e) => `${e.payload.racerId}#${e.payload.index}`;
  const pa = new Map(fa.filter((e) => e.type === 'race_progress').map((e) => [key(e), e.at]));
  const pb = new Map(fb.filter((e) => e.type === 'race_progress').map((e) => [key(e), e.at]));
  const deltas = [];
  for (const [k, at] of pa) {
    expect(pb.has(k), `B saw progress ${k}`).toBe(true);
    deltas.push(Math.abs(at - pb.get(k)));
  }
  const botProgress = [...pa.keys()].filter((k) => k.startsWith(sa.payload.racers[2].id)).length;
  const max = Math.max(...deltas);
  const mean = deltas.reduce((x, y) => x + y, 0) / deltas.length;
  expect(max).toBeLessThanOrEqual(250);

  const timings = {
    progressFrames: deltas.length,
    botWordsScored: botProgress,
    progressSkewMs: { max, mean: Math.round(mean * 10) / 10 },
    raceStartSkewMs: Math.abs(sa.at - sb.at),
    raceOverSkewMs: Math.abs(oa.at - ob.at),
    submitToLaneMs: {
      min: Math.min(...submitLatency),
      max: Math.max(...submitLatency),
      mean: Math.round(submitLatency.reduce((x, y) => x + y, 0) / submitLatency.length),
    },
    winner: oa.payload.winnerId === sa.payload.racers[0].id ? 'A' : 'other',
    standings: oa.payload.standings.map((s) => `${s.place}. ${s.isBot ? 'BOT' : s.name} ${s.words}w`),
  };
  if (process.env.RACE_SHOTS) {
    await A.page.screenshot({ path: path.join(process.env.RACE_SHOTS, 'over-A-1280.png') });
    await B.page.screenshot({ path: path.join(process.env.RACE_SHOTS, 'over-B-390.png') });
  }
  expect(botProgress).toBeGreaterThanOrEqual(1);
  console.log('WORD RACE LIVE TIMINGS', JSON.stringify(timings, null, 2));
  await testInfo.attach('timings.json', { body: JSON.stringify(timings, null, 2), contentType: 'application/json' });

  await A.ctx.close();
  await B.ctx.close();
});
