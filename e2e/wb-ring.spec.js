// e2e/wb-ring.spec.js — the Word Bomb BOARD gate.
//
// WHY THIS FILE WAS REWRITTEN. The first version measured the ring against ITSELF —
// seats even, seats inside the ring box, bomb >= 55% of the ring — and every one of
// those assertions passed on a board that was visibly broken: at 1366x768 the ring was
// a 476px circle at y=325 whose bottom ran off the board, at 1280x720 it was jammed at
// x=96 with two thirds of the stage dead, and the used-word list was loose text spanning
// the width. A ring can be perfectly round, perfectly even and perfectly self-consistent
// while sitting in the wrong place at the wrong size.
//
// So the gates here are all RELATIVE TO THE STAGE, plus screenshots — because a pass/fail
// number cannot see a bad composition, and that is exactly how the broken board shipped:
//
//   1) CLIP     every avatar (and its floated name) is fully inside the stage — 0px out.
//   2) BOX      the ring's bounding box is inside the stage on BOTH axes.
//   3) CENTRE   the ring's centre is within 5% of the stage's centre on both axes.
//   4) QUADRANT no quadrant of the stage is empty: each holds >=1 element covering >900px^2.
//   5) SIZE     the ring is 45-75% of the stage's SHORTER dimension.
//   +           the page never scrolls, and nothing overlaps anything it shouldn't.
//
// Run at 1366x768 / 1280x720 / 1536x864 / 390x844 / 320x640, at 2 / 3 / 4 / 8 players,
// with a PNG of every combination written to claude/wb-ring-shots/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const SHOTS = path.join('claude', 'wb-ring-shots');
const VIEWPORTS = [
  { name: '1366x768', w: 1366, h: 768 },
  { name: '1280x720', w: 1280, h: 720 },
  { name: '1536x864', w: 1536, h: 864 },
  { name: '390x844', w: 390, h: 844 },
  { name: '320x640', w: 320, h: 640 },
];
const COUNTS = [2, 3, 4, 8];
const OVERLAP_TOLERANCE_PX = 4;

fs.mkdirSync(SHOTS, { recursive: true });

const mkPlayers = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? ME : `p${i}`,
    name: i === 0 ? 'YOU' : `PLAYER${i}`,
    lives: 3,
    isHost: i === 0,
  }));

async function enterGame(page, players, currentPlayerId) {
  const mock = await installBackendMock(page);
  // The one-time first-game spotlight dims the whole screen behind its caption, which
  // would hide the very composition these screenshots exist to show. Mark it seen.
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.seenGameSpotlight', '1'); } catch { /* blocked */ }
  });
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
    payload: {
      currentPlayerId,
      players,
      combo: 'str',
      usedWords: ['MONSTER', 'STRIKE', 'ASTRAY', 'BISTRO'],
      timerSeconds: 20,
      maxLives: 3,
    },
  });
  // Let the 3-2-1-GO! intro overlay clear before measuring anything.
  await page.waitForTimeout(4700);
  return mock;
}

