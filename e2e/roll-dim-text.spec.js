// e2e/roll-dim-text.spec.js — Andy nov2: "the cover that dims the left and right side after rolling also covers the
// words under the cards". The landing SHADES + edge fades (Reel.jsx, .rs-win) reach below the band; the result line
// under the cards (and the FOUND row) must sit ABOVE them. Every text element's centre must hit-test to itself
// (elementFromPoint), never to a shade / fade / the band — after a single roll, an EPIC reveal, and a DOUBLE ROLL.
// Design audit nov2, same reveal: the backdrop is SOLID (no ghost reel card, no ROLL halves beside the stats), the stats
// show ONCE (on the card), TAP TO CONTINUE sits in clear space, and at rest the pointer is PARKED above the card.
import { test, expect } from '@playwright/test';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test.describe.configure({ timeout: 60_000 });

const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const STARTED = (extra = {}) => JSON.stringify({ v: 2, rolls: 30, sinceEpic: 5, sinceLegendary: 30, everEpic: true, starter: true, marks: {}, milestones: [], skipBelow: 'epic', done: [], ...extra });
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.wins': '50000000', 'taw.gems': gemsOf(1000), 'taw.markRolls': STARTED(),
};

async function openRoll(page, extra = {}) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('rd.seeded')) return;
    sessionStorage.setItem('rd.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, { ...SEED, ...extra });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
}
// tap through any reveal still up (RollScreen swallows clicks for 800 ms after a reveal closes)
async function keepReveal(page) {
  const cut = page.getByTestId('roll-cutscene');
  let clear = 0;
  for (let i = 0; i < 40 && clear < 3; i += 1) {
    if (await cut.evaluate((el) => el.classList.contains('is-on'))) {
      clear = 0;
      await cut.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(900);
    } else clear += 1;
    await page.waitForTimeout(150);
  }
}
/** Every element under `sel` that owns visible text, whose centre does NOT hit-test to itself / its own subtree. */
// elementFromPoint SKIPS pointer-events:none nodes — and every shade / fade / dim is pointer-events:none — so for the
// probe every node on the roll screen is made hit-testable: the hit is then whatever is PAINTED on top. A layer resting
// fully transparent (the TELL plate, the reveal flash) covers nothing visible, so it is stepped through.
const covered = (page, sel) => page.evaluate((s) => {
  const probe = document.createElement('style');
  probe.textContent = '.rs-overlay, .rs-overlay *, .rs-overlay *::before, .rs-overlay *::after { pointer-events: auto !important; }';
  document.head.appendChild(probe);
  const skipped = [];
  const invisible = (n) => {
    for (let e = n; e && e.nodeType === 1; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (Number(c.opacity) === 0 || c.visibility === 'hidden') return true;
    }
    return false;
  };
  const hitAt = (x, y) => {
    for (let i = 0; i < 12; i += 1) {
      const h = document.elementFromPoint(x, y);
      if (!h || !invisible(h)) return h;
      h.style.setProperty('pointer-events', 'none', 'important');
      skipped.push(h);
    }
    return document.elementFromPoint(x, y);
  };
  const out = [];
  for (const root of document.querySelectorAll(s)) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const hit = hitAt(r.x + r.width / 2, r.y + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit) || root.contains(hit))) {
        out.push(`${el.textContent.trim().slice(0, 24)} → ${hit ? `${hit.tagName}.${String(hit.className)}` : 'null'}`);
      }
      for (const k of skipped.splice(0)) k.style.removeProperty('pointer-events');
    }
  }
  probe.remove();
  return out;
}, sel);
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations()
  .filter((a) => a.effect && a.effect.getTiming().iterations !== Infinity)
  .map((a) => a.finished.catch(() => {}))));

for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 551], [1024, 768], [390, 844], [360, 640]]) {
  test(`${w}x${h}: after a roll the result line under the cards is above the dim`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openRoll(page);
    await holdRoll(page);
    await expect(page.getByTestId('mark-roll-result')).toHaveCount(1, { timeout: 15000 });
    await keepReveal(page);
    await settle(page);
    // the shades ARE up (the dim this test is about)
    expect(Number(await page.locator('.rs-shade.is-l').evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.3);
    expect(await covered(page, '[data-testid="mark-roll-result"]')).toEqual([]);
    expect(await covered(page, '.rsx-coll')).toEqual([]);
    // design audit nov2 ("EGG T|MER"): once landed the pointer is PARKED — no bar through the card, the top triangle
    // ends above the landed card's top edge
    const ptr = await page.evaluate(() => {
      const win = document.querySelector('.rs-win');
      const bar = win.querySelector('.rs-ptr > .rs-ptr-bar');
      const tri = win.querySelector('.rs-ptr > .rs-ptr-tri.is-top').getBoundingClientRect();
      const card = win.querySelector('.rs-cell.is-land .mc').getBoundingClientRect();
      return { parked: win.classList.contains('is-parked'), bar: Number(getComputedStyle(bar).opacity), triBottom: tri.bottom, cardTop: card.top };
    });
    expect(ptr.parked).toBe(true);
    expect(ptr.bar).toBe(0);
    expect(ptr.triBottom).toBeLessThanOrEqual(ptr.cardTop + 2);
  });
}

