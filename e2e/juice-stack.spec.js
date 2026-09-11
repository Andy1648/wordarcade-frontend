// e2e/juice-stack.spec.js — feat/juice-stack acceptance.
//
// The shared juice stack fires ONLY on discrete events (a word accepted, a turn passed,
// a life lost). This measures the three things that keep it from becoming noise:
//   1) <=3 concurrent FINITE animations on an accept frame - a discrete beat should be
//      one readable thump, not a pile-up.
//   2) ZERO infinite animations added by an accept - the stack is one-shots only.
//   3) With reduced-motion emulated, ZERO camera-level motion. Screen shake is a
//      documented motion-sickness trigger, so this is a hard gate, not a softening.
// The numbers are printed so a reviewer can read them off the run log.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const PLAYERS = [
  { id: ME, name: 'YOU', lives: 3, isHost: true },
  { id: 'p2', name: 'RIVAL', lives: 3 },
];

async function startTurn(page) {
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
    payload: { currentPlayerId: ME, players: PLAYERS, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 },
  });
  await page.waitForTimeout(4700); // let the 3-2-1-GO! intro clear
  return mock;
}

// Sample running animations, split by whether they loop.
const sampleAnims = (page) =>
  page.evaluate(() => {
    const all = document.getAnimations().filter((a) => a.playState === 'running');
    const inf = [];
    const fin = [];
    for (const a of all) {
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
      const target = (a.effect && a.effect.target) || null;
      const name = a.animationName || (target && target.className && String(target.className).slice(0, 40)) || 'waapi';
      (t.iterations === Infinity ? inf : fin).push(name);
    }
    return { infinite: inf, finite: fin };
  });

test('an accept is <=3 concurrent finite animations and adds no infinite ones', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await startTurn(page);

  const before = await sampleAnims(page);

  // Sample REPEATEDLY across the accept so we catch the busiest frame, not a lucky one.
  const peaks = [];
  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'MONSTER' } });
  for (let i = 0; i < 8; i++) {
    peaks.push(await sampleAnims(page));
    await page.waitForTimeout(30);
  }
  const worst = peaks.reduce((a, b) => (b.finite.length > a.finite.length ? b : a), peaks[0]);
  const maxInfinite = Math.max(...peaks.map((p) => p.infinite.length));

  // eslint-disable-next-line no-console
  console.log(
    `JUICE | infinite before=${before.infinite.length} peak-during=${maxInfinite} ` +
    `| peak concurrent finite=${worst.finite.length} [${worst.finite.join(', ')}]`
  );

  expect(worst.finite.length, `concurrent finite animations on the accept frame: ${worst.finite.join(', ')}`)
    .toBeLessThanOrEqual(3);
  expect(maxInfinite, 'an accept must not start a looping animation')
    .toBeLessThanOrEqual(before.infinite.length);
});

test('reduced motion: an accept produces ZERO camera-level motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await startTurn(page);

  mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'MONSTER' } });

  // Watch the camera roots across the whole beat: neither may run an animation, and
  // neither may end up with a non-identity transform.
  const CAMERA = '.app-shake, .game-stage';
  let worst = { anims: 0, moved: [] };
  for (let i = 0; i < 10; i++) {
    const s = await page.evaluate((sel) => {
      const els = [...document.querySelectorAll(sel)];
      const anims = els.reduce(
        (n, el) => n + el.getAnimations().filter((a) => a.playState === 'running').length,
        0
      );
      const moved = els
        .map((el) => getComputedStyle(el).transform)
        .filter((t) => t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)');
      return { anims, moved };
    }, CAMERA);
    if (s.anims > worst.anims) worst = s;
    if (s.moved.length > worst.moved.length) worst = s;
    await page.waitForTimeout(30);
  }
  // eslint-disable-next-line no-console
  console.log(`JUICE reduced-motion | camera animations=${worst.anims} camera transforms=[${worst.moved.join(' | ')}]`);

  expect(worst.anims, 'camera-level animations under reduced motion').toBe(0);
  expect(worst.moved, 'camera-level transform under reduced motion').toEqual([]);
});

test('the MOTION toggle is reachable, persists, and stops the camera', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

  // Open the one settings cluster and flip MOTION off.
  await page.locator('.audio-btn').first().click();
  const motionToggle = page.getByRole('button', { name: /MOTION effects/i });
  await expect(motionToggle, 'the MOTION toggle must exist in the settings popover').toHaveCount(1);
  await expect(motionToggle).toHaveAttribute('aria-pressed', 'true');
  await motionToggle.click();
  await expect(motionToggle).toHaveAttribute('aria-pressed', 'false');

  // It reaches the CSS-driven camera shakes...
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  // ...and it SURVIVES a reload. A toggle you have to find again every session is
  // not a real accessibility accommodation.
  await page.reload();
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await expect(page.locator('html'), 'the MOTION setting must persist across a reload')
    .toHaveAttribute('data-motion', 'off');
});
