// e2e/chromebook-cards.spec.js — feat/chromebook-card-pages (Andy oct5): "CHROMEBOOK LAYOUT (test
// 1366x657 and 1280x551): game cards are flattened and look horrendous. Fix: show 3 cards per page at
// the full card ratio, flip between page 1 and page 2 with arrows/swipe/arrow keys and a page
// indicator. No squashed cards, no cut-off cards."
//
// At both sizes this FAILS on:
//   (a) anything but THREE rendered cards on a page;
//   (b) a card whose width/height is more than 5% off the TALL-DESKTOP ratio (measured live at
//       1920x1080 in the same test, never a hardcoded 0.75 — if the card's shape changes, so does this);
//   (c) a card cut off — its transformed box past the viewport or any clipping ancestor;
//   (d) the next arrow / → key / ← key not flipping to the OTHER three, or the two-dot indicator not
//       following the page;
//   (e) a letter key flipping the page (letters belong to the menu's TYPE A WORD typing);
//   (f) an arrow under the 44px touch floor, off screen, or covered (e.g. by the corner nav).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SIZES = [
  { w: 1366, h: 657 },
  { w: 1280, h: 551 },
];
const RATIO_TOL = 0.05;
const TOL = 0.5;

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // the fit-math's second rAF pass
}

// Every RENDERED card: its layout ratio (offset box — the 3:4 the fit-math set, before the featured
// scale / rest tilt) and the worst overhang of its transformed box past any clipping ancestor or the
// viewport.
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
      // nothing else (the corner nav, an arrow) sits on top of the card's centre
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const covered = hit && !m.contains(hit) ? `${hit.tagName.toLowerCase()}.${String(hit.getAttribute('class') || '').split(' ')[0]}` : '';
      out.push({ game: m.getAttribute('data-game'), w: card.offsetWidth, h: card.offsetHeight, ratio: card.offsetWidth / card.offsetHeight, clip, by, covered });
    }
    return out;
  });
}

const pageOf = (page) => page.locator('.homepage-cards-grid').getAttribute('data-page');
const dotOn = (page) => page.locator('.homepage-cards-dot.is-on').getAttribute('data-page');

for (const { w, h } of SIZES) {
  test(`${w}x${h}: three full-ratio cards a page, arrows / keys flip to the other three, dots follow`, async ({ page }) => {
    await installBackendMock(page);

    // The reference: the card's shape on a PORTRAIT tablet, the one desktop-width layout that still shows all six
    // (feat/menu-centre: every landscape desktop pages now).
    await boot(page, 900, 1180);
    const tall = await readCards(page);
    expect(tall.length, 'a portrait tablet shows all six cards').toBe(6);
    await expect(page.locator('.homepage-cards-arrow'), 'no pager on a portrait tablet').toHaveCount(0);
    const ref = tall.map((c) => c.ratio).sort((a, b) => a - b)[3];

    await boot(page, w, h);
    await expect(page.locator('.homepage-stage')).toHaveAttribute('data-paged', '');

    // (f) arrows clear the touch floor
    for (const sel of ['.homepage-cards-arrow.is-prev', '.homepage-cards-arrow.is-next']) {
      const b = await page.locator(sel).boundingBox();
      expect(b, `${sel} is rendered`).not.toBeNull();
      expect(b.width, `${sel} width`).toBeGreaterThanOrEqual(44);
      expect(b.height, `${sel} height`).toBeGreaterThanOrEqual(44);
      // fully on screen and on top (not under the corner nav)
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w);
      expect(b.y + b.height).toBeLessThanOrEqual(h);
      const onTop = await page.locator(sel).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && el.contains(hit);
      });
      expect(onTop, `${sel} is not covered`).toBe(true);
    }
    await expect(page.locator('.homepage-cards-dot')).toHaveCount(2);

    const check = async (label) => {
      const cards = await readCards(page);
      expect(cards.length, `${label}: three cards on the page`).toBe(3);
      for (const c of cards) {
        // eslint-disable-next-line no-console
        console.log(`[chromebook ${w}x${h} ${label}] ${c.game} ${c.w}x${c.h} ratio=${c.ratio.toFixed(3)} (ref ${ref.toFixed(3)}) clip=${c.clip.toFixed(1)}${c.by ? `@${c.by}` : ''}`);
        expect(Math.abs(c.ratio - ref) / ref, `${label}: ${c.game} ${c.w}x${c.h} is squashed (ratio ${c.ratio.toFixed(3)} vs ${ref.toFixed(3)})`).toBeLessThanOrEqual(RATIO_TOL);
        expect(c.clip, `${label}: ${c.game} cut off by ${c.by}`).toBeLessThanOrEqual(TOL);
        expect(c.covered, `${label}: ${c.game} is under another element`).toBe('');
      }
      return cards.map((c) => c.game);
    };

    // page 1
    expect(await pageOf(page)).toBe('0');
    expect(await dotOn(page)).toBe('0');
    await expect(page.locator('.homepage-cards-arrow.is-prev')).toHaveAttribute('aria-disabled', 'true');
    const p1 = await check('page 1');

    // (d) the next arrow → page 2: the OTHER three
    await page.locator('.homepage-cards-arrow.is-next').click();
    await page.waitForTimeout(350);
    expect(await pageOf(page)).toBe('1');
    expect(await dotOn(page)).toBe('1');
    await expect(page.locator('.homepage-cards-arrow.is-next')).toHaveAttribute('aria-disabled', 'true');
    const p2 = await check('page 2');
    expect(new Set([...p1, ...p2]).size, 'the two pages hold six different modes').toBe(6);

    // (d) ← back to page 1, → to page 2 again (keys work from anywhere on the menu)
    await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(350);
    expect(await pageOf(page)).toBe('0');
    expect(await dotOn(page)).toBe('0');
    expect(await check('keys back')).toEqual(p1);

    // (e) a letter is typing, never a flip
    await page.keyboard.press('d');
    await page.keyboard.press('l');
    await page.waitForTimeout(100);
    expect(await pageOf(page), 'letters never flip the page').toBe('0');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(350);
    expect(await pageOf(page)).toBe('1');
    expect(await dotOn(page)).toBe('1');
    expect(await check('keys forward')).toEqual(p2);
  });
}

