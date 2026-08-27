// e2e/purchase-feel-perf.spec.js — feat/purchase-feel perf report (item 1).
// Types at 30 keys/sec on the menu at each KEY POWER feel-tier and measures median
// frame time (3 runs), peak concurrent animations, and the INFINITE-animation count
// (must be unchanged — every tier effect is a finite, pooled one-shot).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const RUN_MS = 2000; // ~60 keystrokes at 30/sec
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

async function measure(page, tier) {
  await page.addInitScript((t) => {
    try { localStorage.setItem('taw.keytier', String(t)); } catch { /* */ }
  }, tier);
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(500);

  // Start a frame-time recorder + a peak-animation sampler in the page.
  await page.evaluate(() => {
    window.__frames = [];
    window.__peakAnims = 0;
    window.__infinite = 0;
    let last = performance.now();
    const loop = (now) => {
      window.__frames.push(now - last);
      last = now;
      const anims = document.getAnimations();
      if (anims.length > window.__peakAnims) window.__peakAnims = anims.length;
      let inf = 0;
      for (const a of anims) {
        const it = a.effect && a.effect.getTiming && a.effect.getTiming().iterations;
        if (it === Infinity) inf += 1;
      }
      if (inf > window.__infinite) window.__infinite = inf;
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });

  // Type at ~30 keys/sec for RUN_MS.
  const start = Date.now();
  let k = 0;
  while (Date.now() - start < RUN_MS) {
    await page.keyboard.press(KEYS[k % KEYS.length]);
    k += 1;
    await page.waitForTimeout(33); // ~30/sec
  }

  const res = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = window.__frames.slice(5).sort((a, b) => a - b); // drop warmup frames
    const median = f.length ? f[Math.floor(f.length / 2)] : 0;
    const p95 = f.length ? f[Math.floor(f.length * 0.95)] : 0;
    return { median, p95, peakAnims: window.__peakAnims, infinite: window.__infinite, keys: window.__frames.length };
  });
  return res;
}

test('perf: frame time + animation counts per KEY POWER tier', async ({ page }) => {
  test.setTimeout(120000);
  const rows = [];
  for (const tier of [0, 1, 2, 3, 4, 5]) {
    const runs = [];
    for (let r = 0; r < 3; r += 1) runs.push(await measure(page, tier));
    const medians = runs.map((x) => x.median).sort((a, b) => a - b);
    const medianOf3 = medians[1];
    const peak = Math.max(...runs.map((x) => x.peakAnims));
    const inf = Math.max(...runs.map((x) => x.infinite));
    rows.push({ tier, medianMs: medianOf3.toFixed(2), peakAnims: peak, infinite: inf });
    // eslint-disable-next-line no-console
    console.log(`PERF | T${tier} | median frame ${medianOf3.toFixed(2)}ms | peak concurrent anims ${peak} | infinite ${inf}`);
  }
  // Infinite-animation count must be the SAME at every tier (the menu's baseline —
  // no NEW infinite loops were added by the tier effects).
  const infs = rows.map((r) => r.infinite);
  expect(new Set(infs).size, `infinite-animation count varies by tier: ${infs.join(',')}`).toBe(1);
  // Frame time: headless rAF is bimodal (~16.7/33.3ms) and does NOT correlate with
  // tier — the printed medians are the report; here we only guard against a runaway
  // (a real jank regression would blow well past the rAF cadence). The reliable
  // signals are the infinite count (above) and peak concurrent anims (printed).
  for (const r of rows) expect(Number(r.medianMs), `T${r.tier} median ${r.medianMs}ms`).toBeLessThan(50);
});
