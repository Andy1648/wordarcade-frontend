// e2e-live/word-bomb-learn-live.spec.js — WORD BOMB against a REAL local backend (P9c, Tier 1): PAUSE TO LEARN.
//
// Run (see playwright.wb-live.config.js):
//   chain-reaction-backend:  PORT=3101 node server.js
//   frontend:                WB_WS=ws://127.0.0.1:3101 WB_BACKEND_DIR=../chain-reaction-backend \
//                              npx playwright test -c playwright.wb-live.config.js
//
// Two HUMANS in two browser contexts (A hosts, B joins BY CODE) + one BOT. Season-2 HUD on (?season2=1). Asserts:
//   - both enter the game (no freeze, nobody kicked back to the room);
//   - human turns play real words (from the backend's own bot list) and are accepted; the turn passes;
//   - A lets the bomb run out: A loses a life, A sees "NEXT TIME: <a word containing the fragment>", B does not;
//   - the server HOLDS the bomb (the post-timeout turn_update carries learnPauseMs, and no timer_tick arrives for
//     ~2 s), then the next turn's clock runs and the turn has passed to the next seat;
//   - 0 console errors on either page.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { menuReady, modeEntry } from '../e2e/support/menu.js';

const WB_WS = process.env.WB_WS;
const BACKEND_DIR = process.env.WB_BACKEND_DIR;
test.skip(!WB_WS || !BACKEND_DIR, 'needs WB_WS + WB_BACKEND_DIR (a local backend)');

function wordSource() {
  const req = createRequire(path.resolve(BACKEND_DIR, 'package.json'));
  const bot = req('./wordBombBot.js');
  return (frag, used) => bot.pickWord(frag, new Set(used));
}

