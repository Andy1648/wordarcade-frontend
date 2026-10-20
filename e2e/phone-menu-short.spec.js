// e2e/phone-menu-short.spec.js — THE PHONE MENU ON A SHORT PHONE (oct20 UI audit). Season 2's phone menu has FOUR mode
// rows (WORD RACE joined the column); on every phone under ~820px tall the rows kept their min-height and spilled
// downward, so SAT RUSH / WORD RACE slid under the CHAIN | FUSE band and the wallet (360x640 was 114px short).
// The suite runs season 1 by default, which has no WORD RACE row — so nothing caught it. Here, on season 2 at real
// phone viewports (an iPhone's Safari viewport is ~390x664): no two bands overlap, nothing leaves the screen, every
// mode row is still a 44px target.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SIZES = [[360, 640], [375, 667], [390, 664], [360, 740], [390, 844], [412, 780]];

for (const [w, h] of SIZES) {
  test(`phone menu fits at ${w}x${h} (season 2)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, h: b.height, n: el.className.split(' ').slice(0, 2).join('.') }; };
      const bands = [
        ...document.querySelectorAll('.hp-m-top, .hp-m-xp, .hp-m-per, .hp-m-hook, .hp-m-row, .hp-m-solo-btn, .menu-wins-chip, .menu-gems-chip, .hp-m-credits, .hp-m-rail .kb-rwrap'),
      ].filter((el) => el.getBoundingClientRect().height > 0).map(box);
      const hits = [];
      for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) {
        const a = bands[i], b = bands[j];
        const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ix > 2 && iy > 2) hits.push(`${a.n} x ${b.n} (${Math.round(ix)}x${Math.round(iy)})`);
      }
      const out = bands.filter((x) => x.b > innerHeight + 1 || x.r > innerWidth + 1 || x.t < -1 || x.l < -1).map((x) => x.n);
      const rows = [...document.querySelectorAll('.hp-m-row')].map((el) => Math.round(el.getBoundingClientRect().height));
      return { hits, out, rows };
    });
    expect(r.rows.length, 'the season-2 phone menu has four mode rows').toBe(4);
    expect(r.hits, 'no two menu bands overlap').toEqual([]);
    expect(r.out, 'nothing leaves the screen').toEqual([]);
    for (const hgt of r.rows) expect(hgt, 'every mode row stays a 44px target').toBeGreaterThanOrEqual(44);
  });
}
