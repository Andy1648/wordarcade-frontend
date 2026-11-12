// e2e-live/word-bomb-spectate-live.spec.js — SPECTATORS NEVER GET THE 3-2-1 (Andy nov12: "spectating a word bomb game
// gives that countdown as well its stupid since ur only spectating"), against a REAL local backend (Tier 1).
//
// Run (see playwright.wb-live.config.js):
//   chain-reaction-backend:  PORT=3101 node server.js
//   frontend:                WB_WS=ws://127.0.0.1:3101 WB_BACKEND_DIR=../chain-reaction-backend \
//                              npx playwright test -c playwright.wb-live.config.js e2e-live/word-bomb-spectate-live.spec.js
//
// Two browser contexts. A host starts a game with a bot; a second context arrives AFTER the host's countdown, and a
// MutationObserver installed before the app boots records whether a .countdown-overlay EVER mounted on its page:
//   1. Word Bomb, JOIN BY CODE mid-round (game_started.spectator → "DEALT IN NEXT TURN"): board, no countdown; then
//      the next turn deals it in - still no countdown - and its first turn takes a real word, input live at once.
//   2. Word Bomb, SPECTATE from the menu's room list (watchOnly): board, no countdown, no input.
//   3. Category Blitz, SPECTATE (Blitz refuses a mid-round code-join server-side): board, no countdown, no input.
// The host's own countdown is asserted to have played (the control). 0 console errors on any page.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { menuReady, revealMode } from '../e2e/support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

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
  let vercel404 = 0; // a local preview has no /_vercel/insights - that 404 is the harness, not the app
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (/\/_vercel\//.test(r.url())) vercel404 += 1;
    else errors.push(`http ${r.status()}: ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // a REPORT-ONLY CSP note about a third-party (google.com) frame is logged, never enforced - not an app error
    if (/report-only Content Security Policy/.test(m.text()) && /google\.com/.test(m.text())) return;
    if (/Failed to load resource: the server responded with a status of 404/.test(m.text()) && vercel404 > 0) { vercel404 -= 1; return; }
    errors.push(`console: ${m.text()}`);
  });
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => {
      try { frames.push({ at: Date.now(), m: JSON.parse(String(f.payload)) }); } catch { /* binary */ }
    });
  });
  await page.addInitScript(({ name, patchId }) => {
    // "was a countdown EVER rendered on this page" - an observer from the first paint, not a point-in-time check
    window.__countdownSeen = 0;
    const watch = () => {
      new MutationObserver(() => {
        if (document.querySelector('.countdown-overlay')) window.__countdownSeen += 1;
      }).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);
    if (sessionStorage.getItem('live.seeded')) return;
    sessionStorage.setItem('live.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems']) localStorage.setItem(k, '1');
    localStorage.setItem('taw.reveal', 'all');
    localStorage.setItem('wa_has_played', '1');
    localStorage.setItem('wa_playername', name);
    localStorage.setItem('taw.seen.patch', patchId); // the patch-notes modal would sit over the menu's mode cards
  }, { name, patchId: PATCH_ID });
  await page.goto(`/?portal=1&season2=1${query}`);
  return { ctx, page, errors, frames };
}

const seen = (c) => c.page.evaluate(() => window.__countdownSeen);
const lastFrame = (c, type) => [...c.frames].reverse().find((f) => f.m.type === type);

/** A hosts a room of `mode` (+ one bot) and starts it; returns the code once A's own countdown has played and gone. */
async function hostAndStart(A, mode, { isPublic = false } = {}) {
  await menuReady(A.page);
  await (await revealMode(A.page, mode)).click();
  await A.page.locator('.mode-dialog-btn-create:visible').first().click();
  if (isPublic) await A.page.getByRole('button', { name: /PUBLIC/ }).click();
  await A.page.getByRole('button', { name: 'CONTINUE' }).click();
  const codeEl = A.page.locator('.room-code');
  await expect(codeEl).toBeVisible({ timeout: 20_000 });
  const code = (await codeEl.getAttribute('aria-label')).replace('Room code ', '').trim();
  await A.page.locator('.room-addbot-btn').click();
  await A.page.locator('.room-addbot-diff').first().click();
  await expect.poll(() => (lastFrame(A, 'room_update')?.m.payload.players || []).length, { timeout: 15_000 }).toBe(2);
  await A.page.locator('.room-start-btn').click();
  await expect(A.page.locator('.room-wrap')).toHaveCount(0, { timeout: 20_000 });
  // the control: the HOST (a player) does get its 3-2-1 ...
  await expect.poll(() => seen(A), { timeout: 10_000 }).toBeGreaterThan(0);
  // ... and it is over before anyone arrives (the joiner lands on a round that is already running)
  await expect(A.page.locator('.countdown-overlay')).toHaveCount(0, { timeout: 10_000 });
  return code;
}

test('Word Bomb: a code-joiner mid-round watches with NO countdown, is dealt in with NO countdown, and plays at once', async ({ browser }) => {
  test.setTimeout(240_000);
  const pick = wordSource();
  const A = await open(browser, 'ALPHA');
  const code = await hostAndStart(A, 'word-bomb');
  await expect.poll(() => !!lastFrame(A, 'turn_update'), { timeout: 15_000 }).toBe(true);

  // B joins BY CODE mid-round: the server answers game_started { spectator: true } + the live turn
  const B = await open(browser, 'BRAVO', `&join=${code}`);
  const cont = B.page.getByRole('button', { name: 'CONTINUE' });
  await Promise.race([B.page.locator('.game-wrap').waitFor({ timeout: 20_000 }), cont.waitFor({ timeout: 20_000 }).then(() => cont.click())]).catch(() => {});
  await expect(B.page.locator('.game-stage--wb')).toBeVisible({ timeout: 20_000 });
  expect(B.frames.some((f) => f.m.type === 'game_started' && f.m.payload.spectator === true), 'the server marked the join live').toBe(true);
  await expect(B.page.locator('.game-spectating')).toContainText('DEALT IN NEXT TURN');
  await expect(B.page.locator('.wb-top')).toContainText(/[A-Z]{2,}/); // the live prompt is on the board
  await B.page.waitForTimeout(3500); // longer than a full 3-2-1-GO! - it would have mounted by now
  expect(await seen(B), 'a spectator never sees the 3-2-1').toBe(0);

  const bId = (lastFrame(A, 'room_update').m.payload.players.find((p) => p.name === 'BRAVO') || {}).id;
  const aId = (lastFrame(A, 'room_update').m.payload.players.find((p) => p.name === 'ALPHA') || {}).id;
  const used = [];
  // the humans answer their turns until B has been dealt in AND played one turn (the bot plays itself)
  let bPlayed = false;
  let handled = -1;
  const turns = () => A.frames.filter((f) => f.m.type === 'turn_update');
  const deadline = Date.now() + 120_000;
  while (!bPlayed && Date.now() < deadline) {
    await expect.poll(() => turns().length - 1 > handled, { timeout: 40_000 }).toBe(true);
    handled = turns().length - 1;
    const t = turns()[handled];
    const cur = t.m.payload.currentPlayerId;
    if (cur !== aId && cur !== bId) continue;
    const who = cur === aId ? A : B;
    if (cur === bId) {
      await expect(B.page.locator('.game-spectating'), 'dealt in: the watching bar is gone').toHaveCount(0);
    }
    const word = pick(t.m.payload.combo, [...used, ...(t.m.payload.usedWords || [])]);
    used.push(word);
    const input = who.page.locator('.game-input');
    if (cur === aId) {
      // A sat idle through B's arrival: this turn may already have timed out under us - then take the next one
      await expect.poll(async () => (await input.isEnabled()) || turns().length - 1 > handled, { timeout: 8000 }).toBe(true);
      if (!(await input.isEnabled())) continue;
    } else {
      // B: input is live the moment its turn arrives - no countdown gate in front of a dealt-in player
      await expect(input).toBeEnabled({ timeout: 3000 });
    }
    await input.fill(word);
    await input.press('Enter');
    await expect.poll(() => who.frames.some((f) => f.m.type === 'word_result' && f.m.payload.accepted && String(f.m.payload.word).toLowerCase() === word.toLowerCase()), { timeout: 8000 }).toBe(true);
    if (cur === bId) bPlayed = true;
  }
  expect(bPlayed, 'B was dealt in and played a turn').toBe(true);
  expect(await seen(B), 'being dealt in never replays the 3-2-1').toBe(0);

  expect(A.errors, A.errors.join('\n')).toEqual([]);
  expect(B.errors, B.errors.join('\n')).toEqual([]);
  await A.ctx.close();
  await B.ctx.close();
});

for (const mode of ['word-bomb', 'category-blitz']) {
  test(`${mode}: SPECTATE from the room list lands on the live board with NO countdown ever rendered`, async ({ browser }) => {
    test.setTimeout(240_000);
    const A = await open(browser, 'HOSTY');
    const code = await hostAndStart(A, mode, { isPublic: true });

    const V = await open(browser, 'VIEWY');
    await menuReady(V.page);
    const row = V.page.locator(`.mr-row[data-code="${code}"]`);
    await expect(row.getByTestId('menu-room-status')).toHaveText('PLAYING', { timeout: 30_000 });
    await row.locator('.mr-join').click();
    await expect(V.page.getByTestId('watch-bar')).toBeInViewport({ timeout: 20_000 });
    expect(V.frames.some((f) => f.m.type === 'game_started' && f.m.payload.watchOnly === true)).toBe(true);
    await expect(V.page.locator('.game-input')).toHaveCount(0);
    if (mode === 'word-bomb') await expect(V.page.locator('.wb-top')).toContainText(/[A-Z]{2,}/);
    else await expect(V.page.locator('.cb-category-display')).toContainText(/[A-Z]{3,}/, { timeout: 5000 });
    await V.page.waitForTimeout(3500);
    expect(await seen(V), 'a watcher never sees the 3-2-1').toBe(0);

    await V.page.locator('.game-leave-btn').first().click();
    await menuReady(V.page);
    expect(A.errors, A.errors.join('\n')).toEqual([]);
    expect(V.errors, V.errors.join('\n')).toEqual([]);
    await A.ctx.close();
    await V.ctx.close();
  });
}
