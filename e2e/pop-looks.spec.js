// e2e/pop-looks.spec.js — Andy oct19: "the looks dont seem to do anything at all". The equipped POP STYLE now dresses the
// menu's +N XP pops (popLooks.js): its fill, coloured outline and hard shadow; CLASSIC keeps the old dress; equipping in
// the shop re-dresses the open menu without a reload. (Shards skip under REDUCE MOTION — the e2e default — so the
// colour / outline / shadow on the pooled pop node is what is asserted.)
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.LOOK_SHOTS; // a folder → one screenshot per look (not part of the gate)

async function menuWith(page, popStyle, lv = 0) {
  await installBackendMock(page);
  await page.addInitScript(({ popStyle, lv }) => {
    if (sessionStorage.getItem('looks.seeded')) return;
    sessionStorage.setItem('looks.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    if (popStyle) localStorage.setItem('taw.equipped', JSON.stringify({ popStyle, soundPack: 'thock' }));
    if (lv) localStorage.setItem('taw.s2.xp', JSON.stringify({ lv, f: 0.05, rc: 0, v: 10 })); // deep in a level: a mash never levels up
  }, { popStyle, lv });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.waitForTimeout(800);
}

/** Type until a +N pop is up; return the computed dress of the newest visible one. */
async function popDress(page, kit = false) {
  let dress = null;
  await expect.poll(async () => {
    await page.keyboard.type('qwer', { delay: 90 });
    dress = await page.evaluate((kit) => {
      // kit: only a pop the worn look has dressed with its burst (the look's data loads at idle — a pop typed before it is
      // plain). The burst's SRC stays on the pooled node once set; its display only lasts the 360 ms flash, so waiting on the
      // display raced the poll under load
      const flashed = (e) => { const a = e.parentElement.querySelector('.menu-xp-pop-art'); return !!a && /\/burst-/.test(a.getAttribute('src') || ''); };
      const els = [...document.querySelectorAll('.menu-xp-pop:is(.is-tap, .is-key) .menu-xp-pop-plus')].filter((e) => /XP/.test(e.textContent) && (kit ? flashed(e) : !!e.style.color));
      const e = els[els.length - 1];
      if (!e) return null;
      const c = getComputedStyle(e);
      const art = e.parentElement.querySelector('.menu-xp-pop-art');
      return { color: c.color, stroke: c.webkitTextStrokeColor, shadow: c.textShadow, chip: e.classList.contains('is-kit') ? e.style.backgroundImage : null, art: art && art.getAttribute('src') ? art.getAttribute('src') : null };
    }, kit);
    return !!dress;
  }, { timeout: 10_000 }).toBe(true);
  return dress;
}

// oct25: a paid look throws its painted BURST behind the pop. nov2 (Andy: "the key themes also look very extra rn"): ONE
// idea per key — the +N in the look's own colour (heavy black outline, so it reads on any card) and, every other key, a
// small flash of its burst. No textured chip on a plain key (that is the CRIT's).
test('INFERNO: the +N wears the inferno colour and flashes the inferno burst — no chip', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, 'inferno');
  const d = await popDress(page, true);
  expect(d.art).toContain('burst-inferno');
  expect(['rgb(255, 107, 61)', 'rgb(255, 178, 61)']).toContain(d.color);
  expect(d.stroke).toBe('rgb(0, 0, 0)');
  expect(d.chip).toBeNull();
});

