// e2e/splash-burst.spec.js (fix/visual-batch-1) — the splash starburst is pinned to the
// lower-right corner (spin only, no drift) and its box NEVER intersects the wordmark's box:
// sampled every 250ms for 5 s at three viewports (desktop, phone portrait, phone landscape).
// The real (non-reduced) motion is used so the rotating bounding box is what's measured.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const overlap = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

test.use({ reducedMotion: 'no-preference' });

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`splash burst never touches the wordmark @ ${vp.width}×${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.goto('/'); // fresh context → the full intro (loading → splash)
    const splash = page.locator('.splash-screen');
    await expect(splash).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.splash-logo')).toBeVisible();

    const samples = [];
    for (let i = 0; i < 20; i++) {
      const s = await page.evaluate(() => {
        const b = document.querySelector('.splash-burst').getBoundingClientRect();
        const l = document.querySelector('.splash-logo').getBoundingClientRect();
        const pick = (r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
        return { burst: pick(b), logo: pick(l) };
      });
      samples.push(s);
      await page.waitForTimeout(250);
    }
    const hits = samples.filter((s) => overlap(s.burst, s.logo));
    expect(hits, `overlapping samples: ${JSON.stringify(hits.slice(0, 2))}`).toEqual([]);
    // Pinned: the burst's centre sits at the lower-right corner and does NOT move across the
    // 5 s (spin only — a drift path would walk it tens of px).
    const centres = samples.map((s) => ({
      x: (s.burst.left + s.burst.right) / 2, y: (s.burst.top + s.burst.bottom) / 2,
    }));
    const xs = centres.map((c) => c.x);
    const ys = centres.map((c) => c.y);
    expect(Math.max(...xs) - Math.min(...xs), `x drift ${JSON.stringify(xs)}`).toBeLessThan(3);
    expect(Math.max(...ys) - Math.min(...ys), `y drift ${JSON.stringify(ys)}`).toBeLessThan(3);
    expect(Math.abs(xs[0] - vp.width)).toBeLessThan(16);
    expect(Math.abs(ys[0] - vp.height)).toBeLessThan(16);
  });
}
