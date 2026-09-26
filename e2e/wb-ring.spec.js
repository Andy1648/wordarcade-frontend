// e2e/wb-ring.spec.js — THE RING'S GEOMETRY, at every player count that matters.
//
// WHY THIS GATE EXISTS. The layout it replaces was a wrapping row of `flex: 1 1 0` cards with
// `min-width: clamp(100px, 15vw, 200px)` inside a stage capped at min(96vw, 1760px). A row can
// only be right at one player count; measured, a card whose content needs ~123px rendered:
//     2 players -> 875px card, 752px empty (86%)
//     3 players -> 580px card, 457px empty (79%)
//     4 players -> 433px card, 310px empty (72%)
//     8 players -> 211px card,  88px empty (42%)
// A ring divides 360deg by the count instead, so the same seat box is correct at 2 and at 16.
// This spec asserts the properties a row could not hold:
//   (1) NO SEAT IS MORE THAN 2x ITS OWN CONTENT WIDTH, at any count — the stretched-empty-box
//       failure, stated as a ratio so it cannot be satisfied by simply shrinking everything.
//   (2) SEATS ARE EVENLY SPACED, and at n=2 they are HORIZONTALLY opposed — 12-and-6 is the
//       one arrangement that reproduces the tall-empty-box failure inside a circle.
//   (3) ZERO OVERLAP between any avatar, any name, the turn pointer and the bomb.
//   (4) NOTHING OVERFLOWS THE STAGE, no new infinite animations, and will-change stays on
//       transform/opacity.
//
// HARNESS: e2e/support/backendMock.js — page.routeWebSocket against the backend URL, with
// Playwright acting as the server. Same path e2e/game-fill.spec.js drives Word Bomb through:
// room_update (>=2 players, or START stays locked) -> game_started -> turn_update. The
// create_room/add_bot handshake is not needed here because room_update can be pushed directly.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const COUNTS = [2, 3, 4, 8];
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

const mkPlayers = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? ME : `p${i}`,
    name: i === 0 ? 'YOU' : `PLAYER${i}`,
    lives: 3,
    isHost: i === 0,
  }));

async function enterWordBomb(page, n) {
  const players = mkPlayers(n);
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
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
      currentPlayerId: ME,
      players,
      combo: 'str',
      timerSeconds: 22,
      maxLives: 3,
      round: 1,
      difficulty: 'chill',
      difficultyKey: 'chill',
      usedWords: ['MONSTER'],
      usedAnswers: [],
    },
  });
  await page.locator('.wb-ring').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(4600); // let the 3-2-1-GO! countdown clear
}

