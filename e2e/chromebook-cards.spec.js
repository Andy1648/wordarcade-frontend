// e2e/chromebook-cards.spec.js — the desktop menu's SCROLLING CARD GRID (feat/menu-six-grid; it replaced the
// feat/chromebook-card-pages carousel, Andy oct5 "game cards are flattened and look horrendous", and the MORE GAMES
// panel — Andy nov25 "that but like make it scrollable downwards").
//
// Every mode is one 3-across grid with no arrows: two rows (six cards) fill the first screen, the third row PEEKS in
// under them, and ONLY the cards area scrolls. At every desktop size this FAILS on:
//   (a) a pager control left in the DOM, or a card missing from the grid;
//   (b) on the first screen: not exactly six cards fully in view, or no peek of the next row (the scroll must be
//       obvious); a first-screen card cut off by the viewport or under another element;
//   (c) on a 3:4-capable screen (>= 768px tall), a card more than 5% off the portrait-tablet ratio — slightly squat
//       cards are the short-screen trade for the peek (1366x657 / 1280x551 / 1163x501);
//   (d) scrolling the cards area moving the wordmark / scrolling the page, or not bringing the last card fully into
//       view; a card there not opening its mode dialog;
//   (e) the cards not centred in the console (left gap = right gap).
// WIDE MONITORS (Andy nov26 "huge gap"): where the panel is wide enough a FOURTH column joins — every card is then on
// the first screen (no peek, no scroll) and the row fills the console instead of floating in it (f).
import { test, expect } from '@playwright/test';
import { GAMES } from '../src/gameData.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, scrollCards, cardsInView } from './support/menu.js';

const RATIO_TOL = 0.05;
const TOL = 0.5;
const FIRST = Math.min(6, GAMES.length);

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // the fit-math's second rAF pass
}

// every grid card's shape, and for the ones fully in the scrollport: off-viewport overhang + whether it is covered
function readCards(page) {
  return page.evaluate(() => {
    const s = document.querySelector('.homepage-cards-scroll');
    const port = s.getBoundingClientRect();
    return [...document.querySelectorAll('.homepage-cards-grid > .game-card-magnet')].map((m) => {
      const card = m.querySelector('.game-card');
      const r = card.getBoundingClientRect();
      const inView = r.top >= port.top - 0.5 && r.bottom <= port.bottom + 0.5;
      const peeks = !inView && r.top < port.bottom - 8 && r.bottom > port.bottom;
      const clip = Math.max(0 - r.left, r.right - innerWidth, 0 - r.top, r.bottom - innerHeight, 0);
      const hit = inView ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      const covered = hit && !m.contains(hit) ? `${hit.tagName.toLowerCase()}.${String(hit.getAttribute('class') || '').split(' ')[0]}` : '';
      return { game: m.getAttribute('data-game'), w: card.offsetWidth, h: card.offsetHeight, ratio: card.offsetWidth / card.offsetHeight, inView, peeks, clip, covered };
    });
  });
}

const SIZES = [
  { w: 2560, h: 1440, full: true, wide: true },
  { w: 1920, h: 1080, full: true, wide: true },
  { w: 1366, h: 768, full: true },
  // 1366x657: two full rows at 3:4 use every pixel of the cards area, so the peek costs the cards a little height
  { w: 1366, h: 657, full: false },
  { w: 1280, h: 551, full: false },
  { w: 1163, h: 501, full: false },
];