// Everything the board gates need, in one page evaluate.
async function measure(page) {
  return page.evaluate((tol) => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
    };
    const stage = document.querySelector('.game-stage--wb');
    const ring = document.querySelector('.wb-ring');
    const S = r(stage);
    const R = r(ring);
    const seats = [...document.querySelectorAll('.wb-seat')];

    // (1) CLIP — a seat's floated NAME hangs outside the seat's own box, so the avatar
    // AND its label both have to sit inside the stage or the 3-o'clock player's name
    // runs off the edge.
    let clipped = 0;
    let clippedWhat = '';
    for (const el of [...seats, ...document.querySelectorAll('.wb-seat .game-player-name-text')]) {
      const b = r(el);
      if (b.w < 1) continue;
      const out = Math.max(S.l - b.l, b.r - S.r, S.t - b.t, b.b - S.b);
      if (out > clipped) {
        clipped = out;
        clippedWhat = el.className;
      }
    }

    // (2) BOX — the ring's own box inside the stage, both axes.
    const ringOut = Math.max(S.l - R.l, R.r - S.r, S.t - R.t, R.b - S.b);

    // (3) CENTRE — ring centre vs stage centre, as a % of the stage on each axis.
    const dx = (R.l + R.w / 2) - (S.l + S.w / 2);
    const dy = (R.t + R.h / 2) - (S.t + S.h / 2);

    // (4) QUADRANT — split the stage in four and require each to hold a real object.
    // Measured as INTERSECTION area so a big element that straddles the centre counts
    // for every quadrant it actually covers, which is what "not empty" means visually.
    const cx = S.l + S.w / 2;
    const cy = S.t + S.h / 2;
    const quads = [
      { name: 'TL', l: S.l, r: cx, t: S.t, b: cy },
      { name: 'TR', l: cx, r: S.r, t: S.t, b: cy },
      { name: 'BL', l: S.l, r: cx, t: cy, b: S.b },
      { name: 'BR', l: cx, r: S.r, t: cy, b: S.b },
    ];
    const CONTENT = [
      '.wb-seat', '.bomb-svg', '.game-combo-box', '.game-input', '.game-send-btn',
      '.game-skip-btn', '.game-used', '.game-used-chip', '.kill-feed', '.game-title',
      '.game-leave-btn', '.wb-pointer-arm', '.spectator-react-btn',
    ];
    const content = [];
    for (const sel of CONTENT) {
      for (const el of document.querySelectorAll('.game-stage--wb ' + sel)) {
        const b = r(el);
        if (b.w > 0 && b.h > 0) content.push({ sel, b });
      }
    }
    const quadrants = quads.map((q) => {
      let best = 0;
      let bestSel = '-';
      for (const item of content) {
        const b = item.b;
        const ox = Math.max(0, Math.min(q.r, b.r) - Math.max(q.l, b.l));
        const oy = Math.max(0, Math.min(q.b, b.b) - Math.max(q.t, b.t));
        const area = ox * oy;
        if (area > best) { best = area; bestSel = item.sel; }
      }
      return { name: q.name, area: Math.round(best), sel: bestSel };
    });

    // (5) SIZE — the ring against the stage's shorter side.
    const shorter = Math.min(S.w, S.h);
    const sizeFrac = R.w / shorter;

    // The bomb is a fixed share of the ring by construction (0.42d).
    const bombEl = document.querySelector('.bomb-svg');
    const bombFrac = bombEl ? r(bombEl).w / R.w : 0;

    // Block collisions: ancestor<->descendant pairs skipped (the bomb LIVES inside the
    // ring), bomb<->seat measured radially rather than by axis-aligned boxes.
    const named = [
      ['prompt', '.game-combo'],
      ['bomb', '.bomb-svg'],
      ['input', '.game-input-row'],
      ['used', '.game-used'],
      ['feed', '.kill-feed'],
      ['sound', '.game-mute-btn'],
    ];
    const nodes = [];
    for (const pair of named) {
      const el = document.querySelector('.game-stage--wb ' + pair[1]);
      if (el && el.getBoundingClientRect().width > 0) nodes.push({ name: pair[0], el });
    }
    seats.forEach((el, i) => nodes.push({ name: 'seat' + i, el }));
    let worst = { px: 0, pair: '' };
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const pairNames = a.name + b.name;
        if (pairNames.includes('bomb') && pairNames.includes('seat')) continue;
        const A = r(a.el), B = r(b.el);
        const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l);
        const oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
        if (ox > 0 && oy > 0) {
          const px = Math.min(ox, oy);
          if (px > worst.px) worst = { px: Math.round(px * 10) / 10, pair: a.name + ' x ' + b.name };
        }
      }
    }

    // Radial bomb<->seat clearance (the true criterion for a round bomb).
    let minRadialGap = Infinity;
    if (bombEl) {
      const bcx = R.l + R.w / 2;
      const bcy = R.t + R.h / 2;
      const bombR = r(bombEl).h / 2; // the art is TALLER than wide — use the worst case
      for (const el of seats) {
        const s = r(el);
        const dist = Math.hypot(s.l + s.w / 2 - bcx, s.t + s.h / 2 - bcy);
        minRadialGap = Math.min(minRadialGap, dist - Math.hypot(s.w, s.h) / 2 - bombR);
      }
    }

    const widths = seats.map((el) => Math.round(r(el).w * 10) / 10);
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
      seatCount: seats.length,
      seatWidths: widths,
      seatWidthSpread: widths.length ? round1(Math.max(...widths) - Math.min(...widths)) : 0,
      stage: { w: Math.round(S.w), h: Math.round(S.h) },
      ringW: Math.round(R.w),
      clippedPx: round1(clipped),
      clippedWhat,
      ringOutsideStagePx: round1(ringOut),
      centreOffPctX: round1((Math.abs(dx) / S.w) * 100),
      centreOffPctY: round1((Math.abs(dy) / S.h) * 100),
      quadrants,
      sizePct: round1(sizeFrac * 100),
      bombFrac: Math.round(bombFrac * 1000) / 1000,
      worstOverlapPx: worst.px,
      worstOverlapPair: worst.pair,
      minRadialGapPx: Number.isFinite(minRadialGap) ? round1(minRadialGap) : null,
      pageVScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      pageHScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tol,
    };
  }, OVERLAP_TOLERANCE_PX);
}

