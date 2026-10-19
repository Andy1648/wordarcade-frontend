// e2e/wb-text-overlap.spec.js — no text box on a live Word Bomb board prints over another.
//
// Found live: the first-game coach mark ("TYPE A WORD WITH THESE LETTERS" / "START TYPING")
// drew straight across the LIVE FEED panel at bottom-left at 1280x720 and 1440x900. Spotlight
// placed its caption around INTERACTIVE elements only, and the feed is a plain div, so it was
// invisible to the placement pass. Nothing gated text-on-text, so it shipped.
//
// The gate: on a live turn WITH the first-game coach mark up (the harder case — it is an extra
// text block laid over the board), every visible text box is measured with a Range (the ink's
// own box, not its element's), and no two may overlap by more than 1px on both axes.
// 2 / 4 / 8 players at six windows, phone to 1080p, via the backendMock harness.
//
// WHAT COUNTS AS ONE TEXT BOX:
//   - A text node's Range, CLIPPED to the line box that lays it out (its nearest non-inline
//     ancestor). A Range reports the font's content area, which at line-height:1 in Bungee
//     overhangs the line by ~15% of the font size above and below — "TYPE A WORD CONTAINING"
//     and the 64px "STR" under it "overlapped" by 15px with 0px of ink touching. The line box
//     is what layout actually reserves, and what a player reads as the text's footprint.
//   - The bomb-belly fragment is ONE word printed as four stacked layers in register (shade,
//     fill, inline, outline — .wb-belly-l): they are grouped and never compared with each other.
//   - The .wall-scene graffiti behind the board is aria-hidden BACKGROUND ART, not board text,
//     and is not measured.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'KIMBERLY', 'SAMWISE', 'BARTHOLOMEW', 'ZED', 'PENELOPE', 'MAXIMILIAN'];
const VIEWPORTS = [
  { width: 1280, height: 551 },
  { width: 1280, height: 720 },
  { width: 1366, height: 625 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 }, // H2c: the huge-screen --wb-k tier
  { width: 390, height: 844 },
];

async function enterTurn(page, n) {
  await enterTurnMock(page, n);
}

async function enterTurnMock(page, n = 2) {
  const mock = await installBackendMock(page);
  // Menu seen, but NOT the game spotlight: the first-game coach mark is part of what is gated.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    } catch { /* storage blocked */ }
  });
  await page.goto('/?portal=1');
  await expect.poll(() => mock.connectionAttempts(), { timeout: 15000 }).toBeGreaterThan(0);
  const players = Array.from({ length: n }, (_, i) => ({ id: i ? `p${i + 1}` : ME, name: NAMES[i], lives: 3, isHost: i === 0 }));
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', timerSeconds: 22, maxLives: 3, round: 1, difficultyKey: 'chill', usedWords: ['MONSTER', 'STRAND'], usedAnswers: [] },
  });
  await page.locator('.wb-ring').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(4700); // the 3-2-1-GO! countdown clears, then the coach mark lands
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return mock;
}

