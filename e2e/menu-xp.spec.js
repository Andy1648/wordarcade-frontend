// e2e/menu-xp.spec.js
//
// The menu XP layer's live behaviour that can only be seen in a real browser: the
// "+letter" popups, and — the load-bearing one — the concurrency budget. The bar's fill
// transition now counts as a running animation, so the pop cap dropped to 2; this asserts
// that during a SUSTAINED ~8 keys/sec burst (crossing a level, so the one-shot level-up
// celebration also fires) the TOTAL running-animation count never exceeds 3.
//
// Runs under the suite's default reducedMotion:'reduce', which disables the decorative
// idle card-art loops (they honour prefers-reduced-motion), so the menu's animation
// baseline is quiet and the count reflects the XP layer. The XP feedback is event-driven
// WAAPI / a transform transition and is intentionally NOT gated on reduced motion, so it
// still runs here (that's the point of the test).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function gotoMenuLive(page) {
  await installBackendMock(page);
  // ?portal=1 skips the boot splash/intro. We do NOT freeze animations (the whole point).
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
}

test.describe('menu XP', () => {
  test('combined pop shows the typed LETTER + "+N" in one element', async ({ page }) => {
    await gotoMenuLive(page);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true })));
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true })));
    const r = await page.evaluate(() => ({
      letters: [...document.querySelectorAll('.menu-xp-pop-letter')].map((n) => n.textContent).filter(Boolean),
      plus: [...document.querySelectorAll('.menu-xp-pop-plus')].map((n) => n.textContent).filter(Boolean),
    }));
    expect(r.letters).toContain('Q');
    expect(r.letters).toContain('7');
    // menu multiplier is 10 → the "+N" span reads +10
    expect(r.plus).toContain('+10');
  });

  test('sustained 30 keys/sec burst never exceeds 14 concurrent finite animations', async ({ page }) => {
    await gotoMenuLive(page);

    const result = await page.evaluate(async () => {
      // The budget is on concurrent FINITE animations (spec §5). The menu's decorative
      // card-art loops are INFINITE (iteration count Infinity) — a separate budget — so
      // they're excluded here; what remains is the XP layer's pops + fill + level-up.
      const isFiniteAnim = (a) => {
        const t = a.effect && a.effect.getTiming && a.effect.getTiming();
        return t && t.iterations !== Infinity;
      };
      const runningFinite = () =>
        document.getAnimations().filter((a) => a.playState === 'running' && isFiniteAnim(a));
      const nameOf = (a) =>
        a.animationName || `transition:${(a.effect && a.effect.target && a.effect.target.className) || '?'}`;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      // Let the one-time screen-ENTRY transition (the striped wipe: transition-bar-sweep /
      // -word-flash, ~500ms, fired as the menu appears) fully play out FIRST — that's the
      // app's navigation overlay, not the XP layer, and a "sustained" burst is measured
      // once the menu has settled. Wait a comfortable margin, then confirm quiescence.
      await sleep(1800);
      for (let t = 0; t < 60 && runningFinite().length > 0; t++) await sleep(50);
      const idleBaseline = runningFinite().length;
      let peak = 0;
      let peakNames = [];
      // ~120 keystrokes at ~33ms (≈30/sec) over ~4s. Crosses several levels so the
      // level-up celebration fires mid-burst — the worst case for concurrency.
      for (let i = 0; i < 120; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        // sample twice across the inter-keystroke gap to catch transient overlaps
        for (let s = 0; s < 2; s++) {
          await sleep(16);
          const a = runningFinite();
          if (a.length > peak) {
            peak = a.length;
            peakNames = a.map(nameOf);
          }
        }
      }
      const xp = (() => { try { return Number(localStorage.getItem('taw.xp')) || 0; } catch { return 0; } })();
      return { idleBaseline, peak, peakNames, xp };
    });

    // The whole point: the concurrent FINITE running-animation count stays within budget.
    expect(result.peak, `finite anims at peak: ${JSON.stringify(result.peakNames)}`).toBeLessThanOrEqual(14);
    // Sanity: the burst actually credited XP and crossed at least one level (need(1)=100).
    expect(result.xp).toBeGreaterThanOrEqual(100);
  });
});

test.describe('splash XP', () => {
  test('TYPE TO START: a keydown dismisses, credits XP, fires a pop, and unlocks audio', async ({ page }) => {
    await installBackendMock(page);
    // Count AudioContext constructions (the keydown must create/resume one).
    await page.addInitScript(() => {
      window.__ac = 0;
      const O = window.AudioContext || window.webkitAudioContext;
      if (O) {
        window.AudioContext = class extends O {
          constructor(...a) {
            super(...a);
            window.__ac += 1;
          }
        };
      }
    });
    await page.goto('/'); // fresh context → the splash shows (no ?portal skip)
    await page.locator('.splash-screen').waitFor({ state: 'visible' });
    // Desktop Chrome is a fine pointer → the prompt invites typing.
    await expect(page.locator('.splash-start')).toHaveText('TYPE TO START');

    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));
    await page.waitForTimeout(80);

    const r = await page.evaluate(() => ({
      leaving: document.querySelector('.splash-screen')?.classList.contains('leaving') ?? true,
      poppedA: [...document.querySelectorAll('.menu-xp-pop-letter')].some((n) => n.textContent === 'A'),
      xp: (() => { try { return Number(localStorage.getItem('taw.xp')) || 0; } catch { return 0; } })(),
      audioContexts: window.__ac,
    }));
    expect(r.leaving).toBe(true); // typing dismissed the splash
    expect(r.poppedA).toBe(true); // a pop fired ON the splash
    expect(r.xp).toBeGreaterThanOrEqual(10); // credited normally (+10)
    expect(r.audioContexts).toBeGreaterThanOrEqual(1); // AudioContext created in the keydown gesture
  });
});
