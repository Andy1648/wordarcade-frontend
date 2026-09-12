// e2e/wb-adversarial.spec.js — ATTACK THE BOARD'S TIMING AND ITS TILL.
//
// word-bomb-scoring.spec.js proves the happy path pays and that leaving mid-game does not
// double-pay. This file attacks the edges around it: the frames a real network and a real
// phone produce that a scripted happy path never does. Everything here is driven over the
// mock socket, so a "duplicate frame" is a duplicate frame, not a flaky retry.
//
// Every test states the ATTACK, then what it would look like if the board lost.
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
    let xp = { lv: 1, into: 0 };
    try { xp = JSON.parse(localStorage.getItem('taw.xp') || '{}') || xp; } catch { /* fresh */ }
    return { wins: num('taw.wins'), lifetime: num('taw.winsLifetime'), wb, lv: xp.lv || 1, into: xp.into || 0 };
  });

async function myTurn(mock, page, { combo = 'at', usedWords = [] } = {}) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players: PLAYERS, combo, usedWords, timerSeconds: 30 },
  });
  await page.waitForTimeout(60);
}

test.beforeEach(async ({ page }) => {
  // the 1/40 lucky roll off, so every figure below is exact rather than distributional
  await page.addInitScript(() => { window.__TAW_LUCKY = 'off'; });
});

// ---------------------------------------------------------------------------
// 1. THE SAME word_result TWICE — a socket retry, or a server that re-broadcasts
// ---------------------------------------------------------------------------
test('a duplicated word_result pays once, not twice', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page);
  // CLEAR THE PAYOUT GATE FIRST. A run banks nothing until MIN_WORDS (3) accepted words —
  // the first cut of this test duplicated word one and then asserted the till had moved,
  // which it correctly had not. Attacking a gate you have not walked through measures the
  // gate, not the attack.
  for (const w of ['STRAND', 'STRIDE']) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w, playerId: ME } });
    await page.waitForTimeout(140);
  }
  const before = await readWins(page);

  const frame = { type: 'word_result', payload: { accepted: true, word: 'CATALYST', playerId: ME } };
  mock.pushToClient(frame);
  await page.waitForTimeout(200);
  const once = await readWins(page);
  // the identical frame again, as a retry would deliver it
  mock.pushToClient(frame);
  await page.waitForTimeout(260);
  const twice = await readWins(page);

  expect(once.lifetime, 'the first accept banked nothing at all').toBeGreaterThan(before.lifetime);
  expect(twice.lifetime - once.lifetime, 'the duplicate frame paid a second time').toBe(0);
  expect(twice.into >= once.into ? twice.into - once.into : 0, 'the duplicate frame granted XP again').toBe(0);
});

// ---------------------------------------------------------------------------
// 2. DOUBLE SUBMIT — SEND twice inside one frame, and Enter held down
// ---------------------------------------------------------------------------
test('SEND pressed twice in one frame sends one word', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page, { combo: 'str' });
  await page.waitForTimeout(4800); // clear the 3-2-1-GO! intro so the input is live

  const field = page.locator('.game-input');
  await field.fill('STRAND');
  const before0 = mock.sentTypes().length;
  // two clicks with no await between them: the same tick, as a double-tap delivers
  await Promise.all([
    page.locator('.game-send-btn, button:has-text("SEND")').first().click(),
    page.locator('.game-send-btn, button:has-text("SEND")').first().click().catch(() => {}),
  ]);
  await page.waitForTimeout(300);
  const submits = mock.sentTypes().slice(before0).filter((t) => /submit|word/i.test(t || ''));
  expect(submits.length, `sent ${submits.length} submits: ${submits.join(',')}`)
    .toBeLessThanOrEqual(1);
});

test('Enter held down (keyboard autorepeat) sends one word', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page, { combo: 'str' });
  await page.waitForTimeout(4800);
  await page.locator('.game-input').fill('STRAND');
  const before0 = mock.sentTypes().length;
  // autorepeat: several keydowns, one keyup
  for (let i = 0; i < 4; i++) await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await page.waitForTimeout(300);
  const submits = mock.sentTypes().slice(before0).filter((t) => /submit|word/i.test(t || ''));
  expect(submits.length, `autorepeat sent ${submits.length} submits`).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// 3. BACKGROUNDING AND RETURNING — the phone in a pocket
