// e2e/pop-floor.spec.js — nov2 (Andy: "dont make the difference too visible (or else at some points the keys will be either
// too small (to begin with ... i noticed that once today ...) - just the original size worked"): the SMALLEST pop — a fresh
// save at LV1 — is never below the original size. The key letter is at least the original pop letter (--fs-h2), the +N at
// least the original "+N XP" (--fs-panel), and the pop's own scale is ≥ 1 (career growth only ever adds, popGrowth.js).
// POP_FLOOR_SHOTS=<folder> saves a screenshot per width.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.POP_FLOOR_SHOTS;

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`@${w}: a fresh LV1 key pop is at least the original size — letter + number readable`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('floor.seeded')) return;
      sessionStorage.setItem('floor.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      // no taw.s2.xp: LV1, no rebirths — the smallest career level there is
    });
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.waitForTimeout(800);
    let pop = null;
    await expect.poll(async () => {
      await page.keyboard.type('qwer', { delay: 90 });
      pop = await page.evaluate(() => {
        const px = (v) => { const p = document.createElement('span'); p.style.fontSize = v; document.body.appendChild(p); const n = parseFloat(getComputedStyle(p).fontSize); p.remove(); return n; };
        const els = [...document.querySelectorAll('.menu-xp-pop.is-key')].filter((e) => e.children[0].textContent && parseFloat(getComputedStyle(e).opacity) > 0.5);
        const e = els[els.length - 1];
        if (!e) return null;
        const a = e.getAnimations().find((x) => x.effect && x.effect.target === e);
        const scales = a ? a.effect.getKeyframes().map((k) => +(/scale\(([\d.]+)\)/.exec(k.transform) || [0, 1])[1]) : [1];
        return {
          letter: parseFloat(getComputedStyle(e.children[0]).fontSize),
          plus: parseFloat(getComputedStyle(e.children[1]).fontSize),
          scale: Math.max(...scales),
          h2: px('var(--fs-h2)'),
          panel: px('var(--fs-panel)'),
        };
      });
      return pop;
    }, { timeout: 15_000 }).not.toBeNull();
    expect(pop.letter, 'the key letter is at least the original pop letter').toBeGreaterThanOrEqual(pop.h2);
    expect(pop.plus, 'the +N is at least the original +N XP').toBeGreaterThanOrEqual(pop.panel);
    expect(pop.scale, 'LV1 is never shrunk below the original').toBeGreaterThanOrEqual(1);
    expect(pop.letter * pop.scale, 'the letter reads (px)').toBeGreaterThanOrEqual(28);
    expect(pop.plus * pop.scale, 'the number reads (px)').toBeGreaterThanOrEqual(16);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pop-floor-${w}.png` });
  });
}
