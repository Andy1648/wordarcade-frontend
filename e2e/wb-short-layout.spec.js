// e2e/wb-short-layout.spec.js — fix/wb-short-layout GATE for the Word Bomb two-column reflow on
// wide-but-short desktop windows (the @media (min-width:900px) and (max-height:900px) block in
// GameScreen.css). On a laptop-class window the bomb rendered as a small object lost in a
// 0.85fr column, the prompt/input row sat centred at its stacked max-width instead of spanning
// its grid cell, and the player cards could touch / differ in height.
//
// Per viewport (one Word Bomb turn via the backend mock) this asserts:
//   1) BOMB    — the bomb svg is >= 50% of its grid cell (the bomb column, rows combo..input).
//   2) PROMPT  — the input row spans >= 90% of its grid cell (the right column), and the text
//                field itself takes >= 90% of the row width left after the SEND/SKIP buttons.
//   3) HOLDER  — the placeholder text fits inside the field with 0px clipped.
//   4) CARDS   — player cards overlap by 0px and are within 5px of each other in height.
// The numbers are printed so a reviewer can read them off the run log.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const VIEWPORTS = [
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 1536, h: 864 },
  { w: 1280, h: 720 },
];

async function enterWordBombTurn(page) {
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p2', name: 'RIVAL', lives: 2 },
    { id: 'p3', name: 'THIRD', lives: 3 },
  ];
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER'], timerSeconds: 22 } });
  await page.locator('.game-stage--wb').waitFor({ state: 'visible' });
  await page.locator('.game-input').waitFor({ state: 'visible' });
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
}

function measure() {
  const q = (s) => document.querySelector(s);
  const rect = (el) => el.getBoundingClientRect();
  const r1 = (n) => Math.round(n * 10) / 10;

  const bombSvg = q('.game-stage--wb .bomb-svg');
  const bombArea = q('.game-stage--wb .bomb-area');
  const combo = q('.game-stage--wb .game-combo-box');
  const row = q('.game-stage--wb .game-input-row');
  const input = q('.game-stage--wb .game-input');
  const send = q('.game-stage--wb .game-send-btn');
  const skip = q('.game-stage--wb .game-skip-btn');
  if (!bombSvg || !bombArea || !combo || !row || !input || !send) return { err: 'missing node' };

  // Bomb cell: the bomb column (the .bomb-area box is stretched to the column) spanning rows
  // combo..input — top of the combo box to the bottom of the input row.
  const bA = rect(bombArea), bS = rect(bombSvg), cB = rect(combo), rR = rect(row);
  const cellW = bA.width;
  const cellH = rR.bottom - cB.top;
  const bombW = bS.width / cellW;
  const bombH = bS.height / cellH;

  // Prompt: the row vs its grid cell (the right column = combo box column width, which is
  // stretched to the cell), and the field vs the row width left after the buttons + gaps.
  const iR = rect(input), sR = rect(send), kR = skip ? rect(skip) : { width: 0 };
  const gap = parseFloat(getComputedStyle(row).gap) || 0;
  const nBtn = skip ? 2 : 1;
  const rowCellW = cB.width;
  const rowFill = rR.width / rowCellW;
  const fieldAvail = rR.width - sR.width - kR.width - gap * nBtn;
  const fieldFill = iR.width / fieldAvail;

  // Placeholder: text width at the field's font vs the field's content box.
  const cs = getComputedStyle(input);
  const canvas = document.createElement('canvas').getContext('2d');
  canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const ph = input.getAttribute('placeholder') || '';
  let textW = canvas.measureText(ph).width;
  const ls = parseFloat(cs.letterSpacing);
  if (!Number.isNaN(ls)) textW += ls * ph.length;
  const contentW = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const clipped = Math.max(0, textW - contentW);

  // Player cards: pairwise horizontal overlap of the RENDERED boxes (adjacent, sorted by left —
  // this includes the active card's scale(1.08) spotlight, which is what can visually collide)
  // + LAYOUT height spread (offsetHeight — the transform is a deliberate spotlight, not a
  // layout difference; the stretch rule is what makes the layout boxes equal).
  const cardEls = [...document.querySelectorAll('.game-player-bar .game-player-card')];
  const cards = cardEls.map((el) => ({ r: rect(el), layoutH: el.offsetHeight }))
    .sort((a, b) => a.r.left - b.r.left);
  let overlap = 0;
  for (let i = 1; i < cards.length; i++) overlap = Math.max(overlap, cards[i - 1].r.right - cards[i].r.left);
  const hs = cards.map((c) => c.layoutH);
  const rendered = cards.map((c) => r1(c.r.height));
  const heightSpread = Math.max(...hs) - Math.min(...hs);

  return {
    bombW: r1(bombW * 100), bombH: r1(bombH * 100), bombPx: `${r1(bS.width)}x${r1(bS.height)} in ${r1(cellW)}x${r1(cellH)}`,
    rowFill: r1(rowFill * 100), fieldFill: r1(fieldFill * 100), rowPx: `${r1(rR.width)} of ${r1(rowCellW)}`, fieldPx: `${r1(iR.width)} of ${r1(fieldAvail)}`,
    placeholder: ph, phTextW: r1(textW), phContentW: r1(contentW), clipped: r1(clipped),
    cards: cards.length, overlap: r1(overlap), layoutHeights: hs.map(r1), renderedHeights: rendered, heightSpread: r1(heightSpread),
  };
}

for (const { w, h } of VIEWPORTS) {
  test(`WB short layout @ ${w}x${h}: bomb >=50% cell, prompt >=90% row, placeholder unclipped, cards even`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await enterWordBombTurn(page);
    const m = await page.evaluate(measure);
    // eslint-disable-next-line no-console
    console.log(`[wb-short-layout ${w}x${h}] ${JSON.stringify(m)}`);
    expect(m.err).toBeUndefined();
    expect(Math.max(m.bombW, m.bombH), `bomb % of cell (w ${m.bombW}, h ${m.bombH}; ${m.bombPx})`).toBeGreaterThanOrEqual(50);
    expect(m.rowFill, `input row % of its cell (${m.rowPx})`).toBeGreaterThanOrEqual(90);
    expect(m.fieldFill, `field % of row width after buttons (${m.fieldPx})`).toBeGreaterThanOrEqual(90);
    expect(m.clipped, `placeholder px clipped ("${m.placeholder}" ${m.phTextW}px in ${m.phContentW}px)`).toBe(0);
    expect(m.cards).toBe(3);
    expect(m.overlap, 'player card overlap px').toBeLessThanOrEqual(0);
    expect(m.heightSpread, `player card layout-height spread (${m.layoutHeights.join(',')}; rendered ${m.renderedHeights.join(',')})`).toBeLessThanOrEqual(5);
  });
}