function textOverlaps() {
  const root = document.getElementById('root');
  const drawn = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  // One group per word: the belly's stacked chromatic layers share their parent.
  // …and the live prompt's per-letter spans (ComboLive, oct15) are ONE word: under the fragment's skew each letter's
  // box leans ~3px into its neighbour, which is the same word, not a collision.
  const groupOf = (el) => (el.classList.contains('wb-belly-l') ? el.parentElement : el.closest('.wbl') || el);
  const lineBoxOf = (el) => {
    let e = el;
    while (e && e !== root && getComputedStyle(e).display.startsWith('inline') && getComputedStyle(e).display !== 'inline-block') e = e.parentElement;
    return (e || el).getBoundingClientRect();
  };
  const boxes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || el.closest('.wall-scene') || !drawn(el)) continue;
    const line = lineBoxOf(el);
    const range = document.createRange();
    range.selectNodeContents(t);
    for (const raw of range.getClientRects()) {
      const r = {
        left: Math.max(raw.left, line.left),
        right: Math.min(raw.right, line.right),
        top: Math.max(raw.top, line.top),
        bottom: Math.min(raw.bottom, line.bottom),
      };
      if (r.right - r.left < 1 || r.bottom - r.top < 1) continue;
      // Clipped away by the viewport entirely - not on screen.
      if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
      boxes.push({ el, group: groupOf(el), text: t.textContent.trim().slice(0, 32), r });
    }
  }
  const out = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.el === b.el || a.group === b.group) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 1 && oy > 1) {
        out.push({
          a: `${a.el.className || a.el.tagName}: "${a.text}"`,
          b: `${b.el.className || b.el.tagName}: "${b.text}"`,
          px: `${Math.round(ox)}x${Math.round(oy)}`,
        });
      }
    }
  }
  // The coach caption, when it is drawn, must be WHOLE on screen: a caption pushed past the edge
  // has no text box inside the viewport to overlap anything, so the pairwise check alone would pass
  // it. (Hidden = no clear slot on this board; the ring still marks the field.)
  const cap = document.querySelector('.spotlight-caption');
  const capState = !cap ? 'none' : cap.classList.contains('is-hidden') ? 'hidden' : cap.classList.contains('is-compact') ? 'compact' : 'full';
  // …and not across a rail CARD either (LIVE FEED / MATCH / USED WORDS): the reported bug was the
  // caption drawn over the LIVE FEED panel, frame and all, not only over its words.
  let capInside = true;
  const capOnCards = [];
  if (cap && capState !== 'hidden') {
    const c = cap.getBoundingClientRect();
    capInside = c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight;
    for (const card of document.querySelectorAll('.game-stage--wb .kill-feed, .game-stage--wb .wb-status, .game-stage--wb .game-used')) {
      const k = card.getBoundingClientRect();
      if (!k.width || !k.height) continue;
      const ox = Math.min(c.right, k.right) - Math.max(c.left, k.left);
      const oy = Math.min(c.bottom, k.bottom) - Math.max(c.top, k.top);
      if (ox > 1 && oy > 1) capOnCards.push(`${card.className} ${Math.round(ox)}x${Math.round(oy)}`);
    }
  }
  return { count: boxes.length, coach: !!cap, capState, capInside, capOnCards, overlaps: out };
}

