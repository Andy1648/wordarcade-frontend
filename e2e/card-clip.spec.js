// e2e/card-clip.spec.js — item 1: EVERY mode card's bounding box (transform included) sits
// fully inside EVERY clipping ancestor's box with >=8px margin on all four sides. The prior
// pass only padded the horizontal axis; the real clipper was .homepage-cards-scroll's
// overflow-y (it shaved the row-1 card tops and hid row 2 below the fold). Now nothing between
// the card and the viewport clips it tighter than the stage, which clears every card.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, isPagedMenu } from './support/menu.js';

const VIEWPORTS = [
  { w: 2560, h: 1440 },
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
  { w: 1163, h: 501 },
  // Chromebook sizes — the menu pages its cards here (3 a page); both pages are checked.
  { w: 1366, h: 657 },
  { w: 1280, h: 551 },
];

async function perCardMargins(page) {
  return page.evaluate(() => {
    // Rendered cards only — a paged short-wide menu hides the other page (display:none).
    const cards = [...document.querySelectorAll('.game-card-magnet')].filter((m) => m.getClientRects().length > 0);
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
    await menuReady(page);
    await page.waitForTimeout(300);
    let cards = await perCardMargins(page);
    if (isPagedMenu(page)) {
      expect(cards.length, 'three cards a page').toBe(3);
      // Flip by KEY, not a click: moving the pointer swings the cards' cursor-magnetic lean, which
      // skews every rect this measures (a 3D lean read as "text clipped by its card").
      await page.locator('.homepage-cards-arrow.is-next').waitFor(); // the lazy pager (keys) is in
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
      cards = [...cards, ...(await perCardMargins(page))];
    }
    expect(cards.length).toBe(6); // R1: WORD RACE is on for everyone
    for (const c of cards) {
      // eslint-disable-next-line no-console
      console.log(`[card-clip ${w}x${h}] ${c.name}: worst=${c.worst}px @${c.worstAnc}`);
      expect(c.worst, `${c.name} worst ancestor margin @ ${w}x${h} (@${c.worstAnc})`).toBeGreaterThanOrEqual(8);
    }
  });
}
