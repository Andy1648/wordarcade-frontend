// e2e/wb-adversarial-2.spec.js — BATCH 7: THE TIMING AND ECONOMY ATTACK, LAYER 2.
//
// wb-adversarial.spec.js already attacks the duplicated word_result, the double SEND, the
// backgrounded phone and the late game_over. This file goes one layer down, at the frames a
// real network and a real phone produce that a scripted happy path never does, and at the
// two client-only paths that by construction the server never sees: the INSTANT LOCAL
// REJECT, and the rail fit that decides how much of the board is drawn.
//
// Every till reading is READ, never inferred — readWins() pulls the actual localStorage keys.
//
// TWO ATTACKS THAT FOUND SOMETHING BUT ARE NOT GATED HERE, deliberately. Both moved the till
// and neither is reachable from the shipped backend, so a test asserting the current
// behaviour would be a test of nothing and a test asserting the fixed behaviour would be a
// speculative TIER 1 change:
//   * `word_result {accepted:true}` with NO `word` field, delivered three times, banked
//     280 + 310 + 310. The duplicate guard (App.jsx myScoredWordsRef) is keyed on the word
//     string; '' never enters the set, so the guard cannot see the repeat. gameLogic.js:498
//     returns `{ accepted: true, word, combo }` — the server cannot emit a word-less accept.
//   * a `turn_update` + accepted `word_result` delivered AFTER `game_over` banked 1260. The
//     word_result handler has no gate on the game being over. roomManager broadcasts
//     word_result -> turn_update -> game_over down one ordered socket, so the server cannot
//     emit this order either.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const ME = 'e2e-player';
const PLAYERS = [
  { id: ME, name: 'YOU', lives: 3, isHost: true },
  { id: 'p2', name: 'RIVAL', lives: 3 },
];

const readWins = (page) =>
  page.evaluate(() => {
    const num = (k) => Number(localStorage.getItem(k)) || 0;
    let wb = 0;
    try { wb = JSON.parse(localStorage.getItem('taw.rounds') || '{}').wordBomb || 0; } catch { wb = 0; }
    return { wins: num('taw.wins'), lifetime: num('taw.winsLifetime'), wb };
  });

const accept = (mock, word) =>
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word, playerId: ME } });

async function myTurn(mock, page, { combo = 'str', usedWords = [], timerSeconds = 30 } = {}) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players: PLAYERS, combo, usedWords, timerSeconds },
  });
  await page.waitForTimeout(60);
}

// The 3-2-1 overlay hides the board and disables the input. Wait for it to ATTACH, then
// DETACH — a bare wait-for-detached resolves instantly, before React has mounted it.
async function introClear(page) {
  const overlay = page.locator('.countdown-overlay');
  await overlay.waitFor({ state: 'attached', timeout: 4000 }).catch(() => {});
  await overlay.waitFor({ state: 'detached', timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(150);
}

// Walk through the 3-word banking gate so a later attack measures the ATTACK, not the gate.
async function clearGate(mock, page) {
  for (const w of ['STRAND', 'STRIDE', 'ABSTRACT']) {
    accept(mock, w);
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  // the 1/40 lucky roll off, so every figure below is exact rather than distributional
  await page.addInitScript(() => { window.__TAW_LUCKY = 'off'; });
});

// ---------------------------------------------------------------------------
// 1. THE SAME WORD, DIFFERENT SKIN: case and surrounding whitespace
//
// A retried frame does not have to be byte-identical — a proxy can re-serialise it. The
// duplicate guard normalises with trim+toLowerCase; prove all three skins collapse to ONE
// payment rather than to three words the guard thinks are different.
// ---------------------------------------------------------------------------
test('the same accepted word in three skins pays once', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  await clearGate(mock, page);
  const before = await readWins(page);

  accept(mock, 'CATALYST');
  await page.waitForTimeout(220);
  const once = await readWins(page);
  accept(mock, 'catalyst');
  await page.waitForTimeout(220);
  accept(mock, '  CaTaLySt  ');
  await page.waitForTimeout(260);
  const thrice = await readWins(page);

  expect(once.lifetime, 'the first accept banked nothing').toBeGreaterThan(before.lifetime);
  expect(thrice.lifetime - once.lifetime, 'a re-cased / re-padded retry paid again').toBe(0);
});

// ---------------------------------------------------------------------------
// 2. OUT OF ORDER: the turn_update that should have FOLLOWED the word_result arrives FIRST
//
// The documented RACE (App.jsx myOutstandingWordsRef). Fire a REAL submit, then advance the
// turn off me BEFORE delivering the accept. The accept must still be mine, and exactly once.
// ---------------------------------------------------------------------------
test('a turn_update that overtakes my word_result still pays me, exactly once', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  await introClear(page);
  await clearGate(mock, page);
  const before = await readWins(page);

  await page.locator('.game-input').fill('MINSTREL');
  await page.keyboard.press('Enter');
  await mock.waitForSent('submit_word');
  // the turn rotates to the rival BEFORE the accept lands — the pointer is now off me
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: 'p2', players: PLAYERS, combo: 'ing', usedWords: ['minstrel'], timerSeconds: 30 },
  });
  await page.waitForTimeout(120);
  accept(mock, 'MINSTREL');
  await page.waitForTimeout(300);
  const once = await readWins(page);
  expect(once.lifetime - before.lifetime, 'the overtaken accept was not attributed to me').toBeGreaterThan(0);

  // …and the same accept redelivered after the pointer moved still must not pay twice
  accept(mock, 'MINSTREL');
  await page.waitForTimeout(300);
  const twice = await readWins(page);
  expect(twice.lifetime - once.lifetime, 'the redelivered overtaken accept paid again').toBe(0);
});