// ---------------------------------------------------------------------------
test('backgrounding and returning does not double-credit or freeze the board', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page, { combo: 'str' });
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'STRAND', playerId: ME } });
  await page.waitForTimeout(200);
  const before = await readWins(page);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(500);

  const after = await readWins(page);
  expect(after.lifetime - before.lifetime, 'coming back to the tab re-banked the last word').toBe(0);
  // and the board is still a board: the clock still ticks and the field still takes a word
  mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: 12 } });
  await page.waitForTimeout(200);
  await expect(page.locator('.bomb-num')).toHaveText('12');
  await expect(page.locator('.game-input')).toBeEnabled();
});

// ---------------------------------------------------------------------------
// 4. LEAVE-FORFEIT then a late game_over — the frame that arrives after you left
// ---------------------------------------------------------------------------
test('a game_over arriving AFTER leaving pays nothing extra', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page, { combo: 'str' });
  for (const w of ['STRAND', 'STRIDE', 'ABSTRACT']) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w, playerId: ME } });
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(300);

  // leave, and let the menu SETTLE before the snapshot. Landing on the menu re-evaluates
  // achievements and can legitimately grant wins for one newly earned — the first cut of
  // this test snapshotted before that and read the achievement as a double-pay.
  const leave = page.locator('button:has-text("LEAVE")').first();
  if (await leave.count()) await leave.click();
  await page.waitForTimeout(900);
  const banked = await readWins(page);
  const viewBefore = await page.evaluate(() => !!document.querySelector('.menu-xp-bar'));

  // now the server's game_over lands late — it does not know we left yet
  mock.pushToClient({ type: 'game_over', payload: { winnerId: 'p2', players: PLAYERS } });
  await page.waitForTimeout(900);

  const after = await readWins(page);
  expect(after.lifetime - banked.lifetime, 'a late game_over paid a second time after leaving').toBe(0);
  expect(after.wb - banked.wb, 'a late game_over counted a second round').toBe(0);

  // AND IT MUST NOT DRAG YOU BACK IN. The handler ends with an unconditional setView('game'),
  // so a frame for a game you already walked away from can put a game-over screen in front of
  // you on the menu.
  expect(viewBefore, 'LEAVE did not reach the menu, so this proves nothing').toBe(true);
  const onMenu = await page.evaluate(() => !!document.querySelector('.menu-xp-bar'));
  expect(onMenu, 'a late game_over pulled the player back out of the menu').toBe(true);
});

// ---------------------------------------------------------------------------
// 5. SEEDED REPLAY — the same frames twice must produce the same till
// ---------------------------------------------------------------------------
test('the same run driven twice pays exactly the same', async ({ browser }) => {
  // A SECOND PAGE IN THE SAME CONTEXT IS NOT A REPLAY. localStorage is per-ORIGIN and shared
  // across pages, so the first cut of this test read the second run's till on top of the
  // first's (5,320 against 2,610) and called the difference non-determinism. Each run gets
  // its own context, and the assertion is on the DELTA the run itself banked.
  const run = async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.addInitScript(() => { window.__TAW_LUCKY = 'off'; });
    const mock = await installBackendMock(p);
    await gotoMenu(p);
    await myTurn(mock, p, { combo: 'str' });
    const start = await readWins(p);
    for (const w of ['STRAND', 'MINSTREL', 'STRIDE', 'ABSTRACT', 'STRATUM']) {
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w, playerId: ME } });
      await p.waitForTimeout(130);
    }
    await p.waitForTimeout(400);
    const end = await readWins(p);
    await ctx.close();
    return end.lifetime - start.lifetime;
  };
  const a = await run();
  const b = await run();
  expect(b, `replay banked ${b}, first run banked ${a}`).toBe(a);
  expect(a, 'the run banked nothing, so this proves nothing').toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 6. A REJECT MUST NEVER PAY — including one for a word the client already accepted
// ---------------------------------------------------------------------------
test('a server reject after a local accept of the same word pays nothing', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  await myTurn(mock, page, { combo: 'str' });
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'STRAND', playerId: ME } });
  await page.waitForTimeout(200);
  const paid = await readWins(page);
  mock.pushToClient({ type: 'word_result', payload: { accepted: false, reason: 'not_a_word', word: 'STRAND', playerId: ME } });
  await page.waitForTimeout(300);
  const after = await readWins(page);
  expect(after.lifetime, 'a rejection changed the till').toBe(paid.lifetime);
});
