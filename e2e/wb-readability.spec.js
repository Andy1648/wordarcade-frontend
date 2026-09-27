// e2e/wb-readability.spec.js — fix/wb-readability-and-timer GATE.
//
// Six things were measured on a live Word Bomb round at 1341x815 and every one of them
// was a readability failure the existing gates could not see (they assert geometry and
// overlap, never legibility):
//   1 TIMER      the remaining time drove CSS classes ONLY (wall warning/critical, stage
//                draining/heartbeat, the danger vignette). There was no number on the
//                board until the bomb's final 5 seconds, so for 80% of a turn the player
//                could not read how long was left. There is now a readout beside the
//                prompt: a numeral at --fs-h2 plus a depleting bar, off the SAME
//                timerSeconds/maxTimer the classes ride.
//   2 CROWDING   17 of 24 text leaves sat in y350-550 of a 791px stage while y200-350
//                and y550-650 were empty — the duo ring puts both seats on the centre
//                line and both rails were `align-self: center` onto that same line.
//   3 TYPE FLOOR 24 elements rendered at --fs-micro (11px). Micro is decoration-only;
//                anything carrying information is --fs-label (13px) or above.
//   4 GAME OVER  the card was scrollHeight 1353 in clientHeight 759 — 594px hidden,
//                including the whole players list, with REMATCH below the fold.
//   5 CONTRAST   .selected states swapped the BACKGROUND and left the ink: the
//                difficulty button was #1A0B2E on #221640 = 1.11:1.
//   6 PARALLAX   the three .wall-parallax-layer nodes are driven by --mx/--my off a
//                mousemove; this asserts they actually move.
// Plus: .cursor-trail was z-index 9999 and painted dots over the game-over card text.
//
// HARNESS: e2e/support/backendMock.js, the same room_update -> game_started ->
// turn_update path e2e/wb-ring.spec.js and e2e/game-fill.spec.js drive.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const PLAYERS = [
  { id: ME, name: 'YOU', lives: 3, isHost: true },
  { id: 'p2', name: 'RIVAL', lives: 3 },
];
// The board the failures were measured on.
const BOARD = { width: 1341, height: 815 };
// The SHORT laptop window the game-over card has to fit inside without scrolling.
const SHORT = { width: 1366, height: 625 };

async function enterWordBomb(page, { used = ['MONSTER', 'STRAND', 'INSTRUCT'] } = {}) {
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
    payload: {
      currentPlayerId: ME,
      players: PLAYERS,
      combo: 'str',
      timerSeconds: 22,
      maxLives: 3,
      round: 1,
      difficulty: 'chill',
      difficultyKey: 'chill',
      usedWords: used,
      usedAnswers: [],
    },
  });
  await page.locator('.wb-ring').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
  return mock;
}

/**
 * The real server owns the clock and pushes `timer_tick` once a second (App.jsx only
 * ever sets timerSeconds from a frame — it never counts down locally). Drive that.
 */
async function tick(page, mock, secondsRemaining) {
  mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining } });
  await page.waitForTimeout(80);
}

/** Play a handful of words on both seats so the game-over card has real content. */
async function playWords(page, mock) {
  const script = [
    [ME, 'STRAND'],
    ['p2', 'INSTRUCT'],
    [ME, 'STRONGEST'],
    ['p2', 'ASTRAY'],
  ];
  for (const [who, word] of script) {
    mock.pushToClient({
      type: 'turn_update',
      payload: {
        currentPlayerId: who, players: PLAYERS, combo: 'str', timerSeconds: 22,
        maxLives: 3, round: 1, difficultyKey: 'chill', usedWords: [], usedAnswers: [],
      },
    });
    await page.waitForTimeout(40);
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word } });
    await page.waitForTimeout(40);
  }
  mock.pushToClient({
    type: 'life_lost',
    payload: { reason: 'timeout', players: PLAYERS.map((p) => (p.id === 'p2' ? { ...p, lives: 2 } : p)) },
  });
  await page.waitForTimeout(60);
}

/* ---------------------------------------------------------------------------
   The shared in-page helpers. Kept as one source string so every measurement
   below agrees on what "a text leaf" and "the effective background" mean.
   --------------------------------------------------------------------------- */