// ---------------------------------------------------------------------------
// 3. A turn_update NAMING A PLAYER WHO IS NOT IN `players`
//
// A roster/turn desync. The board must not crash and must not bank the ghost's accepts.
// ---------------------------------------------------------------------------
test('a turn_update for a player absent from the roster does not crash or pay', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  await clearGate(mock, page);
  const before = await readWins(page);

  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: 'ghost-999', players: PLAYERS, combo: 'ing', usedWords: [], timerSeconds: 30 },
  });
  await page.waitForTimeout(200);
  accept(mock, 'GHOSTWRITING');
  await page.waitForTimeout(300);

  const after = await readWins(page);
  expect(after.lifetime - before.lifetime, "a ghost player's accept was banked as mine").toBe(0);
  expect(errors, `board threw: ${errors.join(' | ')}`).toHaveLength(0);
  await expect(page.locator('.game-input')).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// 4. THE FIFO DRAIN UNDER A SAME-TICK BURST
//
// CLAUDE.md: useWebSocket must buffer a FIFO QUEUE and the consumer must drain EVERY frame
// in arrival order. The regression this guards is game_started being swallowed by a
// room_update landing in the same tick — the non-host stranded on the waiting screen. Fire
// the burst with NO await between sends, BOTH orders, and prove BOTH frames were applied:
// the view is the game (game_started survived) AND the room payload survived (game_reset
// returns us to a room screen that knows its code, which only room_update could have set).
// ---------------------------------------------------------------------------
for (const order of ['started-then-room', 'room-then-started']) {
  test(`a same-tick burst (${order}) drops neither frame`, async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const roomFrame = {
      type: 'room_update',
      payload: { code: 'ZZZ99', hostId: ME, players: PLAYERS, gameType: 'word-bomb', difficultyKey: 'chill' },
    };
    const startFrame = { type: 'game_started', payload: { gameType: 'word-bomb' } };
    if (order === 'started-then-room') {
      mock.pushToClient(startFrame);
      mock.pushToClient(roomFrame);
    } else {
      mock.pushToClient(roomFrame);
      mock.pushToClient(startFrame);
    }
    await page.waitForTimeout(400);

    // game_started survived: we are on the board, not back in the waiting room.
    await expect(page.locator('.game-screen, .game-loading')).toHaveCount(1);
    await expect(page.locator('.room-screen')).toHaveCount(0);

    // room_update survived: leaving the game lands on a room screen that knows its code.
    mock.pushToClient({ type: 'game_reset', payload: {} });
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toContainText('ZZZ99');
  });
}

// ---------------------------------------------------------------------------
// 5. THE SAME-TICK BURST THE SERVER ACTUALLY EMITS
//
// roomManager.startGame() broadcasts game_started and then buildTurnUpdatePayload() with no
// await between them, so this exact pair really does arrive together. The board must come up
// on the NEW turn's fragment — a dropped turn_update strands it on "STARTING GAME...", which
// is the one screen in the app with no exit control.
// ---------------------------------------------------------------------------
test('game_started + turn_update in one burst brings up the new turn', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players: PLAYERS, combo: 'qop', usedWords: [], timerSeconds: 30 },
  });
  await page.waitForTimeout(500);
  await expect(page.locator('body')).toContainText('QOP');
});

