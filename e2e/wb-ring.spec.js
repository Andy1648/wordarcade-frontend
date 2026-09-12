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
//   9) NOCLIP   no rail card clips its own content: scrollHeight <= clientHeight, and
//               every text-bearing box inside it sits fully within the card. The rails
//               shared a height that was a FRACTION OF THE RING (0.44d) rather than
//               anything to do with their contents, so USED WORDS (5) drew a chip sliced
//               through the middle and MATCH cut MODE off the bottom - at a perfect 0%
//               area skew, because two equally-wrong boxes are still equal.
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
      // SEVEN, not four. The rails clipped at FIVE on the preview, and the old fixture
      // could not reach that state - the shot that was reviewed showed a column with room
      // to spare. A fixture that cannot produce the failure is not a gate.
      usedWords: ['MONSTER', 'STRIKE', 'ASTRAY', 'BISTRO', 'MINSTREL', 'ROSTRUM', 'STRIDE'],
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
    const px = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
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
      ['sound', '.audio-ctrl--inline'],
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
      for (const sel of ['.game-title', '.game-leave-btn', '.audio-ctrl--inline']) {
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
    //
    // GENERALISED FROM THE WINS PILL TO EVERY ORPHAN. The first version of this gate named
    // `.wins-hud` and nothing else, so it passed at 390x844 and 320x640 on a board where a
    // DIFFERENT fixed element - the 44x44 bottom-right sound control - sat 20px on top of the SKIP
    // button, which costs a life. Naming one orphan cannot catch the next one; CLAUDE.md's rule is
    // that a fixed element with no layout relationship to the page will eventually collide with
    // whatever ends up beneath it, so the gate now enumerates EVERY position:fixed element and
    // checks all of them. Full-screen layers (vignette, flash, particle field) are excluded by
    // area - they are meant to cover the board and are pointer-events:none.
    let pillHit = { px: 0, what: '-' };
    const TARGETS = [
      '.game-title', '.game-leave-btn', '.game-combo-box', '.game-used',
      '.game-input', '.game-send-btn', '.game-skip-btn', '.wb-status', '.kill-feed',
      '.audio-ctrl--inline',
    ];
    const vpArea = window.innerWidth * window.innerHeight;
    const orphans = [...document.querySelectorAll('body *')].filter((e) => {
      if (getComputedStyle(e).position !== 'fixed') return false;
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.width * b.height < vpArea * 0.4;
    });
    for (const o of orphans) {
      const ob = r(o);
      // Hard offset shadows are not in the rect; every one of these carries up to 4px.
      const OB = { l: ob.l, t: ob.t, r: ob.r + 4, b: ob.b + 4 };
      const oname = (typeof o.className === 'string' && o.className.trim())
        ? '.' + o.className.trim().split(/\s+/)[0] : o.tagName.toLowerCase();
      for (const sel of TARGETS) {
        for (const el of document.querySelectorAll('.game-stage ' + sel)) {
          if (o === el || o.contains(el) || el.contains(o)) continue;
          const b = r(el);
          if (b.w < 1 || b.h < 1) continue;
          const ox = Math.min(OB.r, b.r) - Math.max(OB.l, b.l);
          const oy = Math.min(OB.b, b.b) - Math.max(OB.t, b.t);
          const px = Math.min(ox, oy);
          if (ox > 0 && oy > 0 && px > pillHit.px) {
            pillHit = { px: Math.round(px * 10) / 10, what: oname + ' on ' + sel };
          }
        }
      }
    }

    // (10) LABEL FIT. Every text box on the board holds its own text.
    // WHY THIS EXISTS: three separate label overflows shipped past a full board gate this week --
    // SEND rendered 45px of text in a 40px inner box (the D sliced off) because the buttons took
    // flex's default `0 1 auto` and the row squeezed them; the input's placeholder read "TYPE A
    // WORI" at 320x640; the prompt once did the same. Every one of them was invisible to the
    // geometry gates above, because a clipped label does not move, overlap or resize anything --
    // the box is exactly where it should be and the TEXT is what does not fit. scrollWidth catches
    // it for real content; a placeholder is not content, so it is measured on a canvas at its own
    // computed ::placeholder size.
    const labelFit = [];
    for (const sel of ['.game-send-btn', '.game-skip-btn', '.game-leave-btn', '.game-used-chip',
                       '.game-used-label', '.wb-status-row', '.kill-feed-title', '.game-meta-round',
                       '.game-meta-diff', '.game-combo-label', '.seat-name']) {
      for (const el of document.querySelectorAll('.game-stage--wb ' + sel)) {
        if (getComputedStyle(el).overflow !== 'visible') continue; // an intentional scroller
        const over = el.scrollWidth - el.clientWidth;
        if (over > 1) labelFit.push(sel + ' +' + over + 'px');
      }
    }
    {
      const inp = document.querySelector('.game-stage--wb .game-input');
      if (inp) {
        const cs = getComputedStyle(inp);
        const ps = getComputedStyle(inp, '::placeholder');
        const c = document.createElement('canvas').getContext('2d');
        c.font = ps.fontWeight + ' ' + ps.fontSize + ' ' + ps.fontFamily;
        const inner = inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        // BOTH strings, not just the live one: the field swaps between them every turn and the
        // shot only ever catches one. The longest wins.
        // THE LIVE STRING, in the live box.
        const live = inp.getAttribute('placeholder') || '';
        const liveOver = Math.round(c.measureText(live).width - inner);
        if (liveOver > 0) labelFit.push('placeholder "' + live + '" +' + liveOver + 'px');
        // ...AND THE OTHER SIDE OF THE TURN, which no shot on this board can catch because every
        // board test enters on ME's turn. When the turn passes, SKIP leaves the row and the field
        // takes back exactly its width plus the row gap — so the waiting box is computable, not a
        // guess, and "WAIT YOUR TURN…" is checked against it.
        const skipEl = document.querySelector('.game-stage--wb .game-skip-btn');
        if (skipEl) {
          const row = inp.parentElement;
          const gap = row ? (parseFloat(getComputedStyle(row).columnGap) || 0) : 0;
          const waitInner = inner + skipEl.getBoundingClientRect().width + gap;
          const over = Math.round(c.measureText('WAIT YOUR TURN…').width - waitInner);
          if (over > 0) labelFit.push('placeholder "WAIT YOUR TURN…" (off-turn box) +' + over + 'px');
        }
      }
    }

    // (11) NAMES DO NOT COLLIDE. Every seat's name label against every OTHER seat's name and
    // avatar. The existing clip/overlap gates work on `.wb-seat` boxes and on the pairs listed in
    // the overlap matrix, and the name is an out-of-flow child hanging BELOW its seat -- so eight
    // labels drawn on top of each other and through the 12 o'clock avatar at 320x640 scored a
    // perfect 0px everywhere. Screenshot found it; this finds it next time.
    const nameHits = [];
    {
      const labels = [...document.querySelectorAll('.wb-seat .game-player-name-text')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, seat: el.closest('.wb-seat'), b: r(el), t: (el.textContent || '').trim() }))
        .filter((x) => x.b.w > 0 && x.b.h > 0);
      // NAMES GET A GAP, NOT A TOLERANCE. The board's general overlap tolerance is 4px, which is
      // right for decorative boxes that sit near each other -- and wrong here: the pre-fix 320x640
      // board had ANDY's label crossing PLAYER1's by exactly 2px of BOX and reading, on screen, as
      // one word drawn through another, because stroked 13px Bungee-adjacent type fills its box to
      // the edge and then some. Two labels must be 2px APART, not merely not-overlapping.
      const NAME_GAP = 2;
      const hit = (a, b) => {
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        return ox > -NAME_GAP && oy > -NAME_GAP ? Math.round(Math.min(ox, oy)) : 0;
      };
      for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
          const px = hit(labels[i].b, labels[j].b);
          if (px) nameHits.push(labels[i].t + '/' + labels[j].t + ' ' + px + 'px');
        }
        for (const card of document.querySelectorAll('.wb-seat .game-player-card')) {
          if (labels[i].seat && labels[i].seat.contains(card)) continue;
          const px = hit(labels[i].b, r(card));
          if (px) nameHits.push(labels[i].t + '/avatar ' + px + 'px');
        }
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

    // (9) NOCLIP. Two questions per rail card, because they fail differently: does the
    // card overflow its own box (a trimmed list, a squeezed row), and does any single
    // box inside it stick out (one chip half-drawn at the bottom edge)? The first is
    // scrollHeight; the second is the rects, which is what actually catches a sliced
    // chip when the list has been shrunk to fit rather than overflowing.
    const railClip = [];
    for (const sel of ['.game-used', '.kill-feed', '.wb-status']) {
      for (const card of document.querySelectorAll('.game-stage--wb ' + sel)) {
        const cb = r(card);
        if (cb.w < 1 || cb.h < 1) continue;
        const over = card.scrollHeight - card.clientHeight;
        if (over > 1) railClip.push(sel + ' overflows by ' + Math.round(over) + 'px');
        const ccs = getComputedStyle(card);
        const inner = {
          t: cb.t + px(ccs.borderTopWidth) + px(ccs.paddingTop),
          b: cb.b - px(ccs.borderBottomWidth) - px(ccs.paddingBottom),
          l: cb.l + px(ccs.borderLeftWidth) + px(ccs.paddingLeft),
          rr: cb.r - px(ccs.borderRightWidth) - px(ccs.paddingRight),
        };
        for (const kid of card.querySelectorAll(
          '.game-used-chip, .game-used-label, .game-used-empty, .kill-feed-row,' +
          ' .kill-feed-title, .kill-feed-empty, .wb-status-row, .wb-status-title'
        )) {
          const kb = r(kid);
          if (kb.w < 1 || kb.h < 1) continue;
          const out = Math.max(inner.t - kb.t, kb.b - inner.b, inner.l - kb.l, kb.r - inner.rr);
          if (out > 1) {
            railClip.push(
              sel + ' cuts ' + (kid.className.split(' ')[0]) +
              ' ("' + (kid.textContent || '').trim().slice(0, 14) + '") by ' + Math.round(out) + 'px'
            );
          }
        }
      }
    }

    // How much board is left between each rail card and the ring. Centred rails put ~100px
    // of dead gutter on both sides of every card; the board is meant to read as one row.
    const gutter = (() => {
      if (layout !== 'rails') return null;
      const l = document.querySelector('.game-stage--wb.wb-duo .game-used')
        || document.querySelector('.wb-rail--left .kill-feed');
      const rt = document.querySelector('.wb-rail--right .wb-status')
        || document.querySelector('.game-stage--wb:not(.wb-duo) .game-used');
      if (!l || !rt) return null;
      return {
        left: Math.round(R.l - r(l).r),
        right: Math.round(r(rt).l - R.r),
      };
    })();

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
      labelFit,
      nameHits: [...new Set(nameHits)],
      pillHitPx: pillHit.px,
      pillHitWhat: pillHit.what,
      leftCard: { sel: leftCard.sel, area: leftCard.area, side: sideOf(leftCard) },
      rightCard: { sel: rightCard.sel, area: rightCard.area, side: sideOf(rightCard) },
      railSkewPct: railSkew,
      railClip,
      gutter,
      railDbg: (() => {
        const u = document.querySelector('.game-stage--wb .game-used');
        const st = document.querySelector('.game-stage--wb .wb-status');
        const f = document.querySelector('.game-stage--wb .kill-feed');
        const d = (el) => (el ? el.clientHeight + '/' + el.scrollHeight : '-');
        return 'railh=' + getComputedStyle(stage).getPropertyValue('--wb-railh').trim() +
          ' used=' + d(u) + '(' + document.querySelectorAll('.game-used-chip').length + 'chips)' +
          ' status=' + d(st) + ' feed=' + d(f);
      })(),
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
        ' | nameHits=' + (m.nameHits.length ? m.nameHits.join(',') : 'none') +
        ' | labelFit=' + (m.labelFit.length ? m.labelFit.join(',') : 'none') +
        ' | orphanHit=' + m.pillHitPx + 'px(' + m.pillHitWhat + ')' +
        ' | rails[' + m.layout + ']=' + m.leftCard.side + ':' + m.leftCard.area + '(' + m.leftCard.sel + ') ' +
        m.rightCard.side + ':' + m.rightCard.area + '(' + m.rightCard.sel + ') skew=' + m.railSkewPct + '%' +
        ' | railClip=' + (m.railClip.length ? m.railClip.join(' ; ') : 'none') +
        ' | ' + m.railDbg +
        ' | gutter=' + (m.gutter ? m.gutter.left + '/' + m.gutter.right : 'n/a') +
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
      // (11) no seat name is drawn through another seat's name or avatar
      expect(m.nameHits, 'seat name labels collide').toEqual([]);
      // (10) nothing on the board clips its own label
      expect(m.labelFit, 'a label does not fit its own box').toEqual([]);
      expect(m.pillHitPx, 'a fixed/orphan element covers a board control: ' + m.pillHitWhat).toBeLessThanOrEqual(0);

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

        // ...and the rails sit AGAINST the ring, not marooned at the board's edges.
        expect(m.gutter.left, 'gutter between the left rail and the ring').toBeLessThanOrEqual(40);
        expect(m.gutter.right, 'gutter between the ring and the right rail').toBeLessThanOrEqual(40);
      }

      // (8) NOTHING IS DRAWN THROUGH A SEAT'S NAME.
      expect(m.nameStrike, 'board objects painted across a seat name').toEqual([]);

      // (9) NOTHING CLIPS ITS OWN CONTENT - in BOTH layouts. The phone stack's used-word
      // strip is a wrapping row rather than a rail card, and it failed the same way:
      // `nowrap` sliced the last chip through the middle of the word.
      expect(m.railClip, 'a card clips its own content').toEqual([]);

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