for (const n of [2, 4, 8]) {
  for (const vp of VIEWPORTS) {
    test(`WB text boxes, ${n} players @ ${vp.width}x${vp.height}: none overlaps another by >1px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await enterTurn(page, n);
      const m = await page.evaluate(textOverlaps);
      // eslint-disable-next-line no-console
      console.log(`[wb-text-overlap ${n}p ${vp.width}x${vp.height}] boxes=${m.count} caption=${m.capState} overlaps=${m.overlaps.length} ${JSON.stringify(m.overlaps)}`);
      expect(m.coach, 'the first-game coach mark is up (it is part of what is gated)').toBe(true);
      expect(m.capInside, `coach caption (${m.capState}) is wholly inside the viewport`).toBe(true);
      expect(m.capOnCards, 'coach caption drawn across a rail card').toEqual([]);
      expect(m.overlaps, `text-on-text overlaps: ${JSON.stringify(m.overlaps, null, 1)}`).toEqual([]);
    });
  }
}

// LONG WORD vs THE CLOCK (Andy oct17: "part of the word overlaps with the timer in word bomb"). The live prompt shrinks
// the typed word into a fixed row beside the TIME plaque. It used to size that word at a flat 0.82em per letter, and
// W/M run wider (1.04em in the gate's fallback face, 0.85em in Bungee), so a W-heavy word ran ~44px into the plaque on
// every desktop window and off the right edge on phones. Words are typed, not pushed: the prompt's letters, the draft
// store and the CSS fit are all exercised. Every letter of the prompt must clear the plaque's FRAME (not just its
// text — the bug drew letters over the border) and stay inside the viewport.
const LONG_WORDS = ['WOMENSWRESTLINGSHOWDOWN', 'WINDOWSTRAWMANSHOWDOWN']; // fragment absent (appended) / present
for (const vp of [...VIEWPORTS, { width: 360, height: 640 }]) {
  test(`WB long typed word @ ${vp.width}x${vp.height}: clears the TIME plaque and the screen edge`, async ({ page }) => {
    await page.setViewportSize(vp);
    await enterTurn(page, 2);
    for (const word of LONG_WORDS) {
      const input = page.locator('.game-input');
      await input.fill('');
      await input.click({ force: true });
      await page.keyboard.type(word, { delay: 10 });
      await page.waitForTimeout(500); // the last keystrike pop / fragment hit settle
      const m = await page.evaluate(() => {
        const t = document.querySelector('.wb-timer').getBoundingClientRect();
        const hits = [];
        let outside = 0;
        for (const g of document.querySelectorAll('.wbl .g')) {
          const r = g.getBoundingClientRect();
          if (!r.width) continue;
          const ox = Math.min(r.right, t.right) - Math.max(r.left, t.left);
          const oy = Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top);
          if (ox > 1 && oy > 1) hits.push(`${g.textContent} ${Math.round(ox)}x${Math.round(oy)}`);
          if (r.left < -1 || r.right > innerWidth + 1) outside += 1;
        }
        const w = document.querySelector('.wbl').getBoundingClientRect();
        return { letters: document.querySelectorAll('.wbl .g').length, wbl: [Math.round(w.left), Math.round(w.right)], timer: [Math.round(t.left), Math.round(t.right)], hits, outside };
      });
      // eslint-disable-next-line no-console
      console.log(`[wb-long-word ${vp.width}x${vp.height} ${word}] ${JSON.stringify(m)}`);
      expect(m.letters, 'the typed word is drawn in the prompt').toBeGreaterThanOrEqual(word.length);
      expect(m.hits, `prompt letters drawn over the TIME plaque: ${JSON.stringify(m)}`).toEqual([]);
      expect(m.outside, `prompt letters past the screen edge: ${JSON.stringify(m)}`).toBe(0);
    }
  });
}

// THE BOMB'S BELLY IN THE LAST 5 SECONDS (Andy oct19: "the timer for word bomb is overlapping with the rules ... on the
// type word icon in the center"). BombVisual printed the seconds on the mascot's belly at timerSeconds <= 5, exactly
// where the fragment plate (.wb-belly) sits, so the digit peeked out around the fragment. The TIME plaque is the
// readout; the belly carries the fragment and nothing else, on every tick down to 1.
for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`WB bomb belly @ ${vp.width}x${vp.height}: last 5 seconds print nothing over the fragment`, async ({ page }) => {
    await page.setViewportSize(vp);
    const mock = await enterTurnMock(page);
    for (const s of [5, 3, 1]) {
      mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: s } });
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const belly = document.querySelector('.wb-belly').getBoundingClientRect();
        const svgText = [...document.querySelectorAll('.wb-ring svg text')].filter((t) => {
          const r = t.getBoundingClientRect();
          const ox = Math.min(r.right, belly.right) - Math.max(r.left, belly.left);
          const oy = Math.min(r.bottom, belly.bottom) - Math.max(r.top, belly.top);
          return r.width > 0 && ox > 1 && oy > 1;
        }).map((t) => t.textContent);
        return { plaque: document.querySelector('.wb-timer-value').textContent.trim(), svgText };
      });
      expect(m.plaque, 'the TIME plaque carries the seconds').toBe(String(s));
      expect(m.svgText, `text drawn over the bomb-belly fragment at ${s}s`).toEqual([]);
    }
  });
}
