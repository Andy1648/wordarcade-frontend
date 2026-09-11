// e2e/wb-ring.spec.js — feat/wb-ring acceptance.
//
// THE FAILURE THIS PINS: the old Word Bomb layout was a horizontal row of player cards
// with `flex: 1 1 0`. A row cannot space both ends of the player count — at 2 players each
// card stretched to half the stage (wide, mostly-empty boxes), at 8 it wrapped to three
// rows and pushed the stage past the viewport. The ring divides 360deg by the seat count,
// so the SAME fixed-size seat works at 2 and at 16.
//
// Measured here, at 1366x768 / 1280x720 / 390x844:
//   1) every seat is the SAME width (no stretched-empty element) at 2, 3 and 8 players
//   2) no seat escapes the ring box, and the page never scrolls (no overflow at 8)
//   3) no two of prompt / bomb / seats / input / used-list / sound button overlap by >4px
//      (ancestor<->descendant pairs are skipped: the prompt and bomb LIVE inside the ring)
//   4) the bomb+fuse is >=55% of the ring cell — the clock is not a detail in a big circle
//   5) the fuse length strictly DECREASES across 5 samples of a scripted turn
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const VIEWPORTS = [
  { name: '1366x768', w: 1366, h: 768 },
  { name: '1280x720', w: 1280, h: 720 },
  { name: '390x844', w: 390, h: 844 },
];
const OVERLAP_TOLERANCE_PX = 4;

const mkPlayers = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? ME : `p${i}`,
    name: i === 0 ? 'YOU' : `PLAYER${i}`,
    lives: 3,
    isHost: i === 0,
  }));

async function enterGame(page, players, currentPlayerId) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId, players, combo: 'str', usedWords: ['MONSTER', 'STRIKE'], timerSeconds: 20, maxLives: 3 },
  });
  // Let the 3-2-1-GO! intro overlay clear before measuring anything.
  await page.waitForTimeout(4700);
  return mock;
}

