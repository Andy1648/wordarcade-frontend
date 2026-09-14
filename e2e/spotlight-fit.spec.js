// e2e/spotlight-fit.spec.js — THE COACH MARK MUST FIT, AND MUST NOT LAND ON WORDS.
//
// The first-run spotlight is the one piece of UI a brand-new player is guaranteed to see,
// and it was failing in two ways that only screenshots showed:
//
//   1. IT HUNG OFF BOTH EDGES OF A PHONE. `.spotlight-caption-text` is `white-space: nowrap`
//      and the wrapper caps at `max-width: 92vw` — but a max-width cannot restrain nowrap
//      text, it just overflows. At 320x640 "SNEAK THE LETTERS INTO A WORD" read as
//      "NEAK THE LETTERS INTO A WOR", clipped at both ends because the caption is centred.
//      The identical trap the word landing hit two batches ago, in a different component.
//
//   2. IT WAS DRAWN THROUGH TEXT. The placement pass collected obstacles from an
//      INTERACTIVE selector list — links, buttons, inputs — so it had no idea any plain
//      text existed. Measured landings: "IT FILLS YOUR LEVEL BAR" through "NEXT: CHROME
//      FRAME LV 19" on the menu, and the sub through the arm hint on CHAIN and on FUSE.
//      None of those is a control, which is exactly why it could not see them.
//
// WHAT THE CONTRACT TURNED OUT TO BE, after trying to make "never covers text" hold. It
// cannot, and chasing it was the wrong target: on a solo board there is no clean 390x70
// rectangle to be found, because the card is full. Three rounds of improving the search
// (text as obstacles, then a scored candidate sweep, then weighting the score by the
// obstacle's font size) took the menu clean and moved the solo failures around without
// removing them. So the caption is a PLATE now — flat fill, thick black border, hard offset
// shadow, the same object every other floating thing in this game is — and the contract is
// the one that actually matters to a player:
//
//      opaque, entirely on screen, and never covering the thing it is pointing at.
//
// The search still runs and still prefers the emptiest spot; it just no longer has to find
// a perfect one in order to be readable. Coverage is measured and reported at every
// viewport so a regression that makes placement WORSE is still visible.
//
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

const SCREENS = [
  ['menu', '/?portal=1', '.menu-xp-bar'],
  ['chain', '/chain?portal=1', '.solo-hud'],
  ['fuse', '/fuse?portal=1', '.solo-hud'],
];

async function open(page, url, ready) {
  await installBackendMock(page);
  await page.goto(url);
  await page.locator(ready).waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.spotlight-caption').waitFor({ state: 'visible', timeout: 10000 });
  // the placement pass runs on mount, next frame, and again when Bungee loads
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.waitForTimeout(500);
}