for (const vp of VIEWPORTS) {
  for (const n of COUNTS) {
    test('board @ ' + vp.name + ' / ' + n + 'p: centred, unclipped, no dead quadrant', async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await enterGame(page, mkPlayers(n), ME);

      // SHOT FIRST, so the evidence exists even when an assertion below fails.
      await page.screenshot({ path: path.join(SHOTS, vp.name + '-' + n + 'p.png') });

      const m = await measure(page);
      // eslint-disable-next-line no-console
      console.log(
        'BOARD | ' + vp.name + ' | ' + n + 'p | stage=' + m.stage.w + 'x' + m.stage.h +
        ' ring=' + m.ringW + 'px (' + m.sizePct + '% of the short side) bomb=' +
        (m.bombFrac * 100).toFixed(1) + '% of ring | centreOff=' + m.centreOffPctX + '%/' +
        m.centreOffPctY + '% | clipped=' + m.clippedPx + 'px | ringOutside=' +
        m.ringOutsideStagePx + 'px | quads=' +
        m.quadrants.map((q) => q.name + ':' + q.area + '(' + q.sel + ')').join(' ') +
        ' | worstOverlap=' + m.worstOverlapPx + 'px ' + m.worstOverlapPair +
        ' | radialGap=' + m.minRadialGapPx + 'px | scroll=' + m.pageVScroll + '/' + m.pageHScroll
      );

      expect(m.seatCount, 'one seat per player').toBe(n);
      expect(m.seatWidthSpread, 'seat width spread (' + m.seatWidths.join(',') + ')').toBeLessThanOrEqual(1);

      // (1) every avatar fully inside the stage
      expect(m.clippedPx, 'avatar/name clipped by the stage (' + m.clippedWhat + ')').toBeLessThanOrEqual(0);
      // (2) the ring's box inside the stage on both axes
      expect(m.ringOutsideStagePx, 'ring box outside the stage').toBeLessThanOrEqual(0);
      // (3) the ring is centred on the stage
      expect(m.centreOffPctX, 'ring centre X off the stage centre (%)').toBeLessThanOrEqual(5);
      expect(m.centreOffPctY, 'ring centre Y off the stage centre (%)').toBeLessThanOrEqual(5);
      // (4) no dead quadrant
      for (const q of m.quadrants) {
        expect(q.area, 'quadrant ' + q.name + ' is empty (biggest object ' + q.sel + ' = ' + q.area + 'px^2)')
          .toBeGreaterThan(900);
      }
      // (5) the ring owns 45-75% of the stage's shorter side
      expect(m.sizePct, 'ring as % of the stage short side').toBeGreaterThanOrEqual(45);
      expect(m.sizePct, 'ring as % of the stage short side').toBeLessThanOrEqual(75);

      // and the things the first gate DID get right, kept:
      expect(m.pageVScroll, 'page v-scroll').toBeLessThanOrEqual(0);
      expect(m.pageHScroll, 'page h-scroll').toBeLessThanOrEqual(0);
      expect(m.worstOverlapPx, 'worst overlap (' + m.worstOverlapPair + ')').toBeLessThanOrEqual(OVERLAP_TOLERANCE_PX);
      expect(m.minRadialGapPx, 'bomb<->seat radial gap').toBeGreaterThan(0);
      expect(m.bombFrac, 'bomb as a share of the ring (0.42d by construction)').toBeGreaterThanOrEqual(0.39);
      expect(m.bombFrac, 'bomb as a share of the ring (0.42d by construction)').toBeLessThanOrEqual(0.45);
    });
  }
}

