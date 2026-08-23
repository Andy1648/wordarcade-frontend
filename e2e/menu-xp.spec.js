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
  test('popups show the typed letter, uppercased (not "+N")', async ({ page }) => {
    await gotoMenuLive(page);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true })));
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true })));
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.menu-xp-pop')].map((p) => p.textContent).filter(Boolean)
    );
    expect(texts).toContain('Q');
    expect(texts).toContain('7');
    expect(texts.some((t) => t.includes('+'))).toBe(false);
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
    // Sanity: the burst actually credited XP and crossed at least one level.
    expect(result.xp).toBeGreaterThanOrEqual(10);
  });
});
