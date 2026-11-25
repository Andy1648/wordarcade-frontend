// e2e/chromebook-cards.spec.js — the desktop menu's SIX-CARD GRID (feat/menu-six-grid; it replaced the
// feat/chromebook-card-pages carousel, Andy oct5 "game cards are flattened and look horrendous").
//
// The menu shows SIX cards at once (no arrows, no pages) and the modes past six sit behind MORE GAMES. At every
// desktop size this FAILS on:
//   (a) anything but six rendered cards on the grid, or any pager control left in the DOM;
//   (b) a card cut off (its box past the viewport or a clipping ancestor) or under another element;
//   (c) on a 3:4-capable screen (>= 657px tall), a card more than 5% off the portrait-tablet ratio — squat cards
//       are the short-screen LAST RESORT only (1280x551 / 1163x501);
//   (d) MORE GAMES under the 44px touch floor, off screen or covered; or not opening the panel with the rest of the
//       modes, whose card opens the same mode dialog;
//   (e) the cards not centred in the console (left gap = right gap — the MORE tile has a twin spacer).
import { test, expect } from '@playwright/test';
import { GAMES } from '../src/gameData.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, openMoreGames } from './support/menu.js';

const RATIO_TOL = 0.05;
const TOL = 0.5;
const SIX = Math.min(6, GAMES.length);

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // the fit-math's second rAF pass
}

function readCards(page) {
  return page.evaluate(() => {
    const out = [];
    for (const m of document.querySelectorAll('.homepage-cards-grid > .game-card-magnet')) {
      if (!m.getClientRects().length) continue;
      const card = m.querySelector('.game-card');
      const r = card.getBoundingClientRect();
      let clip = Math.max(0 - r.left, r.right - innerWidth, 0 - r.top, r.bottom - innerHeight, 0);
      let by = clip > 0 ? 'viewport' : '';
      for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const b = a.getBoundingClientRect();
        const o = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom, 0);
        if (o > clip) { clip = o; by = String(a.className).split(' ')[0]; }
      }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const covered = hit && !m.contains(hit) ? `${hit.tagName.toLowerCase()}.${String(hit.getAttribute('class') || '').split(' ')[0]}` : '';
      out.push({ game: m.getAttribute('data-game'), w: card.offsetWidth, h: card.offsetHeight, ratio: card.offsetWidth / card.offsetHeight, clip, by, covered });
    }
    return out;
  });
}

const SIZES = [
  { w: 1920, h: 1080, full: true },
  { w: 1366, h: 768, full: true },
  { w: 1366, h: 657, full: true },
  { w: 1280, h: 551, full: false },
  { w: 1163, h: 501, full: false },
];

for (const { w, h, full } of SIZES) {
  test(`${w}x${h}: six cards at once, no pager, nothing cut off; MORE GAMES opens the rest`, async ({ page }) => {
    await installBackendMock(page);

    // The reference shape: a portrait tablet's card (3:4 with room to spare).
    await boot(page, 900, 1180);
    const tall = await readCards(page);
    expect(tall.length, 'a portrait tablet shows six cards').toBe(SIX);
    const ref = tall.map((c) => c.ratio).sort((a, b) => a - b)[Math.floor(tall.length / 2)];

    await boot(page, w, h);
    await expect(page.locator('.homepage-stage')).toHaveAttribute('data-paged', '');
    // (a)
    await expect(page.locator('.homepage-cards-arrow, .homepage-cards-dot, .homepage-cards-nav'), 'no pager left').toHaveCount(0);
    const cards = await readCards(page);
    expect(cards.length, 'six cards on the grid').toBe(SIX);
    for (const c of cards) {
      // eslint-disable-next-line no-console
      console.log(`[six-grid ${w}x${h}] ${c.game} ${c.w}x${c.h} ratio=${c.ratio.toFixed(3)} (ref ${ref.toFixed(3)}) clip=${c.clip.toFixed(1)}${c.by ? `@${c.by}` : ''}`);
      expect(c.clip, `${c.game} cut off by ${c.by}`).toBeLessThanOrEqual(TOL); // (b)
      expect(c.covered, `${c.game} is under another element`).toBe('');
      if (full) expect(Math.abs(c.ratio - ref) / ref, `${c.game} ${c.w}x${c.h} is squashed`).toBeLessThanOrEqual(RATIO_TOL); // (c)
    }

    if (GAMES.length <= SIX) return;
    // (d) MORE GAMES
    const more = page.locator('.homepage-cards-more');
    const b = await more.boundingBox();
    expect(b, 'MORE GAMES is rendered').not.toBeNull();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
    expect(b.y + b.height).toBeLessThanOrEqual(h);
    const onTop = await more.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    });
    expect(onTop, 'MORE GAMES is not covered').toBe(true);

    const shown = cards.map((c) => c.game);
    await openMoreGames(page);
    const extra = await page.locator('.mm-panel .game-card-magnet').evaluateAll((ms) => ms.map((m) => m.getAttribute('data-game')));
    expect(extra.length, 'the panel holds every mode past six').toBe(GAMES.length - SIX);
    expect(new Set([...shown, ...extra]).size, 'grid + MORE = every mode, once').toBe(GAMES.length);
    // the panel fits the screen
    const pb = await page.locator('.mm-panel').boundingBox();
    expect(pb.y).toBeGreaterThanOrEqual(0);
    expect(pb.y + pb.height).toBeLessThanOrEqual(h);
    // Escape closes it; a card in it opens the same mode dialog a grid card does
    await page.keyboard.press('Escape');
    await expect(page.locator('.mm-panel')).toHaveCount(0);
    await openMoreGames(page);
    await page.locator(`.mm-panel .game-card-magnet[data-game="${extra[0]}"] .game-card`).click();
    await expect(page.locator('.mm-panel')).toHaveCount(0);
    await expect(page.locator('.mode-dialog-shell, .lp-panel').first()).toBeVisible();
  });
}

// (e) Andy oct6 SEASON 2 #5 "centre game cards exactly": the six cards are centred IN THE CONSOLE (equal gaps to the
// cards region's edges, ±1.5px) — the MORE tile on the right is balanced by its twin spacer on the left. (At 1280x551
// and narrower the spacer does not fit beside three minimum-width cards; the cards then sit half a tile left of centre
// rather than shrink — test (b) above still holds them inside the console.)
for (const { w, h } of [{ w: 1366, h: 657 }, { w: 1366, h: 768 }, { w: 1920, h: 1080 }]) {
  test(`${w}x${h}: the six cards are centred — left gap = right gap`, async ({ page }) => {
    await installBackendMock(page);
    await boot(page, w, h);
    const g = await page.evaluate(() => {
      const rs = [...document.querySelectorAll('.homepage-cards-grid > .game-card-magnet')]
        .filter((m) => m.getClientRects().length)
        .map((m) => m.getBoundingClientRect());
      const box = document.querySelector('.homepage-cards-region').getBoundingClientRect();
      return { n: rs.length, left: Math.min(...rs.map((r) => r.left)) - box.left, right: box.right - Math.max(...rs.map((r) => r.right)) };
    });
    expect(g.n).toBe(SIX);
    expect(g.left, 'a card is outside the console').toBeGreaterThanOrEqual(0);
    expect(Math.abs(g.left - g.right), `left gap ${g.left.toFixed(1)} vs right gap ${g.right.toFixed(1)}`).toBeLessThanOrEqual(1.5);
  });
}
