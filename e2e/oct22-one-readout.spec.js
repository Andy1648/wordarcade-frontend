// e2e/oct22-one-readout.spec.js — Andy oct22: "it looks too AI … 5 bars to indicate progress and then 0/5 again —
// clear def of stupidity". ACHIEVEMENTS shows ONE progress read-out an item (a tile = its bar; the hero = its count),
// a LEGENDARIES shelf (the eight 100% gears, silhouettes until owned), and MASTERY is a winding road of painted art with
// no definitions. Seeded with real progress; neither tab scrolls at 1366x768 / 1280x600 / 390x844 / 360x640.
// Shots land in claude/shots-mastery2.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { isPhoneMenu, navControl } from './support/menu.js';

const SHOTS = 'claude/shots-mastery2';
const SECRET = 'c4'.repeat(24);
const toReach = (lv) => { let s = 0; for (let l = 1; l < lv; l++) s += Math.round(30 + 1.2 * l * l); return s; };
const MASTERY = { chain: toReach(9) + 40, 'word-bomb': toReach(6) + 12, 'category-blitz': toReach(3) + 5, 'sat-rush': toReach(2) + 3 };
const ROAD = { chain: [0], 'word-bomb': [0, 1, 2] };
// TYPE WORDS at 4,200 / 5,000 (II claimed), ROLL EPIC+ I ready, FIND GEARS maxed (ARCHIVIST owned), the rest under way
const COUNT = { words: 4200, bots: 38, epic: 3, mp: 2, chain: 14, reb: 1, power: 1, marks: Array.from({ length: 28 }, (_, i) => `m${i}`) };
const CLAIMED = { type: 2, bots: 1, index: 3, chain: 2 };

async function boot(page) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-or', username: 'Readout', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, m, road, count, claimed }) => {
    if (sessionStorage.getItem('or.seeded')) return;
    sessionStorage.setItem('or.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Readout' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.count', JSON.stringify(count));
    localStorage.setItem('taw.s2.ach', JSON.stringify(claimed));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 340 }));
    localStorage.setItem('taw.mastery', JSON.stringify(m));
    localStorage.setItem('taw.s2.road', JSON.stringify(road));
  }, { secret: SECRET, id: row.id, m: MASTERY, road: ROAD, count: COUNT, claimed: CLAIMED });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'stats').waitFor({ state: 'visible' });
  await page.locator(isPhoneMenu(page) ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach').click();
  const ach = page.locator('.av3-overlay');
  await ach.waitFor({ state: 'visible' });
  return ach;
}
const noScroll = (page) => page.evaluate(() => {
  const o = document.querySelector('.av3-overlay');
  const bad = [];
  if (o.scrollHeight > o.clientHeight + 1) bad.push(`overlay h ${o.scrollHeight}>${o.clientHeight}`);
  if (o.scrollWidth > o.clientWidth + 1) {
    const far = [...o.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > o.clientWidth + 1).slice(0, 3).map((e) => e.className && e.className.baseVal === undefined ? e.className : e.tagName);
    bad.push(`overlay w ${o.scrollWidth}>${o.clientWidth} (${far.join(' | ')})`);
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push('page w');
  return bad.join(', ');
});
const inside = async (page, loc, vp) => {
  const b = await loc.boundingBox();
  return b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1;
};

for (const vp of [{ width: 1366, height: 768, tag: 'laptop' }, { width: 1280, height: 600, tag: 'short' }, { width: 390, height: 844, tag: 'phone' }, { width: 360, height: 640, tag: 'phone-sm' }]) {
  test(`${vp.tag}: one read-out an item, LEGENDARIES, the mastery road — no scroll`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const ach = await boot(page);
    // the ACHIEVEMENTS tab (an achievement tier is ready, so it opens here)
    await expect(ach.locator('.av3-cell')).toHaveCount(8);
    await expect(ach.locator('.av3-pips, .av3-pct, .av3-ladder, .av3-tiers, .av3-hero-pct')).toHaveCount(0); // the doubled read-outs are gone
    for (const cell of await ach.locator('.av3-cell').all()) {
      // a tile: its bar OR its CLAIM — never a count beside it
      await expect(cell.locator('.av3-have, .av3-need')).toHaveCount(0);
      expect(await cell.locator('.av3-bar, .av3-claim').count()).toBe(1);
    }
    const lg = ach.locator('.av3-lg-item');
    await expect(lg).toHaveCount(8);
    await expect(ach.locator('.av3-lg-item.is-owned')).toHaveCount(1);
    await expect(ach.locator('.av3-lg-item.is-owned')).toHaveAttribute('data-gear', 'mk-curator');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-1-achievements.png` });
    expect(await noScroll(page)).toBe('');
    expect(await inside(page, lg.last(), vp), 'the last legendary on screen').toBe(true);
    expect(await inside(page, ach.locator('.av3-cell').last(), vp), 'the last tile on screen').toBe(true);

    // a LEGENDARY tap puts its ladder in the hero (its count, no bar)
    await ach.locator('.av3-lg-item[data-gear="mk-ironhand"]').click();
    await expect(ach.locator('.av3-hero')).toHaveAttribute('data-hero', 'type');
    await expect(ach.locator('.av3-hero .av3-have')).toHaveText('4,200');
    await expect(ach.locator('.av3-hero .av3-bar')).toHaveCount(0);

    // MASTERY
    await ach.getByRole('tab', { name: 'MASTERY' }).click();
    const panel = ach.getByTestId('mastery-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.mp-node')).toHaveCount(12);
    await expect(panel).not.toContainText('='); // no "75 GEMS = 1 ROLL" definitions
    await expect(panel.locator('[data-kind="badge"] img[src*="emblem"]')).toHaveCount(0); // the metal badges are gone
    await expect(panel.locator('.mp-node.is-l')).toHaveCount(3); // the milestones stand bigger
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-2-mastery.png` });
    expect(await noScroll(page)).toBe('');
    for (const i of [0, 11]) expect(await inside(page, panel.getByTestId(`road-node-${i}`), vp), `node ${i} on screen`).toBe(true);

    await panel.getByTestId('road-claim-1').click(); // CHAIN's first chest
    await expect(panel.getByTestId('road-node-1')).toHaveAttribute('data-state', 'claimed');
    await ach.locator('.mp-mode[data-mode="word-bomb"]').click();
    await expect(panel.getByTestId('road-node-2')).toHaveAttribute('data-state', 'claimed');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-3-mastery-bomb.png` });
  });
}