// ---------------------------------------------------------------------------
// 6. THE LOCAL REJECT MUST COST WHAT A SERVER REJECT COSTS
//
// CLAUDE.md's INSTANT LOCAL-REJECT claims the three client-decided rejects are equivalent to
// sending. progress/combo.js's contract is "any reject/timeout resets it". Before the fix
// they were not equivalent at all: the local path never reaches App's `word_result` rejected
// branch, so the payout combo survived — the next word banked 780 after a local reject and
// 620 after a server one, and the preserved streak kept paying for the rest of the run.
// ---------------------------------------------------------------------------
async function payoutAfterMiss(browser, kind) {
  // OWN CONTEXT PER RUN. localStorage is per-ORIGIN and shared across pages, so a second
  // page in one context reads the first run's till on top of its own.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__TAW_LUCKY = 'off'; });
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  await introClear(page);
  await clearGate(mock, page);

  const sentBefore = mock.sentTypes().filter((t) => t === 'submit_word').length;
  if (kind === 'local') {
    // too_short: decided entirely from the client's own state, never sent
    await page.locator('.game-input').fill('AA');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  } else {
    // a server-judged miss of the only kind the client cannot pre-empt
    mock.pushToClient({
      type: 'word_result',
      payload: { accepted: false, reason: 'not_a_word', word: 'STRQQQ', playerId: ME },
    });
    await page.waitForTimeout(300);
  }
  const sentAfter = mock.sentTypes().filter((t) => t === 'submit_word').length;

  const before = await readWins(page);
  accept(mock, 'MINSTREL');
  await page.waitForTimeout(400);
  const after = await readWins(page);
  await ctx.close();
  return { paid: after.lifetime - before.lifetime, submits: sentAfter - sentBefore };
}

test('a local reject and a server reject cost the same on the next word', async ({ browser }) => {
  const local = await payoutAfterMiss(browser, 'local');
  const server = await payoutAfterMiss(browser, 'server');
  // the local reject really is local: nothing left the client
  expect(local.submits, 'the local reject was sent to the server after all').toBe(0);
  expect(server.paid, 'the control run banked nothing, so this proves nothing').toBeGreaterThan(0);
  expect(
    local.paid,
    `after a LOCAL reject the next word paid ${local.paid}; after a SERVER reject it paid ` +
      `${server.paid}. The three local rejects are keeping a payout combo that a server reject breaks.`,
  ).toBe(server.paid);
});

// ---------------------------------------------------------------------------
// 7. THE LOCAL REJECT MUST SHATTER THE WORD THE PLAYER JUST TYPED
//
// The reject effect shatters `lastSubmitWordRef.current` for every reject. That ref was only
// assigned AFTER the local-reject early return, so a local reject blew apart the last word
// actually SENT — accept STRAND, then type AA, and the letters that flew apart spelled
// STRAND. Read the shatter's own letters, not a screenshot.
// ---------------------------------------------------------------------------
test('a local reject shatters the word just typed, not the last one sent', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  await introClear(page);

  // a real submit first, so lastSubmitWordRef holds a DIFFERENT word
  await page.locator('.game-input').fill('STRAND');
  await page.keyboard.press('Enter');
  await mock.waitForSent('submit_word');
  accept(mock, 'STRAND');
  await page.waitForTimeout(250);

  // now a purely local reject
  await page.locator('.game-input').fill('AA');
  await page.keyboard.press('Enter');

  // The shatter removes itself on its first letter's animationend, and the e2e harness
  // collapses every animation to 1ms — so POLL for it from the moment Enter lands rather
  // than sleeping past it.
  const shattered = await page
    .waitForFunction(() => {
      const el = document.querySelector('.word-shatter');
      if (!el) return null;
      const t = el.textContent.replace(/\s+/g, '').toUpperCase();
      return t ? { t } : null;
    }, null, { timeout: 4000 })
    .then((h) => h.jsonValue())
    .then((v) => v.t)
    .catch(() => null);
  expect(shattered, 'no shatter rendered for the local reject at all').not.toBeNull();
  expect(shattered, `the local reject shattered "${shattered}"`).toBe('AA');
});

