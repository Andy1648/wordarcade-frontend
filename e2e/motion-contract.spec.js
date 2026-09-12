// e2e/motion-contract.spec.js — WHAT MOTION THIS SUITE ACTUALLY RUNS UNDER, and what the
// app owes a player who has asked for less of it.
//
// TWO THINGS, and the first is the reason the second was never tested.
//
// 1. playwright.config.js sets `use.reducedMotion: 'reduce'` and explains at length why —
//    the app's idle loops would otherwise stall Playwright's actionability checks. IT IS
//    NOT IN EFFECT. Measured on a bare `data:` page in this project, on Playwright 1.62:
//    matchMedia('(prefers-reduced-motion: reduce)').matches is FALSE. Only an explicit
//    page.emulateMedia() flips it. One spec already carries a comment saying it "was
//    observed NOT to flip" (splash-loops.spec.js) and works around it locally; nothing
//    said so anywhere a reader of the config would find it.
//    The consequence is not that the suite is wrong — running at FULL motion is the
//    stricter side of the bet, and 1000+ tests pass there. The consequence is that any
//    assertion which relies on the CONFIG for its reduced-motion state is vacuous, and
//    reads as though it is testing the accessible path when it is testing the default one.
//    So: pin the fact. If a future Playwright starts honouring the option, this test goes
//    red, and whoever sees it should flip the expectation and re-read every spec that
//    quietly assumed one state or the other.
//
// 2. THE ACTUAL CONTRACT. Word Bomb's panic band is the loudest thing in the game: at the
//    critical tension tier the board runs a stage heartbeat, flying sweat, a full-screen
//    red throb and scrolling speed lines. Under prefers-reduced-motion every one of those
//    must stop. Nothing tested it, and the reason is (1) — the suite believed it was
//    already in that state.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';

test('the config-level reducedMotion option is INERT in this project (pinned, not endorsed)', async ({ page }) => {
  await page.goto('data:text/html,<h1>motion contract</h1>');
  const matches = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(
    matches,
    'config-level reducedMotion started working — flip this expectation and re-check every '
    + 'spec that assumed full motion, and every one that assumed reduced',
  ).toBe(false);
});

test('emulateMedia DOES flip it, which is how a spec must ask for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('data:text/html,<h1>motion contract</h1>');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
});

async function panicBand(page) {
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p1', name: 'PLAYER1', lives: 3 },
  ];
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 } });
  await introClear(page);
  mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: 3 } });
  await page.waitForTimeout(400);
  return page.evaluate(() => ({
    rm: matchMedia('(prefers-reduced-motion: reduce)').matches,
    loops: document.getAnimations()
      .filter((a) => a.effect && a.effect.getTiming().iterations === Infinity)
      .map((a) => a.animationName || '?').sort(),
  }));
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

test('under reduced motion the Word Bomb panic band runs ZERO looping animations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const r = await panicBand(page);
  expect(r.rm, 'reduced motion was not actually on, so this proves nothing').toBe(true);
  expect(r.loops, `loops still running under reduced motion: ${r.loops.join(', ')}`).toEqual([]);
});

test('at full motion the panic band is exactly the two loops it is meant to be', async ({ page }) => {
  // The counterpart: the panic state SHOULD move for a player who has not asked otherwise.
  // Two loops, both deliberate — the stage heartbeat and the mascot's flying sweat. The
  // five tension-layer loops that used to run alongside them are gone (their stiller list
  // was scoped to the wrong ancestor and matched nothing; see GameScreen.css). A THIRD
  // loop appearing here is a regression against CLAUDE.md's zero-new-infinite rule.
  await page.setViewportSize({ width: 1280, height: 720 });
  const r = await panicBand(page);
  expect(r.rm, 'this test must run at FULL motion').toBe(false);
  expect(r.loops, `panic-band loops: ${r.loops.join(', ')}`).toEqual(['stage-heartbeat', 'sweat-fly']);
});