async function measure(page) {
  return page.evaluate(() => {
    const ring = document.querySelector('.wb-ring');
    const stage = document.querySelector('.game-stage--wb');
    const rr = ring.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const cx = rr.left + rr.width / 2;
    const cy = rr.top + rr.height / 2;

    // --- (1) SEAT BOX vs ITS OWN CONTENT ---
    // The content is the avatar card plus the name that hangs under it — i.e. the widest
    // thing the seat actually has to hold. A seat that is more than twice that is the
    // stretched-empty-box failure, whatever the player count.
    const seats = [...document.querySelectorAll('.wb-seat')];
    const boxes = seats.map((s) => {
      const b = s.getBoundingClientRect();
      const card = s.querySelector('.game-player-card');
      const name = s.querySelector('.game-player-name-text');
      const cb = card ? card.getBoundingClientRect() : { width: 0 };
      const nb = name && getComputedStyle(name).display !== 'none'
        ? name.getBoundingClientRect() : { width: 0 };
      const content = Math.max(cb.width, nb.width);
      return { w: +b.width.toFixed(1), content: +content.toFixed(1), ratio: content ? +(b.width / content).toFixed(2) : 0 };
    });

    // --- (2) EVEN SPACING + the n=2 axis ---
    const angles = seats.map((s) => {
      const b = s.getBoundingClientRect();
      // atan2 from the ring centre, normalised to [0,360)
      const a = (Math.atan2(b.top + b.height / 2 - cy, b.left + b.width / 2 - cx) * 180) / Math.PI;
      return (a + 360) % 360;
    }).sort((x, y) => x - y);
    const gaps = angles.map((a, i) => {
      const next = i === angles.length - 1 ? angles[0] + 360 : angles[i + 1];
      return next - a;
    });
    const spread = Math.max(...gaps) - Math.min(...gaps);
    // horizontal opposition at n=2: both seats on (roughly) the same y, far apart in x
    let pairAxis = null;
    if (seats.length === 2) {
      const a = seats[0].getBoundingClientRect();
      const b = seats[1].getBoundingClientRect();
      pairAxis = {
        dx: Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)),
        dy: Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)),
      };
    }

    // --- (3) OVERLAP: avatars, names, pointer, bomb ---
    const vis = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1 && b.height > 1;
    };
    const parts = [];
    for (const s of seats) {
      const card = s.querySelector('.game-player-card');
      const name = s.querySelector('.game-player-name-text');
      if (vis(card)) parts.push({ k: 'avatar', r: card.getBoundingClientRect() });
      if (vis(name)) parts.push({ k: 'name:' + name.textContent.trim(), r: name.getBoundingClientRect() });
    }
    const arrow = document.querySelector('.wb-pointer-arrow');
    if (vis(arrow)) parts.push({ k: 'pointer', r: arrow.getBoundingClientRect() });
    const bomb = document.querySelector('.wb-core .bomb-area');
    if (vis(bomb)) parts.push({ k: 'bomb', r: bomb.getBoundingClientRect() });
    const TOL = 1; // a shared 1px edge is not an overlap
    const overlaps = [];
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i].r; const b = parts[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > TOL && oy > TOL) overlaps.push(`${parts[i].k} x ${parts[j].k} (${Math.round(ox)}x${Math.round(oy)})`);
      }
    }

    // --- (4) OVERFLOW / MOTION BUDGET ---
    let over = 0; let osel = '';
    for (const el of stage.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      // The posterised band bleeds by design and is clipped by its own layer; the first-run
      // Spotlight is a viewport-anchored onboarding overlay, not board layout.
      if (el.ownerSVGElement || el.closest('.wb-structure')) continue;
      if (el.closest('[class*="spotlight"]')) continue;
      const b = el.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      const o = Math.max(sr.top - b.top, b.bottom - sr.bottom, sr.left - b.left, b.right - sr.right);
      if (o > over) { over = o; osel = (typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName); }
    }
    const infinite = document.getAnimations()
      .filter((a) => a.effect && a.effect.getTiming().iterations === Infinity)
      .map((a) => a.animationName || '?');
    const badWillChange = [];
    for (const el of document.querySelectorAll('*')) {
      const wc = getComputedStyle(el).willChange;
      if (!wc || wc === 'auto') continue;
      for (const tok of wc.split(',').map((t) => t.trim())) {
        if (!['transform', 'opacity', 'auto'].includes(tok)) badWillChange.push(tok);
      }
    }

    return {
      n: seats.length,
      boxes,
      maxRatio: Math.max(...boxes.map((b) => b.ratio)),
      angles: angles.map((a) => Math.round(a)),
      spread: +spread.toFixed(1),
      pairAxis,
      overlaps,
      overflow: +over.toFixed(1),
      osel,
      infinite: [...new Set(infinite)],
      badWillChange: [...new Set(badWillChange)],
      ringBox: `${Math.round(rr.width)}x${Math.round(rr.height)}`,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`the ring @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const n of COUNTS) {
      test(`${n} players: seats even, boxes sized to content, nothing overlaps`, async ({ page }) => {
        test.setTimeout(45000);
        await enterWordBomb(page, n);
        const m = await measure(page);
        // eslint-disable-next-line no-console
        console.log(
          `WB-RING | ${vp.name.padEnd(10)} | n=${String(m.n).padEnd(2)} | ring ${m.ringBox.padEnd(9)}` +
          ` | widest seat ${Math.max(...m.boxes.map((b) => b.w))}px vs content ${Math.max(...m.boxes.map((b) => b.content))}px` +
          ` | ratio ${m.maxRatio} | angle spread ${m.spread}deg | overlaps ${m.overlaps.length} | overflow ${m.overflow}${m.overflow > 1 ? ' ' + m.osel : ''}`
          + (m.overlaps.length ? `
         overlaps: ${m.overlaps.join(' ;; ')}` : '')
        );

        expect(m.n, 'every player has a seat').toBe(n);
        // (1) no seat is more than twice its own content
        expect(m.maxRatio, `widest seat vs its content at n=${n}`).toBeLessThanOrEqual(2);
        // (2) evenly spaced: every gap within 2deg of every other
        expect(m.spread, `angle spread between seats at n=${n}`).toBeLessThanOrEqual(2);
        if (n === 2) {
          // horizontally opposed, NOT stacked
          expect(m.pairAxis.dx, '2 players must be far apart horizontally').toBeGreaterThan(m.pairAxis.dy * 4);
        }
        // (3) nothing touches anything
        expect(m.overlaps, `overlaps at n=${n}`).toEqual([]);
        // (4) budget
        expect(m.overflow, `${m.osel} overflows the stage at n=${n}`).toBeLessThanOrEqual(1);
        expect(m.badWillChange, 'will-change may only list transform/opacity').toEqual([]);
      });
    }
  });
}

// The infinite-animation count is a property of the SCREEN, not of the player count, so it is
// asserted once rather than four times per viewport.
test('the ring adds no infinite animations', async ({ page }) => {
  test.setTimeout(45000);
  await enterWordBomb(page, 4);
  const m = await measure(page);
  // eslint-disable-next-line no-console
  console.log(`WB-RING | infinite animations on the board: ${JSON.stringify(m.infinite)}`);
  for (const name of m.infinite) {
    expect(name, `"${name}" is a ring animation and must not loop`).not.toMatch(/^wb-(beat|pointer|seat|ring)/);
  }
});