// nov2 "very extra": a look is a TASTEFUL upgrade — a mash never stacks a wall of art. Over 16 keys: no plain key wears
// the textured chip, the look throws no shards, its burst flashes on about every other key only, small and quick.
test('a worn look stays calm under a mash: burst every other key, small, quick; no chip; no shards', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, 'legend', 40); // LV 40: the mash stays inside one level (a level-up throws its own shards)
  await popDress(page, true); // the look is loaded
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__burst = { plays: 0, maxW: 0, maxMs: 0 };
    const play = Animation.prototype.play;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (kf, opts) {
      const a = animate.call(this, kf, opts);
      // a random CRIT can land mid-mash: its big painted burst (260 px) is the crit's own dress — these stats are the
      // PLAIN key's flash, so an art play on a crit pop is not counted (critPop sets .is-crit before it dresses the art)
      const pop = this.closest && this.closest('.menu-xp-pop');
      if (pop && pop.classList.contains('is-crit')) return a;
      if (this.classList && this.classList.contains('menu-xp-pop-art')) {
        window.__burst.plays++;
        window.__burst.maxMs = Math.max(window.__burst.maxMs, (opts && opts.duration) || 0);
        const peak = Math.max(...kf.map((f) => +(/scale\(([\d.]+)\)/.exec(f.transform) || [0, 0])[1]));
        window.__burst.maxW = Math.max(window.__burst.maxW, this.offsetWidth * peak);
      }
      return a;
    };
    window.__shards = 0;
    window.__crits = 0; // a random CRIT can land mid-mash: its look ring (6 shards) is by design — only plain keys must stay bare
    Animation.prototype.play = function () {
      const t = this.effect && this.effect.target;
      if (t && t.classList && t.classList.contains('menu-xp-shard')) window.__shards++;
      if (t && t.classList && t.classList.contains('menu-xp-pop') && t.classList.contains('is-crit')) window.__crits++;
      return play.call(this);
    };
  });
  for (let n = 0; n < 16; n++) { await page.keyboard.press('KeyA'); await page.waitForTimeout(90); }
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({ ...window.__burst, shards: window.__shards, crits: window.__crits, chips: document.querySelectorAll('.menu-xp-pop:not(.is-crit) .menu-xp-pop-plus.is-kit').length }));
  expect(r.chips, 'no textured chip on a plain key').toBe(0);
  expect(r.shards, 'a look throws no shards on a plain key (a crit throws its one ring of 6)').toBe(r.crits * 6);
  expect(r.plays, 'the burst flashes on about every other key, not every key').toBeLessThanOrEqual(9);
  expect(r.plays).toBeGreaterThanOrEqual(4);
  expect(r.maxW, 'the flash stays small (px)').toBeLessThanOrEqual(120);
  expect(r.maxMs, 'the flash is quick (ms)').toBeLessThanOrEqual(400);
});

test('CLASSIC keeps the old dress (black outline, no look shadow)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, null);
  const d = await popDress(page);
  expect(d.stroke).toBe('rgb(0, 0, 0)');
  expect(d.shadow).not.toContain('3px 3px 0px');
  expect(d.art).toBeNull();
});

test('equipping a look while the menu is open re-dresses the next pop (no reload)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, null);
  await popDress(page);
  // the shop's equip path is shop.saveEquipped → EQUIP_CHANGE; drive it the same way
  await page.evaluate(() => {
    localStorage.setItem('taw.equipped', JSON.stringify({ popStyle: 'toxic', soundPack: 'thock' }));
    window.dispatchEvent(new Event('taw:equip-change'));
  });
  await page.waitForTimeout(1500); // let the classic pops finish
  const d = await popDress(page, true);
  expect(d.art).toContain('burst-toxic');
});

if (SHOTS) {
  test.describe(() => {
    test.use({ reducedMotion: 'no-preference' });
    for (const id of ['classic', 'chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost', 'gold', 'plasma', 'nova', 'eclipse', 'legend']) {
      test(`shot ${id}`, async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await menuWith(page, id === 'classic' ? null : id);
        await page.keyboard.type('a', { delay: 70 });
        await page.waitForTimeout(60);
        const b = await page.evaluate(() => {
          const e = [...document.querySelectorAll('.menu-xp-pop:is(.is-tap, .is-key)')].filter((x) => /XP/.test(x.textContent)).pop();
          // freeze the pop (and its shards) at its readable hold — a still for the record, not app behaviour
          for (const a of document.getAnimations()) { const d = a.effect.getTiming().duration; if (typeof d === 'number') { a.pause(); a.currentTime = d * 0.3; } }
          const r = e.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.screenshot({ path: `${SHOTS}/look-${id}.png`, clip: { x: Math.max(0, b.x - 110), y: Math.max(0, b.y - 60), width: 220, height: 120 } });
      });
    }
  });
}
