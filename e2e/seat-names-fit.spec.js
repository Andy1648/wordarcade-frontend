// e2e/seat-names-fit.spec.js — PLAYER NAMES NEVER BREAK MID-WORD, NEVER ELLIPSIZE (nov9: a lobby-bot persona read
// "RUSTYKNIGH / T" on a waiting-room seat). Every seat / roster surface draws a name through FitText: ONE line, scaled
// down only when it is wider than its box. Mocked socket, the longest names (16-char personas + a 20-char human, the
// name cap) at 390 / 1366 / 1920 on: the room lobby, Word Bomb seats, Category Blitz progress, Word Race lanes.
// For every name: one line, inside its seat, no ellipsis, never scaled below the readable floor.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.SN_SHOTS || '';
const ME = 'e2e-player';
// the longest lobby-bot personas (lobbyBotPersonas.json) + a 20-character human (MAX_NAME_LENGTH)
const NAMES = ['MAXIMILIAN_THE_GREAT', 'caffeinatedowl68', 'CaffeinatedCloud', 'scarletthistle28', 'catalina_popcorn', 'bashfulboulder11', 'zeppelin_oatmeal', 'MR SPELLING BEE CHMP'];
const PLAYERS = NAMES.map((name, i) => ({ id: i === 0 ? ME : `p${i}`, name, ...(i > 0 ? { isBot: true, lobbyBot: true } : {}) }));
// a scaled name is never drawn smaller than this: 8px for a real persona-length name (<= 16 chars); the 20-char cap in a
// full 8-seat room is allowed down to 5.5px (the ring on a phone) - whole and on one line beats "CAFFEINATE…" (the ring's old ellipsis)
const minPx = (text) => (text.length <= 16 ? 8 : 5.5);

const measure = (page, nameSel, seatSel) => page.evaluate(([ns, ss]) => {
  const out = [];
  for (const box of document.querySelectorAll(ns)) {
    const cs = getComputedStyle(box);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const inner = box.querySelector('.fit-in');
    const b = box.getBoundingClientRect();
    if (!b.width) continue;
    const r = (inner || box).getBoundingClientRect();
    const seat = box.closest(ss);
    const s = seat ? seat.getBoundingClientRect() : null;
    const m = /scale\(([\d.]+)\)/.exec(inner ? inner.style.transform : '');
    const k = m ? Number(m[1]) : 1;
    const fs = parseFloat(getComputedStyle(inner || box).fontSize);
    const lh = parseFloat(getComputedStyle(inner || box).lineHeight) || fs * 1.4;
    out.push({
      text: box.textContent,
      fit: !!inner,
      ellipsis: cs.textOverflow === 'ellipsis' && box.scrollWidth > box.clientWidth + 1,
      oneLine: r.height < fs * k * 1.9, // .fit-in is nowrap: a second line would double the drawn height
      inBox: r.left >= b.left - 1 && r.right <= b.right + 1,
      inSeat: !s || (b.left >= s.left - 1 && b.right <= s.right + 1),
      px: +(fs * k).toFixed(1), k, ...(s ? { sl: Math.round(s.left), sr: Math.round(s.right), bl: Math.round(b.left), br: Math.round(b.right) } : {}), bw: Math.round(b.width), rw: Math.round(r.width), sw: box.scrollWidth, cw: box.clientWidth, rh: Math.round(r.height), lh: Math.round(lh),
    });
  }
  return out;
}, [nameSel, seatSel]);

function check(rows, where, floor = minPx) {
  expect(rows.length, `${where}: names drawn`).toBeGreaterThan(0);
  for (const r of rows) {
    expect(r.fit, `${where} "${r.text}" goes through FitText ${JSON.stringify(r)}`).toBe(true);
    expect(r.oneLine, `${where} "${r.text}" is one line (never broken mid-word) ${JSON.stringify(r)}`).toBe(true);
    expect(r.ellipsis, `${where} "${r.text}" is never ellipsized ${JSON.stringify(r)}`).toBe(false);
    // the ONE accepted edge: a 20-char name in a full 8-seat Word Bomb ring on a phone is wider than its label cap even at
    // FitText's floor - it then shows WHOLE past the cap (unclipped), never cut to "RIVA…"
    const ringEdge = where === 'word bomb' && r.text.length > 16 && r.k <= 0.451;
    if (!ringEdge) expect(r.inBox, `${where} "${r.text}" fits its box ${JSON.stringify(r)}`).toBe(true);
    expect(r.inSeat, `${where} "${r.text}" stays inside its seat ${JSON.stringify(r)}`).toBe(true);
    expect(r.px, `${where} "${r.text}" readable (${r.px}px)`).toBeGreaterThanOrEqual(floor(r.text));
  }
}