async function open(browser, name, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 657 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  const frames = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // A local preview has no /_vercel/insights (Vercel serves it on a deploy): that one 404 — and the console line the
  // browser prints for it — is the harness, not the app. Every other error (or 404) counts.
  let vercel404 = 0;
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (/\/_vercel\//.test(r.url())) vercel404 += 1;
    else errors.push(`http ${r.status()}: ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of 404/.test(m.text()) && vercel404 > 0) { vercel404 -= 1; return; }
    errors.push(`console: ${m.text()}`);
  });
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => {
      try { frames.push({ at: Date.now(), m: JSON.parse(String(f.payload)) }); } catch { /* binary */ }
    });
  });
  await page.addInitScript((name) => {
    if (sessionStorage.getItem('live.seeded')) return;
    sessionStorage.setItem('live.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    localStorage.setItem('wa_has_played', '1');
    localStorage.setItem('wa_playername', name);
  }, name);
  await page.goto(`/?portal=1&season2=1${query}`);
  return { ctx, page, errors, frames };
}

const lastTurn = (c) => [...c.frames].reverse().find((f) => f.m.type === 'turn_update');

test('2 humans + a bot: play turns, A blows up → NEXT TIME card on A only, the bomb holds ~2 s, the turn passes, 0 errors', async ({ browser }, testInfo) => {
  const pick = wordSource();
  const used = [];
  const report = { turnsPlayed: [], blowUp: null };

  // --- A creates a Word Bomb room ----------------------------------------------------------
  const A = await open(browser, 'ALPHA');
  await menuReady(A.page);
  await modeEntry(A.page, 'word-bomb').click();
  await A.page.locator('.mode-dialog-btn-create').click();
  await A.page.getByRole('button', { name: 'CONTINUE' }).click(); // the name + PRIVATE step
  const codeEl = A.page.locator('.room-code');
  await expect(codeEl).toBeVisible({ timeout: 20_000 });
  const code = (await codeEl.getAttribute('aria-label')).replace('Room code ', '').trim();

  // --- A seats a bot (the server allows one only while A is the lone human) -------------------
  await A.page.locator('.room-addbot-btn').click();
  await A.page.locator('.room-addbot-diff').first().click();
  await expect.poll(() => (lastFrame(A, 'room_update')?.m.payload.players || []).length, { timeout: 15_000 }).toBe(2);

  // --- B joins BY CODE ---------------------------------------------------------------------
  const B = await open(browser, 'BRAVO', `&join=${code}`);
  const cont = B.page.getByRole('button', { name: 'CONTINUE' });
  await Promise.race([B.page.locator('.room-code').waitFor({ timeout: 20_000 }), cont.waitFor({ timeout: 20_000 }).then(() => cont.click())]).catch(() => {});
  await expect(B.page.locator('.room-code')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => (lastFrame(A, 'room_update')?.m.payload.players || []).length, { timeout: 15_000 }).toBe(3);

  await A.page.locator('.room-start-btn').click();

  // --- both enter the game -----------------------------------------------------------------
  await expect(A.page.locator('.game-stage--wb[data-hud="v2"]')).toBeVisible({ timeout: 20_000 });
  await expect(B.page.locator('.game-stage--wb[data-hud="v2"]')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => !!lastTurn(A), { timeout: 15_000 }).toBe(true);
  const ids = lastTurn(A).m.payload.players.map((p) => p.id);
  const roster = lastFrame(A, 'room_update').m.payload.players;
  const idOf = (name) => roster.find((p) => p.name === name).id;
  const aId = idOf('ALPHA');
  const bId = idOf('BRAVO');
  expect(ids).toContain(aId);
  expect(ids).toContain(bId);

  // --- play: every human turn answers, until each human has played twice -------------------
  // `handled` = the index of the last turn_update acted on; each NEW one is answered (humans) or skipped (bot).
  const played = { [aId]: 0, [bId]: 0 };
  let handled = -1;
  const turns = () => A.frames.filter((f) => f.m.type === 'turn_update');
  async function nextTurn() {
    await expect.poll(() => turns().length - 1 > handled, { timeout: 40_000 }).toBe(true);
    handled = turns().length - 1;
    return turns()[handled];
  }
  async function answer(t) {
    const cur = t.m.payload.currentPlayerId;
    const who = cur === aId ? A : B;
    const combo = t.m.payload.combo;
    const word = pick(combo, [...used, ...(t.m.payload.usedWords || [])]);
    used.push(word);
    const input = who.page.locator('.game-input');
    await expect(input).toBeEnabled({ timeout: 8000 });
    await input.fill(word);
    await input.press('Enter');
    try {
      await expect.poll(() => who.frames.some((f) => f.m.type === 'word_result' && f.m.payload.accepted && String(f.m.payload.word).toLowerCase() === word.toLowerCase()), { timeout: 8000 }).toBe(true);
    } catch (e) {
      console.log('DIAG', word, combo, JSON.stringify(who.frames.slice(-8).map((f) => f.m)), await input.inputValue(), await input.isEnabled());
      throw e;
    }
    played[cur] += 1;
    report.turnsPlayed.push({ who: cur === aId ? 'A' : 'B', combo, word });
  }
  const deadline = Date.now() + 90_000;
  while ((played[aId] < 2 || played[bId] < 2) && Date.now() < deadline) {
    const t = await nextTurn();
    const cur = t.m.payload.currentPlayerId;
    if (cur === aId || cur === bId) await answer(t);
  }
  expect(played[aId]).toBeGreaterThanOrEqual(2);
  expect(played[bId]).toBeGreaterThanOrEqual(2);

  // --- A's turn: let it blow up (B keeps answering until it is A's turn) ----------------------
  let t = turns()[turns().length - 1];
  handled = turns().length - 1;
  while (t.m.payload.currentPlayerId !== aId) {
    if (t.m.payload.currentPlayerId === bId) await answer(t);
    t = await nextTurn();
  }
  const failedCombo = t.m.payload.combo;
  const livesBefore = t.m.payload.players.find((p) => p.id === aId).lives;
  const nFrames = A.frames.length;
  // wait for the timeout (chill: ~15 s)
  await expect.poll(() => A.frames.slice(nFrames).some((f) => f.m.type === 'turn_timeout'), { timeout: 30_000 }).toBe(true);
  const iTo = A.frames.findIndex((f, i) => i >= nFrames && f.m.type === 'turn_timeout');
  const post = A.frames.slice(iTo).find((f) => f.m.type === 'turn_update');
  expect(post.m.payload.learnPauseMs, 'the server holds the bomb').toBe(2000);
  expect(post.m.payload.players.find((p) => p.id === aId).lives).toBe(livesBefore - 1);
  expect(post.m.payload.currentPlayerId, 'the turn passes').not.toBe(aId);

  // A sees the PAUSE-TO-LEARN card with a real word for the fragment it missed; B does not
  const card = A.page.locator('.wb-learn');
  await expect(card).toBeVisible({ timeout: 2000 });
  const shown = Date.now();
  const word = (await card.getAttribute('data-word')) || '';
  expect(word).toContain(String(failedCombo).toUpperCase());
  await expect(B.page.locator('.wb-learn')).toHaveCount(0);
  if (process.env.WB_SHOTS) {
    await A.page.screenshot({ path: path.join(process.env.WB_SHOTS, 'live-A-learn-1366.png') });
    await B.page.screenshot({ path: path.join(process.env.WB_SHOTS, 'live-B-1366.png') });
  }
  // the hold: no timer_tick for ~2 s after the post-timeout turn_update, then the clock runs
  await expect(card).toHaveCount(0, { timeout: 3500 });
  const goneAfter = Date.now() - shown;
  const firstTick = A.frames.find((f) => f.at > post.at && f.m.type === 'timer_tick');
  await expect.poll(() => A.frames.some((f) => f.at > post.at && f.m.type === 'timer_tick'), { timeout: 8000 }).toBe(true);
  const tick = firstTick || A.frames.find((f) => f.at > post.at && f.m.type === 'timer_tick');
  const holdMs = tick.at - post.at;
  expect(holdMs, 'first tick ~1 s after the 2 s hold').toBeGreaterThanOrEqual(2500);
  report.blowUp = { failedCombo, nextTimeWord: word, cardMs: goneAfter, firstTickAfterMs: holdMs, turnPassedTo: post.m.payload.currentPlayerId === bId ? 'B' : 'BOT' };

  // --- zero console errors ----------------------------------------------------------------------
  expect(A.errors, A.errors.join('\n')).toEqual([]);
  expect(B.errors, B.errors.join('\n')).toEqual([]);
  console.log('WORD BOMB LIVE PLAY-TEST', JSON.stringify(report, null, 2));
  await testInfo.attach('playtest.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  await A.ctx.close();
  await B.ctx.close();

  function lastFrame(c, type) { return [...c.frames].reverse().find((f) => f.m.type === type); }
});
