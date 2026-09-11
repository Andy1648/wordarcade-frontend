// e2e/wb-gameplay-look.spec.js — feat/wb-gameplay-look GATE for the Word Bomb presentational
// pass (the bomb as the clock, turn ownership, rail stats, the pinned combo pill, the bigger
// fragment). Everything here is layout + painted state; no game logic, socket or scoring is
// exercised, and the turn is driven entirely through the backend mock.
//
// Per viewport it asserts:
//   1) NO SCROLL   — the document never exceeds the viewport in either axis.
//   2) NO OVERLAP  — every pair drawn from {prompt, bomb, rail, input, combo pill, sound
//                    button} overlaps by <= 4px. The pill is absolutely positioned ON the
//                    prompt box by design (a corner sticker), so that ONE pair is replaced by
//                    the stricter, meaningful check: the pill must not cover the fragment
//                    glyphs (.game-combo) by more than 4px either.
//   3) BOMB        — the bomb SVG (which contains the mascot PNG, the timer ring AND the fuse)
//                    is >= 55% of its grid cell on at least one axis.
// Then, once, on a scripted turn:
//   4) FUSE        — five timer ticks produce a STRICTLY decreasing lit fuse length, and the
//                    ring tracks the identical value; at <= 6s both the ring and the seconds
//                    are #FF4B4B and the bomb carries the danger halo.
// Every number is printed so a reviewer can read them off the run log.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const VIEWPORTS = [
  { w: 1366, h: 768 },
  { w: 1280, h: 720 },
  { w: 390, h: 844 },
];

const PLAYERS = [
  { id: ME, name: 'YOU', lives: 3, isHost: true },
  { id: 'p2', name: 'RIVAL', lives: 2 },
  { id: 'p3', name: 'THIRD', lives: 3 },
];

async function enterWordBombTurn(page, { timerSeconds = 25 } = {}) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: PLAYERS },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players: PLAYERS, combo: 'str', usedWords: ['MONSTER'], timerSeconds },
  });
  await page.locator('.game-stage--wb').waitFor({ state: 'visible' });
  await page.locator('.game-input').waitFor({ state: 'visible' });
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
  return mock;
}

// Two accepted words on MY turn: raises the local streak past the x2 threshold so the combo
// pill actually renders (it is null below 2), and fills the rail cards' WORDS / BEST COMBO.
// The words must go through the REAL input + SEND — the streak only advances for a word this
// client actually submitted (comboAwaitRef), so a bare pushed word_result would not count. Both
// words genuinely CONTAIN "str" (MONSTERS does not — it reads "ste"), so the client-side
// instant-reject path lets them through instead of breaking the streak it is meant to build.
async function buildStreak(page, mock) {
  for (const word of ['STRONGER', 'STRIKE']) {
    await page.locator('.game-input').fill(word);
    await page.locator('.game-send-btn').click();
    await page.waitForTimeout(120);
    mock.pushToClient({ type: 'word_result', payload: { word, accepted: true } });
    await page.waitForTimeout(260);
  }
  await page.locator('.game-stage--wb .combo-badge').waitFor({ state: 'visible' });
  await page.waitForTimeout(320);
}

