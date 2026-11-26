// e2e/title-fit.spec.js — the FIRST-RUN TITLE (TitlePlay, stage 0 of the reveal) fills the screen (Andy nov26 "very
// compressed": the empty rail + right-column tracks squeezed it into the middle third, small chips under a small PLAY).
// At each size this FAILS on: the title using under 70% of the page width (desktop); the hero under 40% of the title's
// height; the hero, PLAY and OR PICK chips overlapping each other or leaving the viewport; a chip under 16px text or
// 44px tall; any page scroll.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const SIZES = [[1366, 768], [1536, 864], [1920, 1080], [2560, 1440], [390, 844]];

for (const [w, h] of SIZES) {
  test(`${w}x${h}: the first-run title fills the screen, nothing overlaps`, async ({ browser }) => {
    const phone = w < 500;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('tf')) return;
      sessionStorage.setItem('tf', '1');
      localStorage.clear();
      // a brand-new save, past the 2-step menu tour and the patch notes (they sit on top of the title)
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seen.patch', '2026-10-22');
    });
    await page.goto('/?portal=1');
    await page.locator('.tp').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      const q = (s) => document.querySelector(s);
      const chips = [...document.querySelectorAll('.tp-chip')];
      return {
        tp: box(q('.tp')), hero: box(q('.tp-stage')), play: box(q('.tp-play')), pick: box(q('.tp-pick')),
        chips: chips.map((c) => ({ ...box(c), fs: parseFloat(getComputedStyle(c).fontSize) })),
        sx: document.documentElement.scrollWidth - innerWidth, sy: document.documentElement.scrollHeight - innerHeight,
      };
    });
    const apart = (a, b) => a.r <= b.l + 0.5 || b.r <= a.l + 0.5 || a.b <= b.t + 0.5 || b.b <= a.t + 0.5;
    expect(m.sx, 'page scrolls sideways').toBeLessThanOrEqual(0);
    expect(m.sy, 'page scrolls down').toBeLessThanOrEqual(0);
    if (!phone) {
      expect(m.tp.w / w, 'the title uses the page width').toBeGreaterThanOrEqual(0.7);
      expect(m.hero.h / m.tp.h, 'the hero is a real share of the title').toBeGreaterThanOrEqual(0.4);
      expect(apart(m.hero, m.play), 'hero overlaps PLAY').toBe(true);
      expect(apart(m.hero, m.pick), 'hero overlaps OR PICK').toBe(true);
    }
    expect(apart(m.play, m.pick), 'PLAY overlaps OR PICK').toBe(true);
    for (const [i, a] of m.chips.entries()) {
      expect(a.fs, 'chip text too small').toBeGreaterThanOrEqual(15);
      expect(a.h, 'chip under the 44px touch target').toBeGreaterThanOrEqual(44);
      expect(a.l >= -0.5 && a.r <= w + 0.5 && a.b <= h + 0.5, 'chip off screen').toBe(true);
      for (const b of m.chips.slice(i + 1)) expect(apart(a, b), 'two chips overlap').toBe(true);
    }
    await ctx.close();
  });
}
