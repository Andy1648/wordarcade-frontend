// e2e/phone-menu-short.spec.js — THE PHONE MENU IS TAPS, WITH ROOM (oct20 UI audit + Andy oct21: "no one's really gonna be
// typing. I should just be tapping … I don't want a text box", "this is just so cramped … maybe we can introduce more of the
// scroll"). Season 2's phone menu has FOUR mode rows (WORD RACE joined the column); squeezed into one short screen they
// spilled onto each other (360x640: SAT RUSH under CHAIN | FUSE, a tap on it hit CHAIN). The suite runs season 1 by
// default, which has no WORD RACE row — so nothing caught it. Here, season 2 at real phone sizes (an iPhone's Safari
// viewport is ~390x664), first visit AND returning:
//   - no text box anywhere on the phone menu (the first-visit TYPE A WORD input is gone);
//   - no two bands overlap, nothing runs off the side, every mode row is a big 64px target;
//   - a short phone SCROLLS to its last tile instead of crushing the rows; a tall one (390x844) fits without scrolling.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SIZES = [[360, 640], [375, 667], [390, 664], [360, 740], [390, 844], [412, 780]];

// FIRST VISIT = the first-run reveal's TITLE (progress/reveal.js stage 0, feat/first-run-reveal): the wordmark, the level
// bar, the hero, ONE PLAY and the open modes as a row of chips — at every phone size it FITS (no scroll at all), nothing
// overlaps, every control is a 44px target, and there is still no text box.
for (const [w, h] of SIZES) {
  test(`phone TITLE at ${w}x${h} (season 2, brand-new save): one PLAY, fits, no overlap`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const m = document.querySelector('.hp-m');
      const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, h: b.height, w: b.width, n: el.className.split(' ').slice(0, 2).join('.') }; };
      const bands = [...document.querySelectorAll('.hp-m-top, .hp-m-xp, .tp-play, .tp-pick-k, .tp-chip, .hp-m-credits')]
        .filter((el) => el.getBoundingClientRect().height > 0).map(box);
      const hits = [];
      for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) {
        const a = bands[i], b = bands[j];
        const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ix > 2 && iy > 2) hits.push(`${a.n} x ${b.n} (${Math.round(ix)}x${Math.round(iy)})`);
      }
      const taps = bands.filter((x) => /tp-play|tp-chip|hp-m-credits/.test(x.n) && x.h < 44).map((x) => x.n);
      return {
        hits, taps,
        side: bands.filter((x) => x.r > innerWidth + 1 || x.l < -1).map((x) => x.n),
        off: bands.filter((x) => x.b > innerHeight + 1).map((x) => x.n),
        rows: document.querySelectorAll('.hp-m-row, .hp-m-rail').length,
        chips: document.querySelectorAll('.tp-chip').length,
        inputs: m.querySelectorAll('input, textarea').length,
        sy: m.scrollHeight - m.clientHeight,
        sx: m.scrollWidth - m.clientWidth,
      };
    });
    expect(r.inputs, 'no text box on the phone menu — it is taps only').toBe(0);
    expect(r.rows, 'the title replaces the mode rows and the rail').toBe(0);
    expect(r.chips, 'the open modes are one tap away').toBeGreaterThanOrEqual(3);
    expect(r.hits, 'nothing overlaps').toEqual([]);
    expect(r.side, 'nothing runs off the side').toEqual([]);
    expect(r.off, 'nothing runs off the bottom').toEqual([]);
    expect(r.taps, 'every control is a 44px target').toEqual([]);
    expect(r.sy, 'the title fits on one screen').toBeLessThanOrEqual(0);
    expect(r.sx, 'no sideways scroll').toBeLessThanOrEqual(0);
  });
}

for (const [w, h] of SIZES) {
  for (const firstVisit of [false]) {
    test(`phone menu at ${w}x${h} (season 2, ${firstVisit ? 'first visit' : 'returning'}): taps only, no overlap, room to tap`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      if (!firstVisit) await page.addInitScript(() => { try { localStorage.setItem('wa_has_played', '1'); } catch { /* blocked */ } });
      await page.goto('/?portal=1&season2=1');
      await menuReady(page);
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const m = document.querySelector('.hp-m');
        const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, n: el.className.split(' ').slice(0, 2).join('.') }; };
        const bands = [
          ...document.querySelectorAll('.hp-m-top, .hp-m-xp, .hp-m-per, .hp-m-row, .hp-m-solo-btn, .menu-wins-chip, .menu-gems-chip, .hp-m-credits, .hp-m-rail .kb-rwrap'),
        ].filter((el) => el.getBoundingClientRect().height > 0).map(box);
        const hits = [];
        for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) {
          const a = bands[i], b = bands[j];
          const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (ix > 2 && iy > 2) hits.push(`${a.n} x ${b.n} (${Math.round(ix)}x${Math.round(iy)})`);
        }
        const side = bands.filter((x) => x.r > innerWidth + 1 || x.l < -1).map((x) => x.n);
        const rows = [...document.querySelectorAll('.hp-m-row')].map((el) => Math.round(el.getBoundingClientRect().height));
        const inputs = m.querySelectorAll('input, textarea').length;
        // the last tile is reachable: scrolled to the bottom, it sits inside the menu's box
        m.scrollTop = m.scrollHeight;
        const mb = m.getBoundingClientRect();
        const tiles = [...document.querySelectorAll('.hp-m-rail .kb-rwrap')];
        const last = tiles[tiles.length - 1].getBoundingClientRect();
        const reach = last.bottom <= mb.bottom + 1 && last.bottom <= innerHeight + 1;
        const sy = m.scrollHeight - m.clientHeight;
        m.scrollTop = 0;
        return { hits, side, rows, inputs, reach, sy, sx: m.scrollWidth - m.clientWidth };
      });
      expect(r.inputs, 'no text box on the phone menu — it is taps only').toBe(0);
      expect(r.rows.length, 'the season-2 phone menu has four mode rows').toBe(4);
      expect(r.hits, 'no two menu bands overlap').toEqual([]);
      expect(r.side, 'nothing runs off the side').toEqual([]);
      expect(r.sx, 'no sideways scroll').toBeLessThanOrEqual(0);
      for (const hgt of r.rows) expect(hgt, 'every mode row is a big tap target').toBeGreaterThanOrEqual(63);
      expect(r.reach, 'the last tile is reachable by scrolling').toBe(true);
      if (h >= 844) expect(r.sy, 'a tall phone fits on one screen').toBeLessThanOrEqual(0);
    });
  }
}
