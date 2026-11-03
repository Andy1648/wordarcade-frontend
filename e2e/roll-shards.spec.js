// e2e/roll-shards.spec.js — the roll reveal's PAINTED BLADE SHARDS (fx/shards, Andy nov2 "shards … mobile legends
// aamon"): an EPIC+ reveal throws the tier's painted crystal sprites (never the old vector bits), each one a FINITE
// transform/opacity one-shot big enough to read, adding no infinite animation, and every shard is gone at rest.
// Real motion (the suite default is reduced motion, which plays no burst at all).
import { test, expect } from '@playwright/test';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: 'no-preference' });

const SHOTS = process.env.SHARD_SHOTS || '';
const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
// hard pity: sinceEpic 49 makes the roll EPIC+; sinceLegendary 59 makes it LEGENDARY+ (markRollsCore *_PITY_HARD)
const ROLLS = (sinceLegendary) => JSON.stringify({ v: 2, rolls: 30, sinceEpic: 49, sinceLegendary, everEpic: true, starter: true, marks: {}, milestones: [], skipBelow: 'epic', done: [] });
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.wins': '50000000', 'taw.gems': gemsOf(1000),
};

const PAINTED = /\/fx\/shards\/(violet|gold|pink|cyan|prism)-[0-3]\.webp$/;

// what the shard pool is doing right now: the playing shards' boxes + whether any of their animations loops
const shardState = (page) => page.evaluate(() => {
  const parts = [...document.querySelectorAll('.rs-cut .rs-part, .rs-parts.is-cut .rs-part')];
  // in FLIGHT = past its delay (a delayed WAAPI animation already reports 'running' while it waits)
  const flying = (a) => (a.playState === 'running' || a.playState === 'paused') && a.effect && (a.currentTime || 0) >= a.effect.getTiming().delay;
  const playing = parts.filter((p) => p.getAnimations().some(flying));
  const inf = parts.some((p) => p.getAnimations().some((a) => a.effect && a.effect.getTiming().iterations === Infinity));
  const big = playing.map((p) => { const r = p.getBoundingClientRect(); return Math.max(r.width, r.height); }).sort((a, b) => a - b);
  const visible = parts.filter((p) => Number(getComputedStyle(p).opacity) > 0.01).length;
  return { srcs: parts.map((p) => p.getAttribute('src')), playing: playing.length, inf, big, visible };
});
const infiniteCount = (page) => page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length);

for (const [w, h, tag, sinceLegendary] of [[1366, 768, 'epic', 30], [1920, 1080, 'epic', 30], [390, 844, 'epic', 30], [1366, 768, 'legendary', 59]]) {
  test(`${w}x${h} ${tag}+: the reveal throws painted blade shards, finite, gone at rest`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript((s) => {
      if (sessionStorage.getItem('rs.seeded')) return;
      sessionStorage.setItem('rs.seeded', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, { ...SEED, 'taw.markRolls': ROLLS(sinceLegendary) });
    await page.goto('/?portal=1');
    await menuReady(page);
    await page.locator('.hp-nav.is-gears:visible').first().click();
    await page.locator('.rs-overlay').waitFor();
    await holdRoll(page);
    await expect(page.getByTestId('roll-cutscene')).toHaveClass(/is-on/, { timeout: 15_000 });

    // the burst: wait until the shard pool is in flight, then FREEZE the page clock (every animation paused) and seek
    // it forward in fixed steps — a screenshot takes longer than the burst lasts, so real-time shots miss it
    await expect.poll(async () => (await shardState(page)).playing, { timeout: 8000, intervals: [20] }).toBeGreaterThan(5);
    await page.evaluate(() => {
      window.__fz = document.getAnimations().map((a) => { a.pause(); return [a, a.currentTime || 0]; });
    });
    const seek = (ms) => page.evaluate((t) => { for (const [a, t0] of window.__fz) a.currentTime = t0 + t; }, ms);
    let mid = null;
    for (const ms of [60, 180, 420]) {
      await seek(ms);
      if (ms === 180) mid = await shardState(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/roll-shards-${tag}-${w}-${ms}.png` });
    }
    await page.evaluate(() => { for (const [a] of window.__fz) a.play(); });
    for (const s of mid.srcs) expect(s).toMatch(PAINTED);
    expect(mid.inf).toBe(false);
    expect(mid.big[Math.floor(mid.big.length / 2)]).toBeGreaterThan(40); // nothing tiny: a shard reads as a blade, not a speck
    const during = await infiniteCount(page);

    // at rest: every shard has played out and faded, and the burst left no loop behind
    await expect.poll(async () => (await shardState(page)).visible, { timeout: 4000 }).toBe(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/roll-shards-${tag}-${w}-rest.png` });
    expect(await infiniteCount(page)).toBeLessThanOrEqual(during);
  });
}
