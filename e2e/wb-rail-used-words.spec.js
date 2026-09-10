// e2e/wb-rail-used-words.spec.js — fix/wb-rail-used-words GATE.
//
// On the <=2-player Word Bomb board the used-words list moves INTO the standings rail as its
// third item, and the right column drops its `used` row so the hero bomb inherits that height.
// 3+ players keep the 5-row broadcast template unchanged.
//
// Asserts, at 1366x768:
//   1. TWO PLAYERS — the bomb is >= 55% of its cell (the brief's gate).
//   2. TWO PLAYERS — .game-used sits in the RAIL: its left edge is inside the rail column
//      (left of the bomb column) and it is BELOW the last player card, i.e. the rail's 3rd item.
//   3. TWO PLAYERS — nothing is left under the prompt: .game-used no longer sits between the
//      combo box and the input row on the right-hand column.
//   4. THREE PLAYERS — unchanged: .game-used is still in the right column, above the input.
// Numbers are printed for both player counts so the before/after is readable off the log.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';

function playersFor(n) {
  const all = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p2', name: 'RIVAL', lives: 2 },
    { id: 'p3', name: 'THIRD', lives: 3 },
  ];
  return all.slice(0, n);
}

async function enterWordBombTurn(page, n) {
  const players = playersFor(n);
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  // A few used words so the dashed container has something to grow around.
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER', 'STRIKE', 'ASTRAY', 'STRONG'], timerSeconds: 22 },
  });
  await page.locator('.game-stage--wb').waitFor({ state: 'visible' });
  await page.locator('.game-input').waitFor({ state: 'visible' });
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
}

function measure() {
  const r1 = (n) => Math.round(n * 10) / 10;
  const q = (s) => document.querySelector(s);
  const rect = (el) => { const b = el.getBoundingClientRect(); return { x: r1(b.left), y: r1(b.top), w: r1(b.width), h: r1(b.height), right: r1(b.right), bottom: r1(b.bottom) }; };

  const bombSvg = q('.game-stage--wb .bomb-svg');
  const bombArea = q('.game-stage--wb .bomb-area');
  const combo = q('.game-stage--wb .game-combo-box');
  const row = q('.game-stage--wb .game-input-row');
  const used = q('.game-stage--wb .game-used');
  const bar = q('.game-stage--wb .game-player-bar');
  if (!bombSvg || !bombArea || !combo || !row || !used || !bar) return { err: 'missing node' };

  const bA = rect(bombArea), bS = rect(bombSvg), cB = rect(combo), rR = rect(row), uU = rect(used), bB = rect(bar);
  // Same cell definition as wb-short-layout.spec.js: the bomb column, spanning combo..input.
  const cellW = bA.w;
  const cellH = rR.bottom - cB.y;

  const cards = [...document.querySelectorAll('.game-player-bar .game-player-card')].map(rect);
  const lastCardBottom = cards.length ? Math.max(...cards.map((c) => c.bottom)) : 0;

  return {
    players: cards.length,
    bombW: r1((bS.w / cellW) * 100),
    bombH: r1((bS.h / cellH) * 100),
    bombPx: `${r1(bS.w)}x${r1(bS.h)} in ${r1(cellW)}x${r1(cellH)}`,
    used: uU, bar: bB, bombArea: bA, combo: cB, inputRow: rR,
    lastCardBottom: r1(lastCardBottom),
    usedDashed: getComputedStyle(used).borderTopStyle,
  };
}

test.describe('WB <=2-player rail', () => {
  test('2 players @1366x768: bomb >=55% of its cell, used words live in the rail', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await enterWordBombTurn(page, 2);
    const m = await page.evaluate(measure);
    // eslint-disable-next-line no-console
    console.log(`[wb-rail 2p 1366x768] ${JSON.stringify(m)}`);
    expect(m.err).toBeUndefined();
    expect(m.players, 'two player cards').toBe(2);

    // 1. the gate
    expect(Math.max(m.bombW, m.bombH), `bomb % of cell (w ${m.bombW}, h ${m.bombH}; ${m.bombPx})`).toBeGreaterThanOrEqual(55);

    // 2. used words are in the RAIL: left of the bomb column, and below the last card.
    expect(m.used.x, 'used starts in the rail column (left of the bomb column)').toBeLessThan(m.bombArea.x);
    expect(m.used.right, 'used does not run into the bomb column').toBeLessThanOrEqual(m.bombArea.x + 1);
    expect(m.used.y, 'used sits BELOW the last player card (the rail\'s 3rd item)').toBeGreaterThanOrEqual(m.lastCardBottom - 1);

    // 3. nothing left under the prompt: used is not stacked between combo and input.
    const betweenComboAndInput = m.used.y >= m.combo.bottom && m.used.bottom <= m.inputRow.y && m.used.x >= m.combo.x - 1;
    expect(betweenComboAndInput, 'used no longer sits under the prompt in the right column').toBe(false);

    // the container reads as a dashed slot
    expect(m.usedDashed, 'used-words container is dashed').toBe('dashed');
  });

  test('3 players @1366x768: the broadcast template is unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await enterWordBombTurn(page, 3);
    const m = await page.evaluate(measure);
    // eslint-disable-next-line no-console
    console.log(`[wb-rail 3p 1366x768] ${JSON.stringify(m)}`);
    expect(m.err).toBeUndefined();
    expect(m.players, 'three player cards').toBe(3);

    // used stays in the RIGHT column, above the input row — the 5-row template.
    expect(m.used.x, '3p: used is still in the right column').toBeGreaterThanOrEqual(m.bombArea.x - 1);
    expect(m.used.bottom, '3p: used is still above the input row').toBeLessThanOrEqual(m.inputRow.y + 1);
    expect(m.usedDashed, '3p: used container is NOT restyled dashed').not.toBe('dashed');
  });
});
