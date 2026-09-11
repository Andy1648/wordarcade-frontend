// e2e/wb-short-layout.spec.js — GATE for the Word Bomb two-column reflow on wide-but-short
// desktop windows (the @media (min-width:900px) and (max-height:900px) block in GameScreen.css).
//
// REWRITTEN for feat/wb-ring. The original asserted properties of the horizontal player-card
// ROW (`.game-player-bar .game-player-card`: cards even, no overlap, equal heights) and of a
// prompt box that shared the right-hand column with the input. The ring replaced both: seats
// sit on a circle (`.wb-seat`), and the prompt now owns its own grid area above the ring. The
// intent of this gate is unchanged and still worth holding — on a laptop-class window the bomb
// must not be a small object lost in its column, the input row must span its cell rather than
// sitting centred at its stacked max-width, the placeholder must not clip, and the seats must
// be evenly laid out — so each assertion is re-pointed at the ring-era DOM.
//
// Per viewport (one Word Bomb turn via the backend mock) this asserts:
//   1) BOMB    — the ring is >= 45% of the board's shorter side and the bomb is 0.42 of the
//                ring (the rebuilt board fixes that share; see wb-ring.spec.js), so the clock
//                is never a small object lost in a big empty circle.
//   2) ROW     — the input row is CENTRED on the board (it is the full-width bottom row now,
//                not a right-hand column), and the text field takes >= 90% of the row width
//                left after the SEND/SKIP buttons.
//   3) HOLDER  — the placeholder text fits inside the field with 0px clipped.
//   4) SEATS   — all three seats are the same size and none overlap another.
//   5) FIT     — the stage does not overflow the viewport height.
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
  // let the 3-2-1-GO! intro clear before measuring
  await page.waitForTimeout(4700);
}

function measure() {
  const q = (s) => document.querySelector(s);
  const rect = (el) => el.getBoundingClientRect();
  const r1 = (n) => Math.round(n * 10) / 10;

  const ring = q('.game-stage--wb .wb-ring');
  const bombSvg = q('.game-stage--wb .bomb-svg');
  const combo = q('.game-stage--wb .game-combo-box');
  const row = q('.game-stage--wb .game-input-row');
  const input = q('.game-stage--wb .game-input');
  const send = q('.game-stage--wb .game-send-btn');
  const skip = q('.game-stage--wb .game-skip-btn');
  const stage = q('.game-stage--wb');
  if (!ring || !bombSvg || !combo || !row || !input || !send || !stage) return { err: 'missing node' };

  // (1) The bomb's cell is the ring: the square the seats are laid out around. The ring
  // in turn is measured against the BOARD, which is the check the first ring shipped
  // without - a ring can be self-consistent and still be the wrong size for its stage.
  const rG = rect(ring), bS = rect(bombSvg);
  const stageR0 = rect(stage);
  const bombW = bS.width / rG.width;
  const ringOfStage = rG.width / Math.min(stageR0.width, stageR0.height);

  // (2) The input row is the full-width BOTTOM row of the board now, capped at its own
  // max-width and centred - so what matters is that it is centred on the board, not that
  // it fills a column.
  const rR = rect(row);
  const rowOffCentrePct =
    (Math.abs((rR.left + rR.width / 2) - (stageR0.left + stageR0.width / 2)) / stageR0.width) * 100;

  const iR = rect(input), sR = rect(send), kR = skip ? rect(skip) : { width: 0 };
  const gap = parseFloat(getComputedStyle(row).gap) || 0;
  const nBtn = skip ? 2 : 1;
  const fieldAvail = rR.width - sR.width - kR.width - gap * nBtn;
  const fieldFill = iR.width / fieldAvail;

  // (3) Placeholder text width at the field's font vs the field's content box.
  const cs = getComputedStyle(input);
  const canvas = document.createElement('canvas').getContext('2d');
  canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const ph = input.getAttribute('placeholder') || '';
  let textW = canvas.measureText(ph).width;
  const ls = parseFloat(cs.letterSpacing);
  if (!Number.isNaN(ls)) textW += ls * ph.length;
  const contentW = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const clipped = Math.max(0, textW - contentW);

  // (4) Seats: same size, and no seat overlapping another.
  const seatEls = [...document.querySelectorAll('.game-stage--wb .wb-seat')];
  const seats = seatEls.map((el) => rect(el));
  const widths = seats.map((s) => r1(s.width));
  const spread = widths.length ? r1(Math.max(...widths) - Math.min(...widths)) : 0;
  let seatOverlap = 0;
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i], b = seats[j];
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 0 && oy > 0) seatOverlap = Math.max(seatOverlap, Math.min(ox, oy));
    }
  }

  // (5) The stage fits the window.
  const stageR = rect(stage);
  const fitH = stageR.height / window.innerHeight;

  return {
    bombW: r1(bombW * 100), bombPx: `${r1(bS.width)} in ring ${r1(rG.width)}`,
    ringOfStage: r1(ringOfStage * 100),
    rowOffCentrePct: r1(rowOffCentrePct), fieldFill: r1(fieldFill * 100),
    rowPx: `${r1(rR.width)} wide`, fieldPx: `${r1(iR.width)} of ${r1(fieldAvail)}`,
    promptW: r1(rect(combo).width),
    placeholder: ph, phTextW: r1(textW), phContentW: r1(contentW), clipped: r1(clipped),
    seats: seats.length, seatWidths: widths, seatSpread: spread, seatOverlap: r1(seatOverlap),
    fitH: r1(fitH * 100),
  };
}

for (const { w, h } of VIEWPORTS) {
  test(`WB short layout @ ${w}x${h}: ring >=45% of the board, row centred, placeholder unclipped, seats even`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await enterWordBombTurn(page);
    const m = await page.evaluate(measure);
    // eslint-disable-next-line no-console
    console.log(`[wb-short-layout ${w}x${h}] ${JSON.stringify(m)}`);
    expect(m.err).toBeUndefined();
    expect(m.bombW, `bomb % of the ring cell (${m.bombPx})`).toBeGreaterThanOrEqual(39);
    expect(m.ringOfStage, 'ring % of the board short side').toBeGreaterThanOrEqual(45);
    expect(m.rowOffCentrePct, `input row off the board centre (${m.rowPx})`).toBeLessThanOrEqual(2);
    expect(m.fieldFill, `field % of row width after buttons (${m.fieldPx})`).toBeGreaterThanOrEqual(90);
    expect(m.clipped, `placeholder px clipped ("${m.placeholder}" ${m.phTextW}px in ${m.phContentW}px)`).toBe(0);
    expect(m.seats, 'one seat per player').toBe(3);
    expect(m.seatSpread, `seat size spread (${m.seatWidths.join(',')})`).toBeLessThanOrEqual(1);
    expect(m.seatOverlap, 'seat-to-seat overlap px').toBeLessThanOrEqual(0);
    expect(m.fitH, 'stage height as % of the viewport').toBeLessThanOrEqual(100);
  });
}
