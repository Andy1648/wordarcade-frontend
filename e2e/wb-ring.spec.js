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
//   3) CENTRE   the ring's centre is within 2% of the PLAY AREA's centre on both axes
//               (the play area is the board below the header row), and within 8% of the
//               whole stage's centre as a backstop against the old corner failure.
//   4) QUADRANT no quadrant of the stage is empty: each holds >=1 element covering >900px^2.
//   5) SIZE     the ring is 45-75% of the stage's SHORTER dimension.
//   6) HEADER   the prompt box does not intersect the title, LEAVE or the sound button by
//               even 1px. The header used to be absolutely positioned ON the prompt bar,
//               which every number above passed and one screenshot showed instantly.
//   7) RAILS    wherever the rails layout is live, NEITHER rail is empty and the two rail
//               cards are within 35% of each other in area. An empty left rail at 2
//               players is the same dead-space failure the ring was built to fix.
//   8) NAME     nothing on the board is drawn across a seat's name label. A turn-pointer
//               beam used to run under the 12-o'clock seat's name and read as a stray
//               glyph struck through it.
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
    name: i === 0 ? 'ANDY' : `PLAYER${i}`,
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
    const scs = getComputedStyle(stage);
    const layout = scs.getPropertyValue('--wb-layout').trim();
    const rowGap = parseFloat(scs.rowGap) || 0;
    // The PLAY AREA: the stage's content box minus the header row. The header is
    // chrome and is NOT mirrored below the ring, so the ring is centred in what is
    // left, not on the stage's own middle.
    const headerEl = document.querySelector('.game-stage--wb .game-header');
    const H = headerEl ? r(headerEl) : null;
    const playT = H ? H.b + rowGap : S.t + (parseFloat(scs.paddingTop) || 0);
    const playB = S.b - (parseFloat(scs.paddingBottom) || 0);
    const playL = S.l + (parseFloat(scs.paddingLeft) || 0);
    const playR = S.r - (parseFloat(scs.paddingRight) || 0);

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
    const pdx = (R.l + R.w / 2) - (playL + playR) / 2;
    const pdy = (R.t + R.h / 2) - (playT + playB) / 2;

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
      '.game-leave-btn', '.wb-status', '.spectator-react-btn',
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

    // (6) HEADER vs PROMPT. The prompt box's rect must not touch the title or either
    // header control. This is the gate the "header rides the bar" layout failed while
    // passing every geometric number in this file.
    const promptEl = document.querySelector('.game-stage--wb .game-combo-box');
    const P = promptEl ? r(promptEl) : null;
    let headerHit = { px: 0, what: '-' };
    if (P) {
      for (const sel of ['.game-title', '.game-leave-btn', '.game-mute-btn']) {
        const el = document.querySelector('.game-stage--wb ' + sel);
        if (!el) continue;
        const b = r(el);
        if (b.w < 1 || b.h < 1) continue;
        const ox = Math.min(P.r, b.r) - Math.max(P.l, b.l);
        const oy = Math.min(P.b, b.b) - Math.max(P.t, b.t);
        const px = Math.min(ox, oy);
        if (ox > 0 && oy > 0 && px > headerHit.px) headerHit = { px: Math.round(px * 10) / 10, what: sel };
      }
    }
    // The gap between the header's bottom edge and the top of the prompt box.
    const headToPrompt = P && H ? Math.round((P.t - H.b) * 10) / 10 : null;

    // ...and the OTHER thing the header has to miss: the fixed WINS pill, which is a
    // sibling of the board (position:fixed, top-right of the VIEWPORT) and so is not
    // caught by any stage-relative measurement. The board's top padding exists purely
    // to clear it; without a gate on it that padding is a number nobody can check.
    const pill = document.querySelector('.wins-hud');
    let pillHit = { px: 0, what: '-' };
    if (pill) {
      const pb = r(pill);
      // The pill carries a 4px hard offset shadow that the rect does not include.
      const PB = { l: pb.l, t: pb.t, r: pb.r + 4, b: pb.b + 4 };
      for (const sel of ['.game-title', '.game-leave-btn', '.game-mute-btn', '.game-combo-box']) {
        const el = document.querySelector('.game-stage--wb ' + sel);
        if (!el) continue;
        const b = r(el);
        if (b.w < 1 || b.h < 1) continue;
        const ox = Math.min(PB.r, b.r) - Math.max(PB.l, b.l);
        const oy = Math.min(PB.b, b.b) - Math.max(PB.t, b.t);
        const px = Math.min(ox, oy);
        if (ox > 0 && oy > 0 && px > pillHit.px) pillHit = { px: Math.round(px * 10) / 10, what: sel };
      }
    }

    // (7) RAILS. Whichever card occupies each side track, measured by area. Only
    // meaningful in the rails layout - the phone board stacks and has no rails.
    const cardOf = (side) => {
      const sel = side === 'left'
        ? ['.wb-rail--left .kill-feed', '.game-stage--wb.wb-duo .game-used', '.wb-rail--left > *']
        : ['.wb-rail--right .wb-status', '.game-stage--wb:not(.wb-duo) .game-used', '.wb-rail--right > *'];
      for (const q of sel) {
        const el = document.querySelector(q);
        if (el) {
          const b = r(el);
          if (b.w > 0 && b.h > 0) return { sel: q, area: Math.round(b.w * b.h), b };
        }
      }
      return { sel: '-', area: 0, b: null };
    };
    const leftCard = layout === 'rails' ? cardOf('left') : { sel: 'n/a', area: 0 };
    const rightCard = layout === 'rails' ? cardOf('right') : { sel: 'n/a', area: 0 };
    const railSkew = layout === 'rails' && Math.max(leftCard.area, rightCard.area) > 0
      ? Math.round((Math.abs(leftCard.area - rightCard.area) / Math.max(leftCard.area, rightCard.area)) * 1000) / 10
      : 0;
    // Which side of the stage's centre line each card actually sits on - a rail that
    // is "present" but placed on the wrong side would still read as a dead half.
    const sideOf = (c) => (c.b ? (c.b.l + c.b.r) / 2 < (S.l + S.r) / 2 ? 'L' : 'R' : '-');

    // (8) NAME. Nothing that PAINTS A SOLID BOX on the board may cross a seat's name
    // label. Two deliberate narrowings, both learned from a first pass that cried wolf:
    //   - board objects only (the ring's own subtree + the prompt). The app's full-bleed
    //     effect layers - .game-warmth, .screen-flash, the cursor-trail canvas - intersect
    //     every rect on the page and are not what this is looking for.
    //   - PAINTED boxes only: a fill or a visible border. The bomb's wrapper chain
    //     (.bomb-area/.bomb-rattle/.bomb-passer/.bomb-reactor) and the svg's own box are
    //     transparent and large; their RECTS overlap a nearby name while nothing is drawn
    //     there. Bomb-vs-seat clearance is gated radially instead (minRadialGapPx).
    // What this DOES catch is the class of bug it was written for: the turn-pointer arm,
    // a 12px filled bar that ran under the 12-o'clock seat and read as a glyph struck
    // through the name.
    const paints = (el) => {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor || '';
      const m = bg.match(/rgba?\(([^)]+)\)/);
      const alpha = m ? parseFloat(m[1].split(',')[3] ?? '1') : 0;
      if (alpha > 0.02) return true;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
      const bs = cs.borderStyle;
      return bs && bs !== 'none' && parseFloat(cs.borderTopWidth || '0') > 0;
    };
    const nameStrike = [];
    for (const nameEl of document.querySelectorAll('.wb-seat .game-player-name-text')) {
      const b = r(nameEl);
      if (b.w < 1) continue;
      for (const el of document.querySelectorAll('.wb-ring *, .game-combo-box, .game-combo-box *')) {
        if (el === nameEl || el.contains(nameEl) || nameEl.contains(el)) continue;
        const c = r(el);
        if (c.w < 1 || c.h < 1) continue;
        const ox = Math.min(b.r, c.r) - Math.max(b.l, c.l);
        const oy = Math.min(b.b, c.b) - Math.max(b.t, c.t);
        if (ox > 0.5 && oy > 0.5 && paints(el)) {
          nameStrike.push((el.className && el.className.baseVal !== undefined
            ? el.className.baseVal : String(el.className)).split(' ')[0] || el.tagName);
        }
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
      playCentreOffPctX: round1((Math.abs(pdx) / (playR - playL)) * 100),
      playCentreOffPctY: round1((Math.abs(pdy) / (playB - playT)) * 100),
      layout,
      rowH: {
        head: H ? Math.round(H.h) : 0,
        top: Math.round((document.querySelector('.wb-top') || { offsetHeight: 0 }).offsetHeight),
        bot: Math.round((document.querySelector('.wb-bottombar') || { offsetHeight: 0 }).offsetHeight),
      },
      headerHitPx: headerHit.px,
      headerHitWhat: headerHit.what,
      headToPrompt,
      pillHitPx: pillHit.px,
      pillHitWhat: pillHit.what,
      leftCard: { sel: leftCard.sel, area: leftCard.area, side: sideOf(leftCard) },
      rightCard: { sel: rightCard.sel, area: rightCard.area, side: sideOf(rightCard) },
      railSkewPct: railSkew,
      nameStrike: [...new Set(nameStrike)],
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
        ' | radialGap=' + m.minRadialGapPx + 'px | scroll=' + m.pageVScroll + '/' + m.pageHScroll +
        ' | play-centreOff=' + m.playCentreOffPctX + '%/' + m.playCentreOffPctY + '%' +
        ' | headerHit=' + m.headerHitPx + 'px(' + m.headerHitWhat + ') head->prompt=' + m.headToPrompt + 'px' +
        ' | pillHit=' + m.pillHitPx + 'px(' + m.pillHitWhat + ')' +
        ' | rails[' + m.layout + ']=' + m.leftCard.side + ':' + m.leftCard.area + '(' + m.leftCard.sel + ') ' +
        m.rightCard.side + ':' + m.rightCard.area + '(' + m.rightCard.sel + ') skew=' + m.railSkewPct + '%' +
        ' | nameStrike=' + (m.nameStrike.length ? m.nameStrike.join(',') : 'none') +
        ' | rows head/top/bot=' + m.rowH.head + '/' + m.rowH.top + '/' + m.rowH.bot
      );

      expect(m.seatCount, 'one seat per player').toBe(n);
      expect(m.seatWidthSpread, 'seat width spread (' + m.seatWidths.join(',') + ')').toBeLessThanOrEqual(1);

      // (1) every avatar fully inside the stage
      expect(m.clippedPx, 'avatar/name clipped by the stage (' + m.clippedWhat + ')').toBeLessThanOrEqual(0);
      // (2) the ring's box inside the stage on both axes
      expect(m.ringOutsideStagePx, 'ring box outside the stage').toBeLessThanOrEqual(0);
      // (3) the ring is centred on the PLAY AREA (the board below the header row),
      // with the whole-stage offset kept as a loose backstop against the old failure
      // where the ring slid into a corner.
      expect(m.playCentreOffPctX, 'ring centre X off the PLAY AREA centre (%)').toBeLessThanOrEqual(2);
      expect(m.playCentreOffPctY, 'ring centre Y off the PLAY AREA centre (%)').toBeLessThanOrEqual(2);
      // 10%, not the old 5%, and the reason is structural rather than a loosened bar:
      // the board owes its top edge a ~52px band for the fixed WINS pill and its bottom
      // edge nothing, and it owes a header row at the top with no mirror below. On a
      // 624px-tall board those two alone are 8% before anything has drifted. The claim
      // that actually matters - the ring sits in the middle of the PLAY AREA - is gated
      // at 2% above; this is only a backstop against the original corner failure, where
      // the ring was a third of the board out of place.
      expect(m.centreOffPctX, 'ring centre X off the stage centre (%)').toBeLessThanOrEqual(10);
      expect(m.centreOffPctY, 'ring centre Y off the stage centre (%)').toBeLessThanOrEqual(10);
      // (4) no dead quadrant
      for (const q of m.quadrants) {
        expect(q.area, 'quadrant ' + q.name + ' is empty (biggest object ' + q.sel + ' = ' + q.area + 'px^2)')
          .toBeGreaterThan(900);
      }
      // (5) the ring owns 45-75% of the stage's shorter side
      expect(m.sizePct, 'ring as % of the stage short side').toBeGreaterThanOrEqual(45);
      expect(m.sizePct, 'ring as % of the stage short side').toBeLessThanOrEqual(75);

      // (6) THE HEADER IS NOT ON THE PROMPT. Zero intersection, and a real gap.
      expect(m.headerHitPx, 'header control (' + m.headerHitWhat + ') intersects the prompt box')
        .toBeLessThanOrEqual(0);
      expect(m.headToPrompt, 'gap between the header bottom and the prompt top').toBeGreaterThanOrEqual(12);
      expect(m.pillHitPx, 'the fixed WINS pill covers ' + m.pillHitWhat).toBeLessThanOrEqual(0);

      // (7) BOTH RAILS CARRY WEIGHT (rails layout only - the phone board has no rails).
      if (m.layout === 'rails') {
        expect(m.leftCard.area, 'LEFT rail is empty (' + m.leftCard.sel + ')').toBeGreaterThan(2000);
        expect(m.rightCard.area, 'RIGHT rail is empty (' + m.rightCard.sel + ')').toBeGreaterThan(2000);
        expect(m.leftCard.side, 'the left rail card is not on the left').toBe('L');
        expect(m.rightCard.side, 'the right rail card is not on the right').toBe('R');
        expect(
          m.railSkewPct,
          'rail areas differ by ' + m.railSkewPct + '% (' + m.leftCard.area + ' vs ' + m.rightCard.area + ')'
        ).toBeLessThanOrEqual(35);
      }

      // (8) NOTHING IS DRAWN THROUGH A SEAT'S NAME.
      expect(m.nameStrike, 'board objects painted across a seat name').toEqual([]);

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

test('the numeric readout appears only under 5s, and exactly one seat is lit for the turn', async ({ page }) => {
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

  // TURN OWNERSHIP IS THE LIT SEAT, and nothing else. There was a rotating pointer arm
  // rooted at the bomb; it had to go (see the .wb-pointer note in GameScreen.css - the
  // band it needed is occupied by the 12-o'clock seat's own name, and it painted as a
  // mark struck through that name). So the assertion is the one that survives: exactly
  // ONE seat carries .current, and it is the seat whose turn it is.
  for (const idx of [0, 1, 2, 3]) {
    mock.pushToClient({
      type: 'turn_update',
      payload: {
        currentPlayerId: players[idx].id, players, combo: 'str',
        usedWords: [], timerSeconds: 20, maxLives: 3,
      },
    });
    await page.waitForTimeout(340);
    const lit = await page.evaluate(() =>
      [...document.querySelectorAll('.wb-seat')]
        .map((el, i) => (el.querySelector('.game-player-card.current') ? i : -1))
        .filter((i) => i >= 0)
    );
    // eslint-disable-next-line no-console
    console.log('TURN | seat ' + idx + '/' + players.length + ' -> lit=' + JSON.stringify(lit));
    expect(lit, 'exactly the live seat is lit for turn ' + idx).toEqual([idx]);
  }
  // And the pointer really is gone - not merely hidden behind something.
  await expect(page.locator('.wb-pointer'), 'the turn-pointer arm is removed').toHaveCount(0);
});