const HELPERS = `
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // A TEXT LEAF: an element with no element children that renders non-empty text.
  const textLeaves = (root) => [...root.querySelectorAll('*')].filter((el) => {
    if (el.children.length) return false;
    if (!(el.textContent || '').trim()) return false;
    return vis(el);
  });
  // Decoration exemptions for the type floor: the graffiti/wall art and anything
  // hidden from the accessibility tree carries no information.
  const decorative = (el) =>
    !!el.closest('[aria-hidden="true"], .wall-scene, .particle-field, .cursor-trail, .reaction-layer');
  const srgb = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = (s) => {
    const m = (s || '').match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((n) => parseFloat(n));
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  // The nearest ancestor background that is actually opaque — what the ink really sits on.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const p = parse(getComputedStyle(n).backgroundColor);
      if (p && p.a >= 0.95) return p.rgb;
      n = n.parentElement;
    }
    return [13, 6, 24];
  };
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
`;

/* =========================================================================
   1 + 3 — THE TIMER READOUT and THE 13px TYPE FLOOR
   ========================================================================= */
test.describe('Word Bomb board readability', () => {
  test.use({ viewport: BOARD });

  test('a countdown is on the board, legible, and it counts down', async ({ page }) => {
    const mock = await enterWordBomb(page);
    await tick(page, mock, 22);

    const readout = page.locator('.wb-timer');
    await expect(readout).toBeVisible();

    // It is set at --fs-h2 or larger (the brief's floor), not a micro label.
    const size = await readout.locator('.wb-timer-value').evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize)
    );
    expect(size, `countdown numeral is ${size}px`).toBeGreaterThanOrEqual(24);

    // It sits beside the prompt card, not somewhere else on the board.
    const near = await page.evaluate(() => {
      const t = document.querySelector('.wb-timer').getBoundingClientRect();
      const p = document.querySelector('.game-combo-punch').getBoundingClientRect();
      const gapX = Math.max(0, Math.max(t.left - p.right, p.left - t.right));
      const overlapY = Math.min(t.bottom, p.bottom) - Math.max(t.top, p.top);
      return { gapX, overlapY };
    });
    expect(near.gapX, 'countdown is adjacent to the prompt card').toBeLessThan(80);
    expect(near.overlapY, 'countdown shares the prompt card\'s band').toBeGreaterThan(0);

    // ...and the value CHANGES between two samples a second apart (the server owns
    // the clock, so the tick is pushed exactly as the real backend pushes it).
    const a = await readout.locator('.wb-timer-value').textContent();
    await page.waitForTimeout(1000);
    await tick(page, mock, 21);
    const b = await readout.locator('.wb-timer-value').textContent();
    console.log(`[wb-readability] countdown samples 1s apart: "${a}" -> "${b}" (numeral ${size}px)`);
    expect(Number.isFinite(Number(a)), `first sample "${a}" is a number`).toBe(true);
    expect(b, `countdown moved ${a} -> ${b}`).not.toBe(a);
    expect(Number(b)).toBeLessThan(Number(a));

    // The depleting bar rides the same state.
    const fill = await page.locator('.wb-timer-fill').evaluate((el) => getComputedStyle(el).transform);
    expect(fill, 'the bar carries a scale transform').not.toBe('none');
  });

  test('no element on the board carries information below 13px', async ({ page }) => {
    await enterWordBomb(page);
    const small = await page.evaluate(`(() => {
      ${HELPERS}
      const wrap = document.querySelector('.game-wrap--wb');
      return textLeaves(wrap)
        .filter((el) => !decorative(el))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13)
        .map((el) => ({
          cls: el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className),
          px: parseFloat(getComputedStyle(el).fontSize),
          text: (el.textContent || '').trim().slice(0, 24),
        }));
    })()`);
    // Printed on every run: "0" is the acceptance number and it should be visible in
    // the log, not inferred from a green tick.
    console.log(`[wb-readability] under-13px leaves on the board: ${small.length}`, JSON.stringify(small));
    expect(small, `under-13px leaves: ${JSON.stringify(small)}`).toHaveLength(0);
  });

  test('the board is not a single crowded centre stripe', async ({ page }) => {
    await enterWordBomb(page);
    const bands = await page.evaluate(`(() => {
      ${HELPERS}
      const stage = document.querySelector('.game-stage--wb');
      const sr = stage.getBoundingClientRect();
      const n = Math.ceil(sr.height / 50);
      const counts = new Array(n).fill(0);
      for (const el of textLeaves(stage)) {
        if (decorative(el)) continue;
        const r = el.getBoundingClientRect();
        const i = Math.floor(((r.top + r.bottom) / 2 - sr.top) / 50);
        if (i >= 0 && i < n) counts[i] += 1;
      }
      const total = counts.reduce((a, b) => a + b, 0);
      return { counts, bands: n, max: Math.max(...counts), empty: counts.filter((c) => c === 0).length, total };
    })()`);
    console.log(
      `[wb-readability] stage bands=${bands.bands} leaves=${bands.total} busiest=${bands.max} empty=${bands.empty}`,
      JSON.stringify(bands.counts)
    );
    // MEASURED at 1341x815 (16 bands, 26 leaves):
    //   before  busiest 17, empty 8   (the user's live-round measurement: 17 of 24)
    //   after   busiest  4, empty 4
    // The bars are set just above the measured values, so a future change that pulls
    // the board back onto one stripe fails here rather than passing a geometry gate.
    expect(bands.max, `bands=${JSON.stringify(bands)}`).toBeLessThanOrEqual(6);
    expect(bands.empty, `empty bands ${bands.empty} of ${bands.bands}`).toBeLessThanOrEqual(6);
  });

  test('nothing on the board overlaps another element box', async ({ page }) => {
    await enterWordBomb(page);
    const hits = await page.evaluate(`(() => {
      ${HELPERS}
      const stage = document.querySelector('.game-stage--wb');
      // The blocks that own their own band. Seats are covered by wb-ring.spec.js.
      const sel = ['.game-header', '.game-combo-box', '.wb-timer', '.wb-ring', '.game-used', '.wb-status', '.wb-bottombar'];
      const boxes = sel
        .map((s) => ({ s, el: stage.querySelector(s) }))
        .filter((b) => b.el && vis(b.el))
        .map((b) => ({ s: b.s, r: b.el.getBoundingClientRect() }));
      const out = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i].r, b = boxes[j].r;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 1 && oy > 1) out.push(boxes[i].s + ' x ' + boxes[j].s + ' = ' + Math.round(ox) + 'x' + Math.round(oy));
        }
      }
      return out;
    })()`);
    expect(hits, `overlaps: ${hits.join(' | ')}`).toHaveLength(0);
  });
});

