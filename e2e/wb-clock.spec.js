// e2e/wb-clock.spec.js — THE BOMB IS THE CLOCK, so the clock has to be readable.
//
// The ring rebuild gated the seconds numeral to `timerSeconds <= 5`. On a 30s turn that
// left 25 seconds with no number anywhere on the board, and the red escalation it kept was
// keyed to the RATIO, in a band the 5s gate meant the numeral was never rendered in — so the
// red branch could not paint at any turn length above ~16s. This gate holds both halves:
//
//   1) the numeral is PRESENT and DECREASING across 5 samples of a scripted turn, at four
//      viewports and at 2 / 4 / 8 players;
//   2) the escalation is keyed to SECONDS — white above 6, red below — and is therefore
//      independent of how long the turn was;
//   3) the numeral never leaves the bomb (it is inside the ring's box at every viewport);
//   4) it adds no looping animation, and above 6s it is not animating at all.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];
const RED = '#FF4B4B';

const seats = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? ME : `p${i}`,
    name: i === 0 ? 'YOU' : `PLAYER${i}`,
    lives: 3,
    isHost: i === 0,
  }));

async function enterTurn(page, players, maxTimer = 30) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: maxTimer, maxLives: 3 } });
  await introClear(page);
  return mock;
}

// WAIT FOR THE INTRO, DO NOT SLEEP THROUGH IT. A flat `waitForTimeout(4800)` for the
// 3-2-1-GO! overlay passed 13/13 alone and went red at the FIRST sample under load (three
// checkouts building and gating at once): the overlay was still up, `showCountdown` was
// still true, and the numeral is deliberately absent while it is. A sleep tuned on an idle
// machine is a race on a busy one.
async function introClear(page) {
  const overlay = page.locator('.countdown-overlay');
  // ATTACHED FIRST. Waiting only for `detached` resolves INSTANTLY when the element has not
  // mounted yet — React had not rendered the overlay at the moment of the call — so the wait
  // returned immediately and every run failed at the first sample, consistently. A wait for a
  // thing to go away is only a wait once the thing is there.
  await overlay.waitFor({ state: 'attached', timeout: 4000 }).catch(() => {});
  await overlay.waitFor({ state: 'detached', timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(150); // one frame past the unmount, so the board has laid out
}

const readClock = (page) =>
  page.evaluate(() => {
    const t = document.querySelector('.bomb-num');
    if (!t) return { present: false };
    const r = t.getBoundingClientRect();
    const ring = document.querySelector('.wb-ring') || document.querySelector('.bomb-vignette');
    const rr = ring ? ring.getBoundingClientRect() : null;
    return {
      present: true,
      value: Number((t.textContent || '').trim()),
      fill: (t.getAttribute('fill') || '').toUpperCase(),
      size: Number(t.getAttribute('font-size')),
      urgent: t.classList.contains('bomb-num-tick'),
      box: [r.x, r.y, r.width, r.height],
      // inside the bomb's own box, with a pixel of slack for the stroke
      insideRing: !!rr && r.left >= rr.left - 2 && r.right <= rr.right + 2 && r.top >= rr.top - 2 && r.bottom <= rr.bottom + 2,
      onScreen: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0
        && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
    };
  });

for (const vp of VIEWPORTS) {
  for (const n of [2, 4, 8]) {
    test(`clock: present + decreasing across 5 samples — ${vp.name}, ${n} players`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const players = seats(n);
      const mock = await enterTurn(page, players, 30);

      // (1) FIVE samples of a scripted turn, from full to nearly out.
      const ticks = [28, 22, 15, 9, 3];
      const seen = [];
      for (const s of ticks) {
        mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: s } });
        await page.waitForTimeout(220);
        const c = await readClock(page);
        expect(c.present, `no seconds numeral at t=${s} (${vp.name}, ${n}p)`).toBe(true);
        expect(c.value, `numeral text at t=${s}`).toBe(s);
        expect(c.onScreen, `numeral off screen at t=${s}: ${JSON.stringify(c.box)}`).toBe(true);
        expect(c.insideRing, `numeral left the bomb at t=${s}: ${JSON.stringify(c.box)}`).toBe(true);
        seen.push(c);
      }
      // strictly decreasing, sample to sample
      const values = seen.map((c) => c.value);
      for (let i = 1; i < values.length; i++) {
        expect(values[i], `samples not decreasing: ${values.join(' > ')}`).toBeLessThan(values[i - 1]);
      }

      // (1b) NOTHING is drawn over the fragment slab at any tier. The stage-centred
      // GET OUT! label painted through it at every desktop viewport; the caption that
      // replaced it cannot, because it is inside the slab.
      const slab = await page.evaluate(() => {
        const box = document.querySelector('.game-combo-box');
        if (!box) return { ok: false };
        const r = box.getBoundingClientRect();
        const hits = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.contains(box) || box.contains(el)) continue;
          // The decorative wall behind the board paints big graffiti letters; they are
          // BACKGROUND art, under everything, and they legitimately sit behind the slab.
          if (el.closest('.wall-graffiti-tag, .game-wall, .wall-layer')) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' && cs.opacity === '0') continue;
          if (!(el.textContent || '').trim()) continue;
          if (el.children.length) continue;
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          const ov = Math.min(r.right, b.right) - Math.max(r.left, b.left);
          const oh = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
          if (ov > 4 && oh > 4) hits.push(`${el.className || el.tagName}"${el.textContent.trim().slice(0, 18)}" ${Math.round(ov)}x${Math.round(oh)}`);
        }
        return { ok: true, caption: (box.querySelector('.game-combo-label') || {}).textContent, hits };
      });
      expect(slab.hits, `text drawn over the fragment slab at t=${ticks[ticks.length - 1]}`).toEqual([]);
      expect(slab.caption, 'the caption escalates in place under 30% of the clock').toBe('GET OUT!');

      // (2) the escalation is keyed to SECONDS: white above 6, red below.
      expect(seen[3].fill, 'still white at 9s').toBe('#FFF');
      expect(seen[3].urgent, 'not pulsing at 9s').toBe(false);
      expect(seen[4].fill, 'red under 6s').toBe(RED);
      expect(seen[4].urgent, 'pulsing under 6s').toBe(true);
      expect(seen[4].size, 'louder under 6s').toBeGreaterThan(seen[0].size);

      // (4) the numeral introduces no looping animation — at any point in the turn — and
      // the panic band's loop set is pinned.
      //
      // What this found, and what it now holds: the Word Bomb board was NOT loop-free in
      // the panic band, and the rule that was supposed to make it so could not fire. The
      // ring branch's "still the board" list is scoped `.game-stage--wb …`, but the
      // tension layer is a child of `.game-wrap--wb` — a SIBLING branch — so four of its
      // selectors matched zero elements and failed silently. Measured before the fix, on a
      // scripted 30s turn:
      //
      //   > 50% of the clock   0
      //   <= 50%               4   wb-tension-breathe + 3x wb-tension-line-scroll
      //   <= 40%               5   + wb-tension-pulse
      //   <  30% (critical)    7   + stage-heartbeat, sweat-fly
      //
      // Re-scoping the list kills the first five. TWO REMAIN and they are deliberate: the
      // stage heartbeat is ON `.game-stage--wb` itself, which a descendant selector cannot
      // reach, and `sweat-fly` was never in the list at all.
      // CORRECTION, measured after this comment first claimed otherwise: both ARE properly
      // reduced-motion gated. Under an explicit page.emulateMedia({reducedMotion:'reduce'})
      // the panic band runs ZERO loops (e2e/motion-contract.spec.js). They run here because
      // this suite runs at FULL motion — the config's `use.reducedMotion` is inert in this
      // project, which is its own finding and is pinned in that file. So these two are the
      // panic state doing its job for a player who has not asked for less, not an
      // accessibility hole. A THIRD loop, or a returning tension loop, fails this gate.
      const loops = await page.evaluate(() =>
        document.getAnimations()
          .filter((a) => a.effect && a.effect.getTiming().iterations === Infinity)
          .map((a) => ({
            name: a.animationName || '?',
            onNumeral: !!(a.effect.target && a.effect.target.classList
              && a.effect.target.classList.contains('bomb-num')),
          })));
      expect(loops.filter((l) => l.onNumeral), 'the numeral must never loop').toHaveLength(0);
      expect(loops.map((l) => l.name).sort(), 'panic-band loop set at t=3').toEqual(
        ['stage-heartbeat', 'sweat-fly']);
    });
  }
}

test('clock: the red band is a SECONDS band, not a fraction of the turn', async ({ page }) => {
  // The bug this replaces: the old ramp read the ratio, so on a long turn the numeral was
  // white at 5s and on a short turn it was red at 8s. Same wall-clock second, two colours.
  await page.setViewportSize({ width: 1280, height: 720 });
  const players = seats(2);
  const mock = await enterTurn(page, players, 60);
  for (const [s, want, label] of [[7, '#FFF', 'white at 7s on a 60s turn'], [5, RED, 'red at 5s on a 60s turn']]) {
    mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: s } });
    await page.waitForTimeout(220);
    const c = await readClock(page);
    expect(c.fill, label).toBe(want);
  }
  // …and the same two seconds on a 12s turn, where the RATIO is completely different.
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'ing', usedWords: [], timerSeconds: 12, maxLives: 3 } });
  await page.waitForTimeout(200);
  for (const [s, want, label] of [[7, '#FFF', 'white at 7s on a 12s turn'], [5, RED, 'red at 5s on a 12s turn']]) {
    mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: s } });
    await page.waitForTimeout(220);
    const c = await readClock(page);
    expect(c.fill, label).toBe(want);
  }
});