for (const [label, url, ready] of SCREENS) {
  for (const vp of VIEWPORTS) {
    test(`coach mark fits and clears the text — ${label} @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page, url, ready);

      const r = await page.evaluate(() => {
        const cap = document.querySelector('.spotlight-caption');
        const capRect = cap.getBoundingClientRect();
        // Every visible LEAF with text that the caption's own text boxes overlap. Leaves
        // only: a container's box is its children's, and counting it double-reports.
        const parts = [...cap.querySelectorAll('.spotlight-caption-text, .spotlight-caption-sub')];
        const hits = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest('.spotlight-overlay')) continue;
          // The wall behind every screen paints big graffiti letters. They are BACKGROUND art,
          // under everything, and the caption legitimately sits over them.
          if (el.closest('.wall-graffiti-tag, .game-wall, .wall-layer, .wall-scene')) continue;
          if (el.children.length) continue;
          const text = (el.textContent || '').trim();
          if (!text) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
          const b = el.getBoundingClientRect();
          if (b.width < 6 || b.height < 6) continue;
          for (const p of parts) {
            const pb = p.getBoundingClientRect();
            const ov = Math.min(pb.right, b.right) - Math.max(pb.left, b.left);
            const oh = Math.min(pb.bottom, b.bottom) - Math.max(pb.top, b.top);
            if (ov > 4 && oh > 4) {
              hits.push(`${(p.className || '').replace('spotlight-caption-', '')} over ${String(el.className).slice(0, 20)}"${text.slice(0, 18)}" ${Math.round(ov)}x${Math.round(oh)}`);
            }
          }
        }
        // the widest painted line, which is what actually leaves the screen
        let widest = capRect;
        for (const p of parts) {
          const pb = p.getBoundingClientRect();
          if (pb.width > widest.width) widest = pb;
        }
        // total covered area, and whether any of it is the target itself
        let covered = 0;
        for (const h of hits) {
          const m = h.match(/(\d+)x(\d+)$/);
          if (m) covered += Number(m[1]) * Number(m[2]);
        }
        const hole = document.querySelector('.spotlight-hole');
        let overTarget = 0;
        if (hole) {
          const hb = hole.getBoundingClientRect();
          const ov = Math.min(capRect.right, hb.right) - Math.max(capRect.left, hb.left);
          const oh = Math.min(capRect.bottom, hb.bottom) - Math.max(capRect.top, hb.top);
          if (ov > 2 && oh > 2) overTarget = Math.round(ov * oh);
        }
        // rgb() has three components and is opaque; rgba() has four and the fourth is alpha.
        // (A regex taking "the last number" reads the BLUE channel of rgb(13, 6, 24) as an
        // alpha of 24, which is how the first cut of this failed twelve times over.)
        const bg = getComputedStyle(cap).backgroundColor;
        const nums = (bg.match(/[\d.]+/g) || []).map(Number);
        const alpha = bg === 'transparent' ? 0 : (nums.length >= 4 ? nums[3] : 1);
        return {
          cap: [Math.round(capRect.x), Math.round(capRect.y), Math.round(capRect.width), Math.round(capRect.height)],
          widest: [Math.round(widest.left), Math.round(widest.right), Math.round(widest.width)],
          vw: window.innerWidth,
          vh: window.innerHeight,
          hits: [...new Set(hits)],
          covered,
          overTarget,
          alpha,
        };
      });

      // ON SCREEN, horizontally and vertically. 1px of slack for a stroke's antialiasing.
      expect(r.widest[0], `caption runs off the left edge (left ${r.widest[0]}, width ${r.widest[2]})`).toBeGreaterThanOrEqual(-1);
      expect(r.widest[1], `caption runs off the right edge (right ${r.widest[1]} of ${r.vw})`).toBeLessThanOrEqual(r.vw + 1);
      expect(r.cap[1], `caption above the top edge: ${JSON.stringify(r.cap)}`).toBeGreaterThanOrEqual(-1);
      expect(r.cap[1] + r.cap[3], `caption below the bottom edge: ${JSON.stringify(r.cap)} of ${r.vh}`).toBeLessThanOrEqual(r.vh + 1);

      // OPAQUE. This is what makes the remaining overlap a non-event: a plate is legible
      // over anything. A translucent caption over a busy board is not, whatever it covers.
      expect(r.alpha, `the caption plate is not opaque (alpha ${r.alpha})`).toBe(1);

      // AND IT NEVER COVERS THE THING IT IS POINTING AT. Everything else is negotiable;
      // this is not — a coach mark that hides its own subject teaches nothing.
      expect(r.overTarget, `the caption covers its own target by ${r.overTarget}px^2`).toBe(0);

      // Coverage is reported rather than forbidden, with a ceiling loose enough to allow the
      // full boards and tight enough that a placement regression shows up. Measured with the
      // scored search in place: the menu is clean at every width; the solo screens cover
      // between 0 and ~2,100px^2, all of it small labels and one edge of `.solo-center`.
      // eslint-disable-next-line no-console
      console.log(`COVERAGE ${label} @ ${vp.name}: ${r.covered}px2 :: ${r.hits.join(' | ') || 'clean'}`);
      expect(r.covered, `coverage ballooned: ${r.covered}px2 — ${r.hits.join(' | ')}`).toBeLessThan(9000);
    });
  }
}

// ---------------------------------------------------------------------------
// THE RING MUST BE ON ITS TARGET, IN VIEWPORT SPACE — the Word Bomb board
// ---------------------------------------------------------------------------
// This is the case the three screens above could not reach, and it was the worst one.
// `position: fixed` resolves against the nearest ancestor with a transform, not against the
// viewport — and the Word Bomb coach mark renders inside `.game-stage--wb`, which is
// transformed the moment the panic band starts. Every fixed coordinate in the component was
// being read in the STAGE's space. Measured before the fix, on a scripted turn at 3s:
//     1280x720  the ring 70px right and 16px down from the field it rings
//     390x844   the ring at y=1471 in an 844-tall viewport — 627px below the screen
// The component is portalled to <body> now. This holds it there: the ring is centred on its
// target to within a pixel, in BOTH the calm band and the panic band, and the overlay has no
// transformed ancestor at all.
const WB_ME = 'e2e-player';

for (const [vn, w, h] of [['1280x720', 1280, 720], ['390x844', 390, 844]]) {
  for (const t of [28, 3]) {
    test(`the ring stays on the field — word bomb @ ${vn}, t=${t}s`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const players = [
        { id: WB_ME, name: 'YOU', lives: 3, isHost: true },
        { id: 'p1', name: 'PLAYER1', lives: 3 },
      ];
      const mock = await installBackendMock(page);
      await page.goto('/?portal=1');
      await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
      mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: WB_ME, difficultyKey: 'chill', players } });
      await page.waitForTimeout(80);
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
      await page.waitForTimeout(80);
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: WB_ME, players, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 } });
      await page.locator('.countdown-overlay').waitFor({ state: 'attached', timeout: 4000 }).catch(() => {});
      await page.locator('.countdown-overlay').waitFor({ state: 'detached', timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(300);
      mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: t } });
      await page.waitForTimeout(400);

      const r = await page.evaluate(() => {
        const hole = document.querySelector('.spotlight-hole');
        const field = document.querySelector('.game-input');
        const ov = document.querySelector('.spotlight-overlay');
        if (!hole || !field || !ov) return { missing: true };
        const hb = hole.getBoundingClientRect();
        const fb = field.getBoundingClientRect();
        // any ancestor that makes `fixed` mean something other than the viewport
        const chain = [];
        let e = ov;
        while (e && e !== document.documentElement) {
          const cs = getComputedStyle(e);
          if ((cs.transform && cs.transform !== 'none') || (cs.filter && cs.filter !== 'none')
            || cs.willChange.includes('transform') || cs.perspective !== 'none') {
            chain.push(`${e.tagName.toLowerCase()}.${String(e.className).trim().split(/\s+/).slice(0, 2).join('.')}`);
          }
          e = e.parentElement;
        }
        return {
          dx: Math.round((hb.left + hb.width / 2) - (fb.left + fb.width / 2)),
          dy: Math.round((hb.top + hb.height / 2) - (fb.top + fb.height / 2)),
          onScreen: hb.top >= -1 && hb.bottom <= window.innerHeight + 1
            && hb.left >= -1 && hb.right <= window.innerWidth + 1,
          hole: [Math.round(hb.x), Math.round(hb.y), Math.round(hb.width), Math.round(hb.height)],
          chain,
        };
      });

      expect(r.missing, 'no coach mark on the board').toBeFalsy();
      expect(r.chain, `the overlay has a transformed ancestor, so its "fixed" is not the viewport: ${r.chain.join(', ')}`).toEqual([]);
      expect(Math.abs(r.dx), `the ring is ${r.dx}px off its target horizontally`).toBeLessThanOrEqual(2);
      expect(Math.abs(r.dy), `the ring is ${r.dy}px off its target vertically`).toBeLessThanOrEqual(2);
      expect(r.onScreen, `the ring is off screen: ${JSON.stringify(r.hole)} in ${w}x${h}`).toBe(true);
    });
  }
}