const box = (page, sel) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, r: r.right, b: r.bottom };
});
const overlap = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 551], [1024, 768], [390, 844], [360, 640]]) {
  test(`${w}x${h} EPIC reveal: solid backdrop, ONE stat block, TAP TO CONTINUE in clear space`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openRoll(page, { 'taw.markRolls': STARTED({ sinceEpic: 49 }) }); // hard pity: the roll is EPIC+
    await holdRoll(page);
    const cut = page.getByTestId('roll-cutscene');
    await expect(cut).toHaveClass(/is-on/, { timeout: 15000 });
    await expect(page.locator('.rs-cut-keep')).toHaveCSS('opacity', '1', { timeout: 10000 }); // card + stats are in
    // the card + its stats sit above every dim layer
    expect(await covered(page, '.rs-cut.is-on .rs-cut-mark')).toEqual([]);
    // SOLID backdrop: no ghost of the reel card, no ROLL slab peeking out beside the stats
    expect(await cut.evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/^rgb\(/);
    const rollHit = await page.evaluate(() => {
      const r = document.querySelector('.rs-roll').getBoundingClientRect();
      const out = [];
      for (const fx of [0.08, 0.5, 0.92]) {
        const h = document.elementFromPoint(r.x + r.width * fx, r.y + r.height / 2);
        out.push(!!(h && h.closest('.rs-cut')));
      }
      return out;
    });
    expect(rollHit).toEqual([true, true, true]);
    // ONE stat block: the MAIN stat + substats are on the reveal card (in view), and the side plate never repeats them
    // (it holds perks / a duplicate's gems only, or is not there at all)
    await expect(page.locator('.rs-cut.is-on .rs-cut-card .mc-hero')).toBeVisible();
    await expect(page.locator('.rs-cut.is-on .rs-cut-card .mc-subs')).toBeVisible();
    expect(await page.locator('.rs-cut.is-on .mc').count()).toBe(1); // the reveal card is the only card on the reveal
    await expect(page.locator('.rs-cut.is-on .rv-main, .rs-cut.is-on .rv-extra')).toHaveCount(0);
    const card = await box(page, '.rs-cut.is-on .rv-card');
    expect(card.y).toBeGreaterThanOrEqual(-1);
    expect(card.b).toBeLessThanOrEqual(h + 1);
    // TAP TO CONTINUE: on screen, clear of the card and of any side plate
    const keep = await box(page, '.rs-cut-keep');
    expect(keep.x).toBeGreaterThanOrEqual(-1);
    expect(keep.r).toBeLessThanOrEqual(w + 1);
    expect(keep.b).toBeLessThanOrEqual(h + 1);
    expect(overlap(keep, card)).toBe(false);
    if (await page.getByTestId('roll-reveal-stats').count()) {
      expect(overlap(keep, await box(page, '[data-testid="roll-reveal-stats"]'))).toBe(false);
    }
    expect(await covered(page, '.rs-cut-keep')).toEqual([]);
    // after the tap the line under the cards is above the dim
    await keepReveal(page);
    await settle(page);
    expect(await covered(page, '[data-testid="mark-roll-result"]')).toEqual([]);
  });
}

test('DOUBLE ROLL (two-row line) at 390x844: every chip is above the dim', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoll(page, {
    'taw.markRolls': STARTED({ marks: { 'mk-singularity': { n: 1, first: 1 } }, skipBelow: 'legendary' }),
    'taw.marksOwned': '["mk-singularity"]',
    'taw.mark': 'mk-singularity',
  });
  await holdRoll(page);
  await expect(page.getByTestId('mark-roll-result')).toHaveCount(1, { timeout: 15000 });
  await keepReveal(page);
  await expect(page.getByTestId('mark-roll-extra')).toHaveCount(1, { timeout: 12000 });
  await keepReveal(page);
  await settle(page);
  expect(await covered(page, '[data-testid="mark-roll-result"]')).toEqual([]);
});