// ---------------------------------------------------------------------------
// 8. A LATE-BUT-VALID WORD MUST NOT BE CALLED INVALID
//
// gameLogic.js returns `turn_over` when the turn moved on while the awaited dictionary
// lookup was in flight — you beat the buzzer by less than the lookup took. There was no copy
// for it, so rejectionMessage()'s fallback printed INVALID WORD at a player whose word was
// fine and merely late.
// ---------------------------------------------------------------------------
test('a turn_over reject is not reported as an invalid word', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  await introClear(page);
  await page.locator('.game-input').fill('STRAND');
  await page.keyboard.press('Enter');
  await mock.waitForSent('submit_word');
  mock.pushToClient({
    type: 'word_result',
    payload: { accepted: false, reason: 'turn_over', word: 'STRAND', playerId: ME },
  });
  await page.waitForTimeout(400);
  const body = (await page.locator('.game-panel').innerText()).toUpperCase();
  expect(body, 'a valid-but-late word was reported as INVALID WORD').not.toContain('INVALID WORD');
  expect(body, 'turn_over produced no explanation at all').toContain('TOO LATE');
});

// ---------------------------------------------------------------------------
// 9. THE 3-WORD GATE ACROSS TWO GAMES
//
// Two accepted words bank nothing. A fresh game resets the accept count, so two more must
// still bank nothing. If the counter or the gate leaked across the restart, four sub-gate
// words would pay and a sub-gate run would be counted as a round.
// ---------------------------------------------------------------------------
test('two words, a restart, two more words bank nothing', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  const before = await readWins(page);
  for (const w of ['STRAND', 'STRIDE']) { accept(mock, w); await page.waitForTimeout(140); }
  await myTurn(mock, page); // a fresh game
  for (const w of ['ABSTRACT', 'MINSTREL']) { accept(mock, w); await page.waitForTimeout(140); }
  await page.waitForTimeout(400);
  const after = await readWins(page);
  expect(after.lifetime - before.lifetime, 'four sub-gate words across two games paid').toBe(0);
  expect(after.wb - before.wb, 'a sub-gate run counted as a round').toBe(0);
});

// ---------------------------------------------------------------------------
// 10. THE USED-WORDS RAIL WHEN THE FIT SAYS ZERO ROWS
//
// railFit clamps `visible.used` at 0 when the row cannot fit one whole chip. The render then
// did `usedItems.slice(-usedVisible)` — and slice(-0) is slice(0), THE WHOLE ARRAY. Measured
// before the fix, with THREE players (the 3+ rail pair, which puts the LIVE FEED card in the
// lists and squeezes the row): all 24 used words laid out inside a 22px card at 812x375, 34px
// at 844x390, 58px at 736x414. `overflow:hidden` on the list clips most of that, so the
// visible symptom is small — at 736x414 the newest chip draws as a sliced yellow stub under
// the label, which is precisely the half-drawn row wbRailFit.js exists to kill — but the
// render is wrong by 24 nodes either way, on every one of these sizes, which are phones held
// sideways. The gate is the COUNT, because that is what the fix controls; the label above
// still reports the true total, which is what makes an empty column honest rather than lossy.
// ---------------------------------------------------------------------------
const USED = Array.from({ length: 24 }, (_, i) => `usedword${i}`);
const CROWD = [...PLAYERS, { id: 'p3', name: 'THIRD', lives: 3 }];
for (const vp of [
  { w: 736, h: 414 }, // iPhone 8 Plus landscape
  { w: 812, h: 375 }, // iPhone X / 11 Pro landscape
  { w: 844, h: 390 }, // iPhone 12 / 13 landscape
  { w: 896, h: 414 }, // iPhone 11 Pro Max landscape
  { w: 1280, h: 720 }, // a desktop control: this one DOES fit rows, and must still trim
]) {
  test(`the used-words card draws only what fits at ${vp.w}x${vp.h}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    // the one-time first-game spotlight dims the board behind its caption
    await page.addInitScript(() => {
      try { localStorage.setItem('taw.seenGameSpotlight', '1'); } catch { /* blocked */ }
    });
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(80);
    mock.pushToClient({
      type: 'turn_update',
      payload: { currentPlayerId: ME, players: CROWD, combo: 'str', usedWords: USED, timerSeconds: 30 },
    });
    await introClear(page);
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const card = document.querySelector('.game-used');
      const list = document.querySelector('.game-used-list');
      if (!card || !list) return null;
      return {
        chips: document.querySelectorAll('.game-used-chip').length,
        room: list.clientHeight,
      };
    });
    expect(m, 'no used-words card rendered at all').not.toBeNull();
    expect(
      m.chips,
      `drew ${m.chips} of ${USED.length} used words into a list ${m.room}px tall`,
    ).toBeLessThan(USED.length);
    // A list with no room at all must draw NO chips, not a sliced stub of the newest one.
    if (m.room <= 4) {
      expect(m.chips, `${m.chips} chips in a ${m.room}px list`).toBe(0);
    }
  });
}
