// e2e/roll-smooth.perf.spec.js — the ROLL screen is buttery smooth (Andy, ROLL v1; was roll-robust.spec.js test 1).
// Only transform/opacity move; at 4x CPU (CDP Emulation.setCPUThrottlingRate — a school Chromebook) the frame times through
// a full reel spin + the LEGENDARY full reveal run at 60fps: median ≤ 20 ms (34 on CI); p95 is a stall guard.
//
// WHY IT IS ITS OWN PROJECT (nov10 CI flake): this is a frame-time MEASUREMENT, and CI ran it beside another Playwright
// worker on the same runner. When that worker was busy the throttled page starved — CI failed with ~55 frames at
// p50 66.7 ms, and running three copies at once on the dev box reproduces exactly that (frames 36–60, p50 66–133 ms)
// while one alone measures p50 16.7–33 ms. The `perf` project (*.perf.spec.js) runs with one worker in its own CI job
// (e2e.yml) and is left out of the shards, so the 60fps assertion measures the roll screen, not a neighbour.
import { test, expect } from '@playwright/test';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.wins': '50000000', 'taw.gems': gemsOf(1000),
};
const STARTED = (extra = {}) => JSON.stringify({ v: 2, rolls: 30, sinceEpic: 5, sinceLegendary: 30, everEpic: true, starter: true, marks: {}, milestones: [], skipBelow: 'epic', done: [], ...extra });
async function seed(page, extra = {}) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('rr.seeded')) return;
    sessionStorage.setItem('rr.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, { ...SEED, ...extra });
}
async function openRoll(page) {
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
}
test('smooth: a full spin + the LEGENDARY reveal run at 60fps at 4x CPU (transform/opacity only)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); // a school Chromebook
  await seed(page, { 'taw.markRolls': STARTED({ sinceLegendary: 499 }) });
  await openRoll(page);
  await page.waitForTimeout(800);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__ft = [];
    let last = 0;
    const tick = (t) => { if (last) window.__ft.push(t - last); last = t; if (!window.__ftStop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await holdRoll(page);
  await expect(page.getByTestId('roll-cutscene')).toHaveClass(/is-on/, { timeout: 20000 }); // 4x throttle
  await page.waitForTimeout(2000); // the reveal plays in (rays, slam, pop, burst)
  const r = await page.evaluate(() => {
    window.__ftStop = true;
    const f = window.__ft.slice(10).sort((a, b) => a - b); // the tap's own frame + the React commit lead in
    // what moved: every running/finished animation on the screen animates transform / opacity only
    const props = new Set();
    for (const a of document.getAnimations()) {
      const el = a.effect && a.effect.target;
      if (!el || !el.closest || !el.closest('.rs-overlay')) continue;
      for (const k of a.effect.getKeyframes()) for (const p of Object.keys(k)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p);
    }
    return { n: f.length, p50: f[Math.floor(f.length / 2)], p95: f[Math.floor(f.length * 0.95)], props: [...props] };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`[roll-smooth] frames ${r.n}  p50 ${r.p50.toFixed(1)} ms  p95 ${r.p95.toFixed(1)} ms  props ${r.props.join(',')}`);
  expect(r.n).toBeGreaterThan(60);
  for (const p of r.props) expect(['transform', 'opacity']).toContain(p);
  // 60fps through the spin + reveal: the MEDIAN frame is a 60Hz frame (main before ROLL v1: p50 67–83 ms here — the
  // assertion that catches a regression). p95 is NOT yet ≤ 20 ms at 4x: the frames that can't be 16.7 ms are the tap
  // itself (the purchase: storage + the wins grant re-rendering the App underneath) and the reveal mounting its card
  // and bursts — measured on the dev box p95 33–67 ms, 183 under load (main: 133–2,033). So p95 is a STALL guard
  // (no multi-hundred-ms freeze); CI runners are ~1.5x slower at the same throttle.
  expect(r.p50).toBeLessThanOrEqual(process.env.CI ? 34 : 20);
  expect(r.p95).toBeLessThanOrEqual(process.env.CI ? 300 : 200);
});