/* =========================================================================
   4 — THE GAME-OVER CARD FITS THE WINDOW
   ========================================================================= */
test.describe('Word Bomb game-over card', () => {
  for (const vp of [SHORT, BOARD, { width: 1920, height: 1080 }]) {
    test(`fits ${vp.width}x${vp.height} with no scrollbar`, async ({ page }) => {
      await page.setViewportSize(vp);
      const mock = await enterWordBomb(page);
      // A FULL card, not an empty one: gameStats is accumulated client-side from
      // word_result frames (App.jsx), so the HIGHLIGHTS + PLAYERS blocks only exist
      // if words were actually played. Measuring an empty card proves nothing.
      await playWords(page, mock);
      mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
      await expect(page.locator('.game-over-card')).toBeVisible();
      await page.waitForTimeout(900); // let the stagger / count-ups settle

      const m = await page.evaluate(() => {
        const c = document.querySelector('.game-over-card');
        const actions = document.querySelector('.game-over-actions');
        return {
          over: c.scrollHeight - c.clientHeight,
          scrollH: c.scrollHeight,
          clientH: c.clientHeight,
          actionsBottom: actions ? actions.getBoundingClientRect().bottom : null,
          cardBottom: c.getBoundingClientRect().bottom,
          vh: window.innerHeight,
        };
      });
      console.log(`[wb-readability] game-over ${vp.width}x${vp.height}: scrollHeight ${m.scrollH} - clientHeight ${m.clientH} = ${m.over}`);
      expect(m.over, `hidden px: ${JSON.stringify(m)}`).toBe(0);
      // REMATCH / LEAVE are above the fold.
      expect(m.actionsBottom).toBeLessThanOrEqual(m.vh);
    });
  }

  test('the cursor trail never paints over the game-over card', async ({ page }) => {
    await page.setViewportSize(SHORT);
    const mock = await enterWordBomb(page);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await expect(page.locator('.game-over-card')).toBeVisible();
    const z = await page.evaluate(() => {
      const t = document.querySelector('.cursor-trail');
      const o = document.querySelector('.game-over-overlay');
      const zi = (el) => (el ? getComputedStyle(el).zIndex : null);
      return { trail: zi(t), overlay: zi(o), mounted: !!t };
    });
    if (z.mounted) {
      expect(Number(z.trail), `trail z=${z.trail} overlay z=${z.overlay}`).toBeLessThan(Number(z.overlay));
    }
  });
});