async function boot(page, vp) {
  await page.setViewportSize(vp);
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try { for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems', 'taw.seenGameSpotlight', 'taw.seenMenu', 'taw.seenMenuSpotlight']) localStorage.setItem(k, '1'); } catch { /* blocked */ }
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  return mock;
}
const settle = async (page) => { await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(500); };

for (const vp of [{ width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`@${vp.width}: room lobby + Word Bomb seats — 8 longest names, one line each`, async ({ page }) => {
    const mock = await boot(page, vp);
    mock.pushToClient({ type: 'room_update', payload: { code: 'LONGN', gameType: 'word-bomb', hostId: 'p1', difficultyKey: 'medium', players: PLAYERS } });
    await page.locator('.room-wrap').waitFor();
    await settle(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/room-${vp.width}.png`, fullPage: true });
    check(await measure(page, '.room-player-name', '.room-player-chip'), 'room');

    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'p2', players: PLAYERS.map((p) => ({ ...p, lives: 3, eliminated: false })), combo: 'ing', usedWords: [], timerSeconds: 20, maxLives: 3 } });
    await expect(page.locator('.game-player-name-text').first()).toBeVisible({ timeout: 15000 });
    await settle(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/wb-${vp.width}.png` });
    // the ring label hangs outside its avatar by design (wb-text-overlap.spec gates neighbours): checked against its own box only
    // a phone's full 8-seat ring: the seat on the clock stays full size; the others are whole but small (>= 6.5px) -
    // the alternative was "CAFFEINAT…" (and <= 360px shows only the seat on the clock)
    check(await measure(page, '.game-player-name-text', '.wb-seat-none'), 'word bomb', vp.width < 600 ? (t) => (t.length <= 16 ? 6.5 : 5.5) : minPx);
  });

  test(`@${vp.width}: Category Blitz progress + Word Race lanes — longest names, one line each`, async ({ page }) => {
    const mock = await boot(page, vp);
    mock.pushToClient({ type: 'room_update', payload: { code: 'LONGB', gameType: 'category-blitz', hostId: ME, players: PLAYERS } });
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    mock.pushToClient({ type: 'round_start', payload: { round: 1, totalRounds: 3, timerSeconds: 60, category: 'Pizza toppings', categoryId: 'pizza', rerollsRemaining: 1, topN: 376, pack: 'food' } });
    PLAYERS.forEach((p, i) => mock.pushToClient({ type: 'player_progress', payload: { playerId: p.id, answerCount: i } }));
    // the live rival strip (juice) or, without it, the OTHER PLAYERS list
    await expect(page.locator('.rj-name, .cb-progress-name-text').first()).toBeVisible({ timeout: 15000 });
    await settle(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/blitz-${vp.width}.png` });
    check(await measure(page, '.rj-name, .cb-progress-name-text', '.rj-row, .cb-progress-row'), 'blitz');

    const racers = PLAYERS.slice(0, 5).map((p) => ({ id: p.id, name: p.name, isBot: !!p.isBot }));
    mock.pushToClient({ type: 'room_update', payload: { code: 'LONGR', gameType: 'word-race', hostId: ME, players: PLAYERS.slice(0, 5) } });
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
    const now = Date.now();
    mock.pushToClient({ type: 'race_start', payload: { seed: 1, variant: 'words', words: ['alpha', 'bravo', 'charlie'], fragments: ['alpha', 'bravo', 'charlie'], tiers: [1, 1, 1], target: 3, capMs: 90000, racers, serverNow: now, goAt: now + 3000 } });
    await expect(page.locator('.wr-lane-name-txt').first()).toBeVisible({ timeout: 15000 });
    await settle(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/race-${vp.width}.png` });
    check(await measure(page, '.wr-lane-name-txt', '.wr-lane'), 'word race');
  });
}