function measure() {
  const q = (s) => document.querySelector(s);
  const r1 = (n) => Math.round(n * 10) / 10;
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };

  const NODES = {
    prompt: '.game-stage--wb .game-combo-box',
    bomb: '.game-stage--wb .bomb-area',
    rail: '.game-stage--wb .game-player-bar',
    input: '.game-stage--wb .game-input-row',
    combo: '.game-stage--wb .combo-meter .combo-badge',
    sound: '.game-stage--wb .game-mute-btn',
  };
  const boxes = {};
  const missing = [];
  for (const [name, sel] of Object.entries(NODES)) {
    const el = q(sel);
    if (!el) {
      missing.push(name);
      continue;
    }
    boxes[name] = rect(el);
  }
  if (missing.length) return { err: `missing: ${missing.join(', ')}` };

  // Overlap between two boxes = min(x overlap, y overlap); 0 when they miss on either axis.
  const ov = (a, b) => {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 0 && y > 0 ? Math.min(x, y) : 0;
  };

  const names = Object.keys(boxes);
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      // The pill is a child sticker pinned to the prompt box's corner — overlapping that box
      // is the design. The real risk (covering the fragment) is checked separately below.
      if ((a === 'prompt' && b === 'combo') || (a === 'combo' && b === 'prompt')) continue;
      pairs.push({ pair: `${a}|${b}`, px: r1(ov(boxes[a], boxes[b])) });
    }
  }
  const fragEl = q('.game-stage--wb .game-combo');
  pairs.push({ pair: 'combo|fragment', px: fragEl ? r1(ov(boxes.combo, rect(fragEl))) : 0 });
  pairs.sort((a, b) => b.px - a.px);

  // Bomb cell. On the wide-and-short grid the bomb column spans rows combo..input, so the cell
  // is the bomb column's width by (input row bottom - prompt top). In the stacked layout there
  // is no such column — the cell is the bomb area's own box.
  const gridded = getComputedStyle(q('.game-stage--wb')).display === 'grid';
  const bombSvg = q('.game-stage--wb .bomb-svg');
  const bS = rect(bombSvg);
  const cellW = boxes.bomb.width;
  const cellH = gridded ? boxes.input.bottom - boxes.prompt.top : boxes.bomb.height;

  const de = document.documentElement;
  return {
    gridded,
    scrollY: r1(de.scrollHeight - window.innerHeight),
    scrollX: r1(de.scrollWidth - window.innerWidth),
    worstPair: pairs[0].pair,
    worstPx: pairs[0].px,
    pairs: pairs.map((p) => `${p.pair}=${p.px}`).join(' '),
    bombW: r1((bS.width / cellW) * 100),
    bombH: r1((bS.height / cellH) * 100),
    bombPx: `${r1(bS.width)}x${r1(bS.height)} in ${r1(cellW)}x${r1(cellH)}`,
    fragmentPx: fragEl ? getComputedStyle(fragEl).fontSize : 'n/a',
  };
}

for (const { w, h } of VIEWPORTS) {
  test(`WB look @ ${w}x${h}: no scroll, no overlap >4px, bomb >=55% of its cell`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const mock = await enterWordBombTurn(page);
    await buildStreak(page, mock);

    const m = await page.evaluate(measure);
    // eslint-disable-next-line no-console
    console.log(`[wb-look ${w}x${h}] ${JSON.stringify(m)}`);
    expect(m.err).toBeUndefined();
    expect(m.scrollY, `vertical overflow px (${m.scrollY})`).toBeLessThanOrEqual(1);
    expect(m.scrollX, `horizontal overflow px (${m.scrollX})`).toBeLessThanOrEqual(1);
    expect(m.worstPx, `worst overlap: ${m.worstPair} (all: ${m.pairs})`).toBeLessThanOrEqual(4);
    expect(
      Math.max(m.bombW, m.bombH),
      `bomb+fuse % of cell (w ${m.bombW}, h ${m.bombH}; ${m.bombPx})`
    ).toBeGreaterThanOrEqual(55);
  });
}

test('WB fuse + ring drain together across five ticks, and go red under 6s', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterWordBombTurn(page, { timerSeconds: 25 });

  // Lit fraction from the computed dash offset. Both the fuse and the ring use pathLength=100
  // with strokeDasharray=100, so lit% is just (100 - offset).
  const sample = () =>
    page.evaluate(() => {
      const lit = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const off = parseFloat(getComputedStyle(el).strokeDashoffset) || 0;
        return Math.round((100 - off) * 10) / 10;
      };
      const ring = document.querySelector('.bomb-ring');
      const num = document.querySelector('.bomb-svg text');
      return {
        fuse: lit('.bomb-fuse'),
        ring: lit('.bomb-ring'),
        ringStroke: ring ? getComputedStyle(ring).stroke : null,
        numFill: num ? getComputedStyle(num).fill : null,
        danger: !!document.querySelector('.bomb-vignette.danger'),
      };
    });

  const RED = 'rgb(255, 75, 75)';
  const samples = [];
  for (const secondsRemaining of [25, 20, 15, 10, 5]) {
    mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining } });
    await page.waitForTimeout(1450); // clear the 1.15s dash transition so each sample is settled
    samples.push({ secondsRemaining, ...(await sample()) });
  }
  // eslint-disable-next-line no-console
  console.log(`[wb-fuse] ${JSON.stringify(samples)}`);

  for (let i = 1; i < samples.length; i++) {
    expect(
      samples[i].fuse,
      `fuse lit% must strictly decrease: ${samples[i - 1].secondsRemaining}s=${samples[i - 1].fuse} -> ${samples[i].secondsRemaining}s=${samples[i].fuse}`
    ).toBeLessThan(samples[i - 1].fuse);
    // The ring is the SECOND read of the same value — it must match the fuse, not drift.
    expect(
      Math.abs(samples[i].ring - samples[i].fuse),
      `ring must track the fuse at ${samples[i].secondsRemaining}s (fuse ${samples[i].fuse}, ring ${samples[i].ring})`
    ).toBeLessThanOrEqual(1);
  }

  const last = samples[samples.length - 1];
  expect(last.secondsRemaining).toBe(5);
  expect(last.danger, 'the danger halo is on at 5s').toBe(true);
  expect(last.ringStroke, 'ring is #FF4B4B at 5s').toBe(RED);
  expect(last.numFill, 'the seconds are #FF4B4B at 5s').toBe(RED);
  // ... and NOT red while there is plenty of time.
  expect(samples[0].danger, 'no danger halo at 25s').toBe(false);
  expect(samples[0].ringStroke, 'ring is not red at 25s').not.toBe(RED);
});

