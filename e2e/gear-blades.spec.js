// e2e/gear-blades.spec.js — THE FLOATING BLADES (nov2, Andy: "you havent done any components for the gear … effects or
// auras can look really good"): every EPIC+ gear's GearFx motes are PAINTED crystal blades in the tier's colours
// (fx/shards — never the masked sparkle), and both a breath (the shared scheduler) and a FLARE (the YOUR GEAR showcase)
// play them as finite transform/opacity one-shots that leave nothing looping. Real motion; the clock frozen + seeked.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { navControl } from './support/menu.js';

test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: 'no-preference' });

const SHOTS = process.env.SHARD_SHOTS || '';
const MYTHIC = 'mk-singularity';
const LEGENDARY = 'mk-thunderclap';
const OWN = [MYTHIC, LEGENDARY, 'mk-hydra', 'mk-origin', 'mk-brainstorm', 'mk-leviathan', 'mk-eclipse', 'mk-detonator'];

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  const marks = {};
  OWN.forEach((id, i) => { marks[id] = { n: 9, first: 1 + i }; });
  await page.addInitScript(({ marks, MYTHIC, LEGENDARY }) => {
    if (sessionStorage.getItem('gb.seeded')) return;
    sessionStorage.setItem('gb.seeded', '1');
    const seed = {
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1',
      'taw.xp': JSON.stringify({ lv: 60, into: 0 }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 9, v: 10 }), 'taw.s2.rebirths': '9',
      'taw.markRolls': JSON.stringify({ v: 3, rolls: 999, sinceEpic: 0, sinceLegendary: 0, everEpic: true, starter: true, marks, milestones: [] }),
      'taw.mark': MYTHIC, 'taw.s2.mark2': LEGENDARY, 'taw.seen.patch': 'x',
    };
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, { marks, MYTHIC, LEGENDARY });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'gears').first().click();
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
}

const blades = (page) => page.evaluate(() => {
  const ms = [...document.querySelectorAll('.mx-sheet .gfx-mote')];
  const live = (a) => (a.playState === 'running' || a.playState === 'paused') && a.effect && (a.currentTime || 0) >= (a.effect.getTiming().delay || 0);
  return {
    n: ms.length,
    tags: [...new Set(ms.map((m) => m.tagName))],
    srcs: ms.map((m) => m.getAttribute('src')),
    playing: ms.filter((m) => m.getAnimations().some(live)).length,
    inf: ms.some((m) => m.getAnimations().some((a) => a.effect && a.effect.getTiming().iterations === Infinity)),
    shown: ms.filter((m) => Number(getComputedStyle(m).opacity) > 0.3).map((m) => { const r = m.getBoundingClientRect(); return Math.max(r.width, r.height); }),
    visible: ms.filter((m) => Number(getComputedStyle(m).opacity) > 0.01).length,
  };
});
const freeze = (page) => page.evaluate(() => { window.__fz = document.getAnimations().map((a) => { a.pause(); return [a, a.currentTime || 0]; }); });
const seek = (page, t) => page.evaluate((ms) => { for (const [a, t0] of window.__fz) a.currentTime = t0 + ms; }, t);
const thaw = (page) => page.evaluate(() => { for (const [a] of window.__fz) a.play(); });

for (const [w, h] of [[1366, 768], [390, 844]]) {
  for (const [id, set, n] of [[MYTHIC, /(pink|cyan)/, 8], [LEGENDARY, /gold/, 4]]) {
    test(`${w}x${h} ${id}: the gear sheet's motes are painted blades — a flare and a breath, finite`, async ({ page }) => {
      await boot(page, w, h);
      await page.locator(`.mx-tile[data-mark="${id}"]`).first().click();
      const sheet = page.locator('.mx-sheet');
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(500);
      let b = await blades(page);
      expect(b.n).toBe(n);
      // the side facing the stats column keeps its blades hidden (GearSheet.css): none may ever sit on that text
      expect(await page.evaluate(() => [...document.querySelectorAll('.mx-sheet .gfx-mote.is-right')].every((m) => getComputedStyle(m).display === 'none'))).toBe(true);
      expect(b.tags).toEqual(['IMG']);
      for (const s of b.srcs) expect(s).toMatch(new RegExp(`/fx/shards/${set.source}-[0-3]\\.webp$`));
      // a FLARE (the showcase's one-shot)
      await page.evaluate(() => document.querySelector('.mx-sheet .gfx').dispatchEvent(new CustomEvent('gfx:flare')));
      await expect.poll(async () => (await blades(page)).playing, { timeout: 3000, intervals: [20] }).toBeGreaterThan(0);
      await freeze(page);
      await seek(page, 300);
      b = await blades(page);
      if (SHOTS) await sheet.screenshot({ path: `${SHOTS}/gear-${id}-${w}-flare.png` });
      expect(b.inf).toBe(false);
      expect(b.shown.length).toBeGreaterThan(0);
      expect(Math.max(...b.shown)).toBeGreaterThan(24); // a blade, not a speck
      await thaw(page);
      await expect.poll(async () => (await blades(page)).visible, { timeout: 4000 }).toBe(0);
      // a BREATH (the shared scheduler, every ~4.2 s)
      // the scheduler breathes ONE on-screen card a tick, round-robin (the INDEX grid behind the sheet is in the queue too)
      await expect.poll(async () => (await blades(page)).playing, { timeout: 25_000, intervals: [30] }).toBeGreaterThan(0);
      await freeze(page);
      await seek(page, 700);
      if (SHOTS) await sheet.screenshot({ path: `${SHOTS}/gear-${id}-${w}-breath.png` });
      b = await blades(page);
      expect(b.inf).toBe(false);
      await thaw(page);
    });
  }
}
