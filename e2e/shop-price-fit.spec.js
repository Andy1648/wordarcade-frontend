// e2e/shop-price-fit.spec.js — Andy oct19: "the costs of upgrades in shop are getting overlapped by the lower boundaries
// of the cards". Every UPGRADES card's price plate sits wholly inside its card face (above the bottom border), at the
// laptop, short-laptop, big and phone sizes. (The oct19 dot fix had given the grid top padding, which shrank every row.)
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { navControl } from './support/menu.js';

const SIZES = [[1366, 768], [1280, 551], [1280, 720], [1920, 1080], [390, 844], [360, 640]];
// every DEAL OF THE HOUR window (v3/stock.js dealOf — the pins shop-deal / shop-badges use): the deal card's ribbon + struck
// price change its layout, so an unpinned clock let CI pass or fail by the hour it ran (nov4: OVERDRIVE's hour, 1280x551)
const DEAL_HOURS = { wins25: 1796085000000, luck2: 1796092200000, overdrive: 1796095800000, xp25: 1796103000000, extend: 1796117400000 };

for (const [w, h] of SIZES) {
  for (const [deal, at] of Object.entries(DEAL_HOURS)) {
  test(`${w}x${h} · ${deal}'s deal hour: every shop price sits inside its card`, async ({ page }) => {
    await page.clock.setFixedTime(at);
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('spf.seeded')) return;
      sessionStorage.setItem('spf.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 5000 }));
    });
    await page.goto('/?portal=1&season2=1');
    await navControl(page, 'shop').click();
    await page.getByTestId('daily-spin-card').waitFor({ state: 'visible' });
    await page.waitForTimeout(600); // the shelf's arrival slide
    const bad = await page.evaluate(() => [...document.querySelectorAll('.sp2-grid:not([hidden]) .sp2-card')].map((card) => {
      const face = card.querySelector('.kstc-card');
      const price = card.querySelector('.sp2-price');
      if (!face || !price) return null;
      const f = face.getBoundingClientRect();
      const p = price.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(face).borderBottomWidth) || 0;
      const name = (card.querySelector('.sp2-name') || card).textContent.trim().slice(0, 24);
      return p.bottom <= f.bottom - border + 0.5 && p.top >= f.top ? null : { name, priceBottom: Math.round(p.bottom), faceInner: Math.round(f.bottom - border) };
    }).filter(Boolean));
    expect(bad, JSON.stringify(bad)).toEqual([]);
    expect(await page.locator('.sp2-grid:not([hidden]) .sp2-card').count()).toBeGreaterThan(2);
  });
  }
}