for (const { w, h, full, wide } of SIZES) {
  test(`${w}x${h}: six cards fill the first screen, the next row peeks, only the cards area scrolls`, async ({ page }) => {
    await installBackendMock(page);

    // The reference shape: a portrait tablet's card (3:4, every card on one screen, no scroll).
    await boot(page, 900, 1180);
    const tall = await readCards(page);
    expect(tall.length).toBe(GAMES.length);
    const ref = tall.map((c) => c.ratio).sort((a, b) => a - b)[Math.floor(tall.length / 2)];

    await boot(page, w, h);
    await expect(page.locator('.homepage-stage')).toHaveAttribute('data-paged', '');
    // (a)
    await expect(page.locator('.homepage-cards-arrow, .homepage-cards-dot, .homepage-cards-nav, .homepage-cards-more'), 'no pager / MORE left').toHaveCount(0);
    const cards = await readCards(page);
    expect(cards.length, 'every mode is on the grid').toBe(GAMES.length);
    // (b) the first screen
    const first = cards.filter((c) => c.inView);
    if (wide) {
      await expect(page.locator('.homepage-cards-grid'), 'four across on a wide monitor').toHaveAttribute('data-cols', '4');
      expect(first.length, 'every card fully in view on the first screen').toBe(Math.min(8, GAMES.length));
    } else {
      await expect(page.locator('.homepage-cards-grid'), 'three across under a wide monitor').toHaveAttribute('data-cols', '3');
      expect(first.length, 'six cards fully in view on the first screen').toBe(FIRST);
      if (GAMES.length > FIRST) expect(cards.some((c) => c.peeks), 'the next row peeks in under the first six').toBe(true);
    }
    for (const c of first) {
      // eslint-disable-next-line no-console
      console.log(`[scroll-grid ${w}x${h}] ${c.game} ${c.w}x${c.h} ratio=${c.ratio.toFixed(3)} (ref ${ref.toFixed(3)})`);
      expect(c.clip, `${c.game} off the viewport`).toBeLessThanOrEqual(TOL);
      expect(c.covered, `${c.game} is under another element`).toBe('');
      if (full) expect(Math.abs(c.ratio - ref) / ref, `${c.game} ${c.w}x${c.h} is squashed`).toBeLessThanOrEqual(RATIO_TOL); // (c)
    }

    if (GAMES.length <= first.length) return;
    // (d) scroll the cards area: the page and the wordmark stay put, the last card comes fully into view
    const logoY = await page.locator('.homepage-logo').evaluate((el) => el.getBoundingClientRect().top);
    await scrollCards(page, 'end');
    expect(await page.evaluate(() => document.scrollingElement.scrollTop), 'the page itself never scrolls').toBe(0);
    expect(await page.locator('.homepage-logo').evaluate((el) => el.getBoundingClientRect().top), 'the wordmark stays put').toBeCloseTo(logoY, 0);
    const last = GAMES.length === FIRST ? null : (await page.locator('.homepage-cards-grid > .game-card-magnet').last().getAttribute('data-game'));
    expect(await cardsInView(page), 'the last card is fully in view at the end').toContain(last);
    await page.locator(`.homepage-cards-grid > .game-card-magnet[data-game="${last}"] .game-card`).click();
    await expect(page.locator('.mode-dialog-shell, .lp-panel').first()).toBeVisible();
  });
}

// (e) Andy oct6 SEASON 2 #5 "centre game cards exactly": the cards are centred IN THE CONSOLE (equal gaps to the cards
// region's edges, ±1.5px).
for (const { w, h } of [{ w: 1366, h: 657 }, { w: 1366, h: 768 }, { w: 1280, h: 551 }, { w: 1920, h: 1080 }]) {
  test(`${w}x${h}: the cards are centred — left gap = right gap`, async ({ page }) => {
    await installBackendMock(page);
    await boot(page, w, h);
    const g = await page.evaluate(() => {
      const rs = [...document.querySelectorAll('.homepage-cards-grid > .game-card-magnet')].map((m) => m.getBoundingClientRect());
      const box = document.querySelector('.homepage-cards-region').getBoundingClientRect();
      return { left: Math.min(...rs.map((r) => r.left)) - box.left, right: box.right - Math.max(...rs.map((r) => r.right)) };
    });
    expect(g.left, 'a card is outside the console').toBeGreaterThanOrEqual(0);
    expect(Math.abs(g.left - g.right), `left gap ${g.left.toFixed(1)} vs right gap ${g.right.toFixed(1)}`).toBeLessThanOrEqual(1.5);
  });
}

// (f) Andy nov26: on a wide monitor the card row FILLS the console — no wide empty band either side of it.
for (const { w, h } of [{ w: 1920, h: 1080 }, { w: 2560, h: 1440 }]) {
  test(`${w}x${h}: the card row fills the console's width`, async ({ page }) => {
    await installBackendMock(page);
    await boot(page, w, h);
    const f = await page.evaluate(() => {
      const rs = [...document.querySelectorAll('.homepage-cards-grid > .game-card-magnet')].map((m) => m.getBoundingClientRect());
      const box = document.querySelector('.homepage-cards-region').getBoundingClientRect();
      return (Math.max(...rs.map((r) => r.right)) - Math.min(...rs.map((r) => r.left))) / box.width;
    });
    expect(f, 'the row spans at least 90% of the console').toBeGreaterThanOrEqual(0.9);
  });
}
