// e2e/bar-multilevel.spec.js
//
// ANDY (oct5): "PROGRESS BAR lags on multi-level climbs. Each level passed = a fast full-fill flash
// (~100ms each, capped ~1s total), level number ticks up, then fill to the real %. Never sit
// half-filled or behind the real value."
//
// Seeds a LV1 save on 6 rebirths (×5^6 XP a letter), so ONE menu keystroke credits tens of levels.
// Asserts the menu bar's level numeral ticks THROUGH levels (not one jump), and that within ~1.5 s
// the numeral shows the REAL level and the fill sits at the REAL fraction (lib/barPlan: ≤ 1 s of
// flashes + a 200 ms fill). Runs with real motion — under reduced motion the bar would just land.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test.use({ reducedMotion: 'no-preference' });

test('a multi-level gain flashes through the levels and lands on the real level + fraction within ~1.5 s', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('bar-multilevel-seeded')) return;
      sessionStorage.setItem('bar-multilevel-seeded', '1');
      const save = JSON.stringify({ lv: 1, f: 0, rc: 6, v: 10 });
      localStorage.setItem('taw.xp', save);
      localStorage.setItem('taw.xpv10', save);
      localStorage.setItem('taw.rebirths', '6');
      localStorage.setItem('taw.econ', '12'); // already on Rebirth Rush (no conversion)
    } catch {
      /* storage blocked */
    }
  });
  await installBackendMock(page);
  await page.goto('/?portal=1');
  // v2 menu: the bar is the kit's KitXpBar (root .menu-xp-bar.kx; numeral .kx-lv-n, fill .kx-fill = scaleX)
  await page.locator('.menu-xp-bar.kx').waitFor({ state: 'visible' });

  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const num = () => document.querySelector('.menu-xp-bar .kx-lv-n');
    const fill = () => document.querySelector('.menu-xp-bar .kx-fill');
    const scaleOf = (el) => {
      const m = /scaleX\(([^)]+)\)/.exec((el && el.style.transform) || '');
      return m ? Number(m[1]) : NaN;
    };
    const parseLv = (t) => Number(String(t || '').replace(/[^0-9]/g, ''));
    await sleep(800); // the menu's entry wipe + the bar's mount landing
    const before = window.__tawXp();
    const startShown = parseLv(num() && num().textContent);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    const t0 = performance.now();
    const real = window.__tawXp();
    const seen = [];
    let landedAt = null;
    while (performance.now() - t0 < 2500) {
      await new Promise((r) => requestAnimationFrame(r));
      const shown = parseLv(num() && num().textContent);
      if (seen[seen.length - 1] !== shown) seen.push(shown);
      const s = scaleOf(fill());
      const want = real.frac;
      if (landedAt == null && shown === real.level && Math.abs(s - want) < 0.005 && document.querySelector('.menu-xp-bar').dataset.state === 'rest') {
        landedAt = performance.now() - t0;
      }
    }
    const endScale = scaleOf(fill());
    return {
      beforeLevel: before.level,
      startShown,
      realLevel: real.level,
      realFrac: real.frac,
      seen,
      landedAt,
      endShown: parseLv(num().textContent),
      endScale,
      endWant: real.frac,
    };
  });

  // The keystroke really was a multi-level climb.
  expect(result.realLevel - result.beforeLevel).toBeGreaterThanOrEqual(5);
  expect(result.startShown).toBe(result.beforeLevel);
  // The numeral TICKED through levels (not one jump), only ever upward.
  expect(result.seen.length).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < result.seen.length; i += 1) expect(result.seen[i]).toBeGreaterThan(result.seen[i - 1]);
  // It landed on the real level AND the real fraction within ~1.5 s, and stayed there.
  expect(result.landedAt).not.toBeNull();
  expect(result.landedAt).toBeLessThanOrEqual(1500);
  expect(result.endShown).toBe(result.realLevel);
  expect(Math.abs(result.endScale - result.endWant)).toBeLessThan(0.005);
});