test('WB turn ownership paints from ONE colour, and the rail carries WORDS / BEST COMBO', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterWordBombTurn(page);
  await buildStreak(page, mock);

  const mine = await page.evaluate(() => {
    const stage = document.querySelector('.game-stage--wb');
    const cs = getComputedStyle(stage);
    const turnC = cs.getPropertyValue('--turn-c').trim();
    const card = document.querySelector('.game-player-card.current');
    const flag = document.querySelector('.wb-turn-flag');
    const input = document.querySelector('.game-input');
    const stats = [...document.querySelectorAll('.game-player-card .game-player-stats')].map((el) =>
      [...el.querySelectorAll('.gp-stat')].map((s) => `${s.querySelector('.gp-stat-label').textContent}:${s.querySelector('.gp-stat-value').textContent}`).join(',')
    );
    return {
      isMyTurn: stage.classList.contains('is-my-turn'),
      turnC,
      flagText: flag ? flag.textContent.trim() : null,
      cardBg: card ? getComputedStyle(card).backgroundColor : null,
      inputBorder: input ? getComputedStyle(input).borderTopColor : null,
      inputDisabled: input ? input.disabled : null,
      stageShadow: cs.boxShadow,
      stats,
    };
  });
  // eslint-disable-next-line no-console
  console.log(`[wb-turn] ${JSON.stringify(mine)}`);

  expect(mine.isMyTurn).toBe(true);
  expect(mine.flagText).toBe('YOUR TURN');
  expect(mine.inputDisabled).toBe(false);
  // The active card, the live input border and the panel's inset ring all paint from --turn-c.
  expect(mine.cardBg, `active card fills with the turn colour (${mine.turnC})`).toBe(mine.inputBorder);
  expect(mine.stageShadow, 'panel carries a 3px inset ring in the turn colour').toContain('inset');
  // Three cards, each with both stats; mine shows the two accepted words.
  expect(mine.stats).toHaveLength(3);
  for (const s of mine.stats) expect(s).toMatch(/^WORDS:\d+,BEST COMBO:\d+$/);
  expect(mine.stats[0]).toBe('WORDS:2,BEST COMBO:2');

  // Hand the turn to an opponent: the flag flips and the field goes dead.
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: 'p2', players: PLAYERS, combo: 'ing', usedWords: ['MONSTER'], timerSeconds: 25 },
  });
  await page.waitForTimeout(300);
  const theirs = await page.evaluate(() => {
    const stage = document.querySelector('.game-stage--wb');
    const input = document.querySelector('.game-input');
    const send = document.querySelector('.game-send-btn');
    return {
      isTheirTurn: stage.classList.contains('is-their-turn'),
      flagText: (document.querySelector('.wb-turn-flag') || {}).textContent,
      inputDisabled: input.disabled,
      sendDisabled: send.disabled,
      inputBorderStyle: getComputedStyle(input).borderTopStyle,
      inputShadow: getComputedStyle(input).boxShadow,
    };
  });
  // eslint-disable-next-line no-console
  console.log(`[wb-turn-off] ${JSON.stringify(theirs)}`);
  expect(theirs.isTheirTurn).toBe(true);
  expect((theirs.flagText || '').trim()).toBe('THEIR TURN');
  expect(theirs.inputDisabled).toBe(true);
  expect(theirs.sendDisabled).toBe(true);
  expect(theirs.inputBorderStyle, 'dead field drops to a dashed grey border').toBe('dashed');
  expect(theirs.inputShadow, 'dead field has a reduced 2px shadow').toContain('2px');
});
