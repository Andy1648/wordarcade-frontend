// e2e/card-clip.spec.js — item 1: EVERY mode card's bounding box (transform included) sits
// fully inside EVERY clipping ancestor's box with >=8px margin on all four sides. The prior
// pass only padded the horizontal axis; the real clipper was .homepage-cards-scroll's
// overflow-y (it shaved the row-1 card tops and hid row 2 below the fold). Now nothing between
// the card and the viewport clips it tighter than the stage, which clears every card.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { GAMES } from '../src/gameData.js';

const VIEWPORTS = [
  { w: 2560, h: 1440 },
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
  { w: 1163, h: 501 },
];

async function perCardMargins(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('.game-card-magnet')];
    return cards.map((m) => {
      const c = m.querySelector('.game-card').getBoundingClientRect();
      const name = m.getAttribute('data-game') || '?';
      // Walk every ancestor; for each that clips (overflow != visible on an axis), record the
      // tightest of the four side-margins.
      let el = m.parentElement;
      let worst = Infinity;
      let worstAnc = '';
      while (el && el !== document.body) {
        const s = getComputedStyle(el);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const r = el.getBoundingClientRect();
          const mmin = Math.min(c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom);
          if (mmin < worst) {
            worst = mmin;
            worstAnc = (el.className || '').toString().split(' ')[0];
          }
        }
        el = el.parentElement;
      }
      return { name, worst: Math.round(worst), worstAnc };
    });
  });
}

for (const { w, h } of VIEWPORTS) {
  test(`${w}x${h}: every card is >=8px inside every clipping ancestor`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    const cards = await perCardMargins(page);
    expect(cards.length).toBe(GAMES.length); // all mode cards present (grows as modes are added)
    for (const c of cards) {
      // eslint-disable-next-line no-console
      console.log(`[card-clip ${w}x${h}] ${c.name}: worst=${c.worst}px @${c.worstAnc}`);
      expect(c.worst, `${c.name} worst ancestor margin @ ${w}x${h} (@${c.worstAnc})`).toBeGreaterThanOrEqual(8);
    }
  });
}
