// e2e/mobile-cards.spec.js — mobile card reachability guard.
//
// On phones the five mode cards are taller than the viewport. The menu stays ONE SCREEN with
// the card list scrolling inside a fixed frame (title + XP bar + action buttons pinned). This
// spec proves, at four phone sizes, that EVERY card can be brought fully into view by scrolling
// the card region, the XP bar NEVER scrolls out, and there is no horizontal scroll. It guards
// the regression where lower cards (CHAIN/FUSE) were clipped and unreachable.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
  { w: 414, h: 896 },
  { w: 360, h: 740 },
];
const CARDS = ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse'];

for (const { w, h } of VIEWPORTS) {
  test(`${w}x${h}: every mode card reachable, XP bar always visible, no h-scroll`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(400);

    const r = await page.evaluate(async (cards) => {
      const vh = window.innerHeight, vw = window.innerWidth;
      const region = document.querySelector('.homepage-cards-region');
      const xp = document.querySelector('.menu-xp-bar');
      if (!region || !xp) return { err: 'missing region or xp bar' };
      const seen = {}; for (const id of cards) seen[id] = false;
      let xpAlwaysVisible = true;
      const sample = () => {
        for (const id of cards) {
          const el = document.querySelector(`.game-card-magnet[data-game="${id}"]`);
          if (!el) continue;
          const b = el.getBoundingClientRect();
          if (b.top >= -0.5 && b.bottom <= vh + 0.5 && b.left >= -0.5 && b.right <= vw + 0.5) seen[id] = true;
        }
        const xb = xp.getBoundingClientRect();
        if (!(xb.top >= -0.5 && xb.bottom <= vh + 0.5)) xpAlwaysVisible = false;
      };
      sample();
      const max = region.scrollHeight - region.clientHeight;
      const step = Math.max(40, Math.floor(region.clientHeight / 3));
      for (let y = 0; y <= max; y += step) {
        region.scrollTop = y;
        await new Promise((rz) => requestAnimationFrame(rz));
        sample();
      }
      region.scrollTop = max;
      await new Promise((rz) => requestAnimationFrame(rz));
      sample();
      const de = document.documentElement;
      return { seen, xpAlwaysVisible, hOver: de.scrollWidth - de.clientWidth };
    }, CARDS);

    expect(r.err, r.err || '').toBeFalsy();
    const missing = CARDS.filter((id) => !r.seen[id]);
    expect(missing, `unreachable cards @ ${w}x${h}: ${missing.join(', ')}`).toHaveLength(0);
    expect(r.xpAlwaysVisible, `XP bar scrolled out of view @ ${w}x${h}`).toBe(true);
    expect(r.hOver, `horizontal overflow @ ${w}x${h}`).toBeLessThanOrEqual(0);
  });
}
