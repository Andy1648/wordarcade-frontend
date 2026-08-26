// e2e/card-beat.spec.js — the cards consume the shared beat clock without adding cost.
// Guards item 3: on a beat kick (html[data-beat='true']) the card face scale-pulses (transform
// only), the featured card pulses harder than the rest, NO new infinite animation is introduced
// (the persistent loop count is unchanged), and the concurrent FINITE animation count stays
// within the 20 budget.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test('cards pulse on the beat, featured harder, no new loops, within the animation budget', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(1000);
  // Disable the 120ms transition so the beat scale jumps straight to its TARGET value — the
  // assertion then reads a deterministic scale instead of sampling mid-interpolation (flaky).
  await page.addStyleTag({ content: '.game-card { transition: none !important; }' });

  const r = await page.evaluate(async () => {
    const isInf = (a) => { try { return a.effect.getComputedTiming().iterations === Infinity; } catch { return false; } };
    const scaleOf = (sel) => {
      const el = document.querySelector(sel);
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return m.a;
    };
    const featuredSel = ".game-card-magnet[data-game='word-bomb'] .game-card";
    const normalSel = ".game-card-magnet[data-game='chain'] .game-card";

    const infiniteRest = document.getAnimations().filter(isInf).length;
    const featRest = scaleOf(featuredSel);
    const normRest = scaleOf(normalSel);

    // Kick.
    document.documentElement.style.setProperty('--beat-intensity', '1');
    document.documentElement.setAttribute('data-beat', 'true');
    await new Promise((z) => requestAnimationFrame(() => requestAnimationFrame(z)));

    const anims = document.getAnimations();
    const infiniteBeat = anims.filter(isInf).length;
    const concurrentFinite = anims.filter((a) => a.playState === 'running' && !isInf(a)).length;
    const featBeat = scaleOf(featuredSel);
    const normBeat = scaleOf(normalSel);

    return {
      infiniteRest, infiniteBeat, concurrentFinite,
      featGain: featBeat - featRest,
      normGain: normBeat - normRest,
    };
  });

  // No new infinite/looping animation was introduced by the beat.
  expect(r.infiniteBeat, 'infinite animation count on a beat').toBe(r.infiniteRest);
  // The face actually pulsed (both cards grew), and the featured card pulsed HARDER.
  expect(r.normGain, 'normal card pulse').toBeGreaterThan(0);
  expect(r.featGain, 'featured card pulse').toBeGreaterThan(r.normGain);
  // Concurrent finite animations stay within the 20 budget during a kick.
  expect(r.concurrentFinite, 'concurrent finite animations on a beat').toBeLessThanOrEqual(20);
});