test('seats are on a CIRCLE at the specified angles, never a row or a column', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const n of [2, 3, 4, 8]) {
    await enterGame(page, mkPlayers(n), ME);
    const seats = await page.evaluate(() => {
      const ring = document.querySelector('.wb-ring').getBoundingClientRect();
      const cx = ring.left + ring.width / 2;
      const cy = ring.top + ring.height / 2;
      return [...document.querySelectorAll('.wb-seat')].map((el) => {
        const b = el.getBoundingClientRect();
        const x = b.left + b.width / 2 - cx;
        const y = b.top + b.height / 2 - cy;
        return { radius: Math.hypot(x, y), deg: (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360 };
      });
    });
    // Every seat at the SAME radius = a circle (a row or a column would not be).
    const radii = seats.map((s) => s.radius);
    const spread = Math.max(...radii) - Math.min(...radii);
    // Angles: player i at -90deg + i * (360/n), normalised to [0,360).
    const expected = seats.map((_, i) => ((-90 + (i * 360) / n) + 360) % 360);
    // eslint-disable-next-line no-console
    console.log(
      'CIRCLE | ' + n + 'p | r=' + radii.map((v) => v.toFixed(1)).join(',') +
      ' spread=' + spread.toFixed(1) + 'px | deg=' + seats.map((s) => s.deg).join(',') +
      ' expected=' + expected.map((d) => Math.round(d)).join(',')
    );
    expect(spread, 'seat radius spread @ ' + n + 'p (a circle has one radius)').toBeLessThanOrEqual(1);
    seats.forEach((s, i) => {
      const diff = Math.min(Math.abs(s.deg - expected[i]), 360 - Math.abs(s.deg - expected[i]));
      expect(diff, 'seat ' + i + '/' + n + ' angle').toBeLessThanOrEqual(2);
    });
    await page.goto('about:blank');
  }
});

test('the fuse is the clock: length strictly decreases across a scripted turn', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterGame(page, mkPlayers(3), ME);

  // Visible fuse length = pathLength(100) - strokeDashoffset. Sampled off the rendered
  // attribute, so this measures what the player actually sees burning down.
  const fuseLen = () =>
    page.evaluate(() => {
      const el = document.querySelector('.bomb-fuse');
      if (!el) return null;
      return Math.round((100 - parseFloat(el.getAttribute('stroke-dashoffset'))) * 100) / 100;
    });

  const samples = [];
  for (const secs of [20, 16, 12, 8, 4]) {
    mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: secs } });
    await page.waitForTimeout(160);
    samples.push({ secs, len: await fuseLen() });
  }
  // eslint-disable-next-line no-console
  console.log('FUSE | ' + samples.map((s) => s.secs + 's->' + s.len).join('  '));

  for (let i = 1; i < samples.length; i++) {
    expect(
      samples[i].len,
      'fuse length must strictly decrease: sample ' + i + ' (' + samples[i].secs + 's) vs ' + samples[i - 1].secs + 's'
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
      return (Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI) + 360) % 360;
    });
    const expected = Math.round((idx / players.length) * 360) % 360;
    // eslint-disable-next-line no-console
    console.log('POINTER | seat ' + idx + '/' + players.length + ' -> ' + deg + 'deg (expected ' + expected + ')');
    expect(Math.abs(deg - expected), 'pointer angle for seat ' + idx).toBeLessThanOrEqual(2);
  }
});