// Geometry of the ring, its seats and the other stage blocks, in one page evaluate.
async function measure(page) {
  return page.evaluate((tol) => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
    };
    const ring = document.querySelector('.wb-ring');
    const seats = [...document.querySelectorAll('.wb-seat')];
    const ringBox = ring ? r(ring) : null;
    const seatBoxes = seats.map(r);

    // Named blocks that must not collide.
    const named = [
      ['prompt', '.game-combo'],
      ['bomb', '.bomb-svg'],
      ['input', '.game-input-row'],
      ['used', '.game-used'],
      ['sound', '.game-mute-btn'],
    ];
    const nodes = [];
    for (const [name, sel] of named) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().width > 0) nodes.push({ name, el });
    }
    seats.forEach((el, i) => nodes.push({ name: `seat${i}`, el }));

    let worst = { px: 0, pair: '' };
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        // A block INSIDE another (the bomb lives inside the ring) is not a collision.
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // BOMB x SEAT is measured RADIALLY, not by axis-aligned boxes (see below).
        const pairNames = a.name + b.name;
        if (pairNames.includes('bomb') && pairNames.includes('seat')) continue;
        const A = r(a.el), B = r(b.el);
        const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l);
        const oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
        if (ox > 0 && oy > 0) {
          const px = Math.min(ox, oy);
          if (px > worst.px) worst = { px: Math.round(px * 10) / 10, pair: `${a.name} x ${b.name}` };
        }
      }
    }

    const bombEl = document.querySelector('.bomb-svg');
    const bombFrac = bombEl && ringBox ? r(bombEl).w / ringBox.w : 0;

    // How far any seat escapes the ring box (0 = all seats contained).
    let escape = 0;
    if (ringBox) {
      for (const s of seatBoxes) {
        escape = Math.max(
          escape,
          ringBox.l - s.l, s.r - ringBox.r, ringBox.t - s.t, s.b - ringBox.b
        );
      }
    }

    // RADIAL clearance: the true bomb<->seat criterion. The bomb art is a round mascot
    // with a fuse arc, and a seat at 45deg only clips the CORNER of its transparent
    // bounding box - an axis-aligned overlap there is not a visual collision. What
    // actually matters is that every seat's inner edge stays outside the bomb's radius.
    let minRadialGap = Infinity;
    if (ringBox && bombEl) {
      const cx = ringBox.l + ringBox.w / 2;
      const cy = ringBox.t + ringBox.h / 2;
      const bombR = r(bombEl).w / 2;
      for (const s of seatBoxes) {
        const sx = s.l + s.w / 2;
        const sy = s.t + s.h / 2;
        const dist = Math.hypot(sx - cx, sy - cy);
        const seatInnerEdge = dist - Math.hypot(s.w, s.h) / 2;
        minRadialGap = Math.min(minRadialGap, seatInnerEdge - bombR);
      }
    }

    // CLIPPING: a seat's floated NAME hangs outside the ring's own box, so "inside the
    // ring" is not enough - every seat AND its label must sit inside the STAGE, or the
    // 3-o'clock player's name runs off the edge (it did, at 390px).
    const stage = document.querySelector('.game-stage');
    let outsideStage = 0;
    if (stage) {
      const S = r(stage);
      const labels = [...document.querySelectorAll('.wb-seat, .wb-seat .game-player-name-text')];
      for (const el of labels) {
        const b = r(el);
        if (b.w < 1) continue;
        outsideStage = Math.max(outsideStage, S.l - b.l, b.r - S.r, S.t - b.t, b.b - S.b);
      }
    }

    const widths = seatBoxes.map((s) => Math.round(s.w * 10) / 10);
    return {
      seatCount: seats.length,
      seatWidths: widths,
      seatWidthSpread: widths.length ? Math.round((Math.max(...widths) - Math.min(...widths)) * 10) / 10 : 0,
      ringW: ringBox ? Math.round(ringBox.w) : 0,
      bombW: bombEl ? Math.round(r(bombEl).w) : 0,
      bombFrac: Math.round(bombFrac * 1000) / 1000,
      seatEscapePx: Math.round(escape * 10) / 10,
      worstOverlapPx: worst.px,
      worstOverlapPair: worst.pair,
      minRadialGapPx: Number.isFinite(minRadialGap) ? Math.round(minRadialGap * 10) / 10 : null,
      outsideStagePx: Math.round(outsideStage * 10) / 10,
      pageVScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      pageHScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tol,
    };
  }, OVERLAP_TOLERANCE_PX);
}

for (const vp of VIEWPORTS) {
  for (const n of [2, 3, 8]) {
    test(`ring @ ${vp.name} / ${n} players: even seats, contained, no collisions`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      const players = mkPlayers(n);
      await enterGame(page, players, ME);
      const m = await measure(page);

      // eslint-disable-next-line no-console
      console.log(
        `RING | ${vp.name} | ${n}p | seats=${m.seatCount} w=[${m.seatWidths.join(',')}] spread=${m.seatWidthSpread}px ` +
        `| ring=${m.ringW}px bomb=${m.bombW}px (${(m.bombFrac * 100).toFixed(1)}% of cell) ` +
        `| seatEscape=${m.seatEscapePx}px | worstOverlap=${m.worstOverlapPx}px ${m.worstOverlapPair} ` +
        `| bombSeatRadialGap=${m.minRadialGapPx}px | outsideStage=${m.outsideStagePx}px ` +
        `| scrollY=${m.pageVScroll} scrollX=${m.pageHScroll}`
      );

      expect(m.seatCount, 'one seat per player').toBe(n);
      // (1) NO STRETCHED-EMPTY ELEMENT: every seat is the same fixed width, whatever the count.
      expect(m.seatWidthSpread, `seat width spread @ ${vp.name}/${n}p`).toBeLessThanOrEqual(1);
      // (2) contained + no overflow
      expect(m.seatEscapePx, `seat escaping the ring @ ${vp.name}/${n}p`).toBeLessThanOrEqual(1);
      expect(m.pageVScroll, `page v-scroll @ ${vp.name}/${n}p`).toBeLessThanOrEqual(0);
      expect(m.pageHScroll, `page h-scroll @ ${vp.name}/${n}p`).toBeLessThanOrEqual(0);
      // (3) no block collides with another by more than 4px
      expect(m.worstOverlapPx, `worst overlap (${m.worstOverlapPair}) @ ${vp.name}/${n}p`)
        .toBeLessThanOrEqual(OVERLAP_TOLERANCE_PX);
      // (4) the bomb owns its cell
      expect(m.bombFrac, `bomb share of the ring cell @ ${vp.name}/${n}p`).toBeGreaterThanOrEqual(0.55);
      // (5) and it never actually touches a seat, measured radially
      expect(m.minRadialGapPx, `bomb<->seat radial gap @ ${vp.name}/${n}p`).toBeGreaterThan(0);
      // (6) nothing on the ring - seat or floated name - is clipped by the stage edge
      expect(m.outsideStagePx, `seat/name outside the stage @ ${vp.name}/${n}p`).toBeLessThanOrEqual(0);
    });
  }
}