/* =========================================================================
   5 — SELECTED / ACTIVE STATES KEEP THEIR CONTRAST
   ========================================================================= */
test('every .selected / .active control clears 4.5:1', async ({ page }) => {
  await page.setViewportSize(BOARD);
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

  const audit = async (where) =>
    page.evaluate(`(() => {
      ${HELPERS}
      const out = [];
      for (const el of document.querySelectorAll('.selected, .active, .is-active, .is-selected')) {
        if (!vis(el)) continue;
        // Only elements that render their OWN text: a wrapper inherits a colour it
        // never paints, and scoring that is scoring nothing.
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own && !el.children.length) continue;
        if (!own) continue;
        const cs = getComputedStyle(el);
        const fg = parse(cs.color);
        if (!fg) continue;
        out.push({ where: 'self', cls: String(el.className).slice(0, 48), r: Math.round(ratio(fg.rgb, bgOf(el)) * 100) / 100, fg: cs.color });
      }
      // ...plus every text LEAF inside one, which is where the real failures hide
      // (a .selected button whose sub-label keeps the colour tuned for the old fill).
      for (const host of document.querySelectorAll('.selected, .active, .is-active, .is-selected')) {
        if (!vis(host)) continue;
        for (const el of textLeaves(host)) {
          const cs = getComputedStyle(el);
          const fg = parse(cs.color);
          if (!fg) continue;
          out.push({ where: 'leaf', cls: String(el.className).slice(0, 48), r: Math.round(ratio(fg.rgb, bgOf(el)) * 100) / 100, fg: cs.color });
        }
      }
      return out;
    })()`).then((rows) => rows.map((r) => ({ ...r, where })));

  const all = [];

  // THE ROOM SCREEN — both selected-state button rows (game type + difficulty). It is
  // reached by a room_update naming us as host, the same frame the real server sends.
  mock.pushToClient({
    type: 'room_update',
    payload: {
      code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill',
      players: [{ id: ME, name: 'YOU', isHost: true }],
    },
  });
  await page.locator('.room-difficulty-btn.selected').first().waitFor({ state: 'visible', timeout: 15000 });
  all.push(...(await audit('room')));

  // THE STATS SCREEN — .stats-tab.is-active.
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.locator('.homepage-nav-btn.is-stats').click();
  await page.locator('.stats-tab.is-active').first().waitFor({ state: 'visible', timeout: 15000 });
  all.push(...(await audit('stats')));

  all.sort((a, b) => a.r - b.r);
  console.log('[wb-readability] selected/active contrast (worst first):', JSON.stringify(all.slice(0, 8)));
  expect(all.length, 'found selected/active controls to audit').toBeGreaterThan(0);
  expect(all[0].r, `worst: ${JSON.stringify(all.slice(0, 5))}`).toBeGreaterThanOrEqual(4.5);
});

/* =========================================================================
   6 — THE PARALLAX LAYERS ACTUALLY MOVE
   ========================================================================= */
test.describe('wall parallax', () => {
  // The suite runs reduced-motion globally; parallax is (correctly) off there, so
  // this one test opts back into real motion to prove the layers are wired.
  test.use({ reducedMotion: 'no-preference', viewport: BOARD });

  test('mousemove drives all three .wall-parallax-layer nodes', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.locator('.wall-scene.parallax-on').waitFor({ state: 'attached', timeout: 10000 });

    const read = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.wall-parallax-layer')].map(
          (el) => getComputedStyle(el).transform
        )
      );

    await page.mouse.move(80, 80);
    await page.waitForTimeout(700);
    const a = await read();
    await page.mouse.move(BOARD.width - 80, BOARD.height - 80);
    await page.waitForTimeout(700);
    const b = await read();

    console.log('[wb-readability] parallax transforms A:', JSON.stringify(a), 'B:', JSON.stringify(b));
    expect(a).toHaveLength(3);
    for (let i = 0; i < 3; i += 1) {
      expect(a[i], `layer ${i} has a transform`).not.toBe('none');
      expect(b[i], `layer ${i} moved: ${a[i]} -> ${b[i]}`).not.toBe(a[i]);
    }
  });
});