// Andy oct6 SEASON 2 #5 "centre game cards exactly" → Andy oct7 (feat/menu-centre, "how tiny the game cards looked",
// mockup v3 B's proportions): paging is the desktop default and the cards take the whole console — the XP bar's
// columns, right of the rail — so they are centred IN THE CONSOLE (equal gaps to the cards region's edges, ±1.5px),
// never shifted inside it, on every page. 1920x1080 pages too now (3 cards, not a 6-up row).
const cardGaps = (page) => page.evaluate(() => {
  const rs = [...document.querySelectorAll('.homepage-cards-grid > .game-card-magnet')]
    .filter((m) => m.getClientRects().length)
    .map((m) => m.getBoundingClientRect());
  const box = document.querySelector('.homepage-cards-region').getBoundingClientRect();
  const left = Math.min(...rs.map((r) => r.left)) - box.left;
  const right = box.right - Math.max(...rs.map((r) => r.right));
  return { n: rs.length, left, right };
});
for (const { w, h, paged } of [{ w: 1366, h: 657, paged: true }, { w: 1280, h: 551, paged: true }, { w: 1920, h: 1080, paged: true }]) {
  test(`${w}x${h}: the cards are centred — left gap = right gap (±1px)`, async ({ page }) => {
    await installBackendMock(page);
    await boot(page, w, h);
    const pages = paged ? 2 : 1;
    for (let p = 0; p < pages; p += 1) {
      if (p > 0) {
        await page.locator('.homepage-cards-arrow.is-next').click();
        await expect.poll(() => pageOf(page)).toBe(String(p));
        await page.waitForTimeout(450); // the finite flip slide
      }
      const g = await cardGaps(page);
      expect(g.n, `cards on page ${p}`).toBe(paged ? 3 : 6);
      expect(g.left, `page ${p}: a card is outside the console`).toBeGreaterThanOrEqual(0);
      expect(Math.abs(g.left - g.right), `page ${p}: left gap ${g.left.toFixed(1)} vs right gap ${g.right.toFixed(1)}`).toBeLessThanOrEqual(1.5); // 1.5: the flipped page lands on a sub-pixel
    }
  });
}