test('the fuse is the clock: length strictly decreases across a scripted turn', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const players = mkPlayers(3);
  const mock = await enterGame(page, players, ME);

  // Visible fuse length = pathLength(100) - strokeDashoffset. Sampled off the rendered
  // attribute, so this measures what the player actually sees burning down.
  const fuseLen = () =>
    page.evaluate(() => {
      const el = document.querySelector('.bomb-fuse');
      if (!el) return null;
      const off = parseFloat(el.getAttribute('stroke-dashoffset'));
      return Math.round((100 - off) * 100) / 100;
    });

  const samples = [];
  for (const secs of [20, 16, 12, 8, 4]) {
    mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: secs } });
    await page.waitForTimeout(160);
    samples.push({ secs, len: await fuseLen() });
  }
  // eslint-disable-next-line no-console
  console.log('FUSE | ' + samples.map((s) => `${s.secs}s->${s.len}`).join('  '));

  for (let i = 1; i < samples.length; i++) {
    expect(
      samples[i].len,
      `fuse length must strictly decrease: sample ${i} (${samples[i].secs}s) vs ${samples[i - 1].secs}s`
    ).toBeLessThan(samples[i - 1].len);
  }
});

test('the numeric readout appears only under 5s, and the turn pointer aims at the live seat', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const players = mkPlayers(4);
  const mock = await enterGame(page, players, ME);

  const num = page.locator('.bomb-num-tick');
  mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: 12 } });
  await page.waitForTimeout(120);
  await expect(num, 'no seconds readout above 5s - the fuse carries the proportion').toHaveCount(0);

  mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: 4 } });
  await page.waitForTimeout(120);
  await expect(num, 'seconds readout appears under 5s').toHaveCount(1);

  // The pointer's rotation must match the active seat's index: seat 0 is straight up and
  // the pointer uses the same convention, so angle = index / count * 360.
  for (const idx of [0, 1, 2, 3]) {
    mock.pushToClient({
      type: 'turn_update',
      payload: {
        currentPlayerId: players[idx].id, players, combo: 'str',
        usedWords: [], timerSeconds: 20, maxLives: 3,
      },
    });
    await page.waitForTimeout(340);
    const deg = await page.evaluate(() => {
      const el = document.querySelector('.wb-pointer');
      if (!el) return null;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      // rotation angle out of the 2D matrix, normalised to [0,360)
      return (Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI) + 360) % 360;
    });
    const expected = Math.round((idx / players.length) * 360) % 360;
    // eslint-disable-next-line no-console
    console.log(`POINTER | seat ${idx}/${players.length} -> ${deg}deg (expected ${expected})`);
    expect(Math.abs(deg - expected), `pointer angle for seat ${idx}`).toBeLessThanOrEqual(2);
  }
});
