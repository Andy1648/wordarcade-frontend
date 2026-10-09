// e2e/v2-achievements.spec.js — THE v2 ACHIEVEMENTS SCREEN (P3; claude/mockups/v2/Achievements.dc.html) behind
// ?season2=1, with the season-2 board mock. It is the ONLY claim place: opened from the menu's ACHIEVEMENTS trophy.
//   1. the hero next-claim panel, the 4 × 2 grid, tiers I–V; CLAIM pays the tier's GEMS ONCE (a double click pays
//      once), the tile is stamped CLAIMED, the gems fly to the counter and the pill lands on the new balance;
//   2. the hero's big CLAIM pays too, and moves the ladder up one tier;
//   3. the phone gets the same screen (2 × 4 grid) with no horizontal overflow.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { isPhoneMenu, navControl } from './support/menu.js';

const SECRET = 'a1'.repeat(24);

async function boot(page, { count, claimed = {}, gems = 100 }) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-ach', username: 'Claimer', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, count, claimed, gems }) => {
    if (sessionStorage.getItem('ach.seeded')) return;
    sessionStorage.setItem('ach.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Claimer' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.count', JSON.stringify(count));
    localStorage.setItem('taw.s2.ach', JSON.stringify(claimed));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems }));
  }, { secret: SECRET, id: row.id, count, claimed, gems });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'stats').waitFor({ state: 'visible' });
  await page.locator(isPhoneMenu(page) ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach').click();
  const ach = page.locator('.av3-overlay');
  await ach.waitFor({ state: 'visible' });
  return ach;
}
const s2 = (page) => page.evaluate(() => ({
  gems: (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0,
  ach: JSON.parse(localStorage.getItem('taw.s2.ach') || '{}'),
}));

test('a tile CLAIM pays the tier gems ONCE — stamped CLAIMED, the gems fly into the counter', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  // TYPE WORDS I (100) and ROLL EPIC+ I (3) are ready; the rest are in progress
  const ach = await boot(page, { count: { words: 150, bots: 6, epic: 3, mp: 1, chain: 2, reb: 1, power: 1, marks: ['a'] } });
  await expect(ach.locator('.av3-cell')).toHaveCount(8);
  await expect(ach.locator('.av3-tiers')).toContainText('0/38');
  await expect(ach.locator('.av3-ready-n')).toHaveText('2');
  const type = ach.locator('[data-ach="type"]');
  await expect(type.locator('.av3-strip')).toContainText('READY!');
  await expect(type.locator('.av3-strip')).toContainText('40');
  // a double click in one task: one claim, one payment
  await type.locator('.av3-claim').evaluate((b) => { b.click(); b.click(); });
  await expect(type.locator('.kst[aria-label="CLAIMED"]')).toHaveCount(1);
  await expect(type.locator('.av3-strip')).toContainText('CLAIMED');
  let st = await s2(page);
  expect(st.gems, 'TYPE WORDS I pays 40 gems — once').toBe(140);
  expect(st.ach).toEqual({ type: 1 });
  // the pill lands on the new balance once the gems have flown in
  await expect(ach.locator('.av3-gems .kp-num')).toHaveText('140', { timeout: 5000 });
  // after the stamp the tile shows tier II (1,000) — not claimable
  await expect(type.locator('.av3-strip')).toContainText('TIER II');
  await expect(type.locator('.av3-claim')).toHaveCount(0);
  await expect(ach.locator('.av3-tiers')).toContainText('1/38');
  st = await s2(page);
  expect(st.gems).toBe(140);
});

test('the HERO panel: READY + the big CLAIM pays and moves the ladder; then ALMOST with the % bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  const ach = await boot(page, { count: { epic: 3, words: 60 } });
  const hero = ach.locator('.av3-hero');
  await expect(hero).toHaveAttribute('data-hero', 'roll');
  await expect(hero.locator('.av3-hero-label')).toHaveText('READY');
  await expect(hero.locator('.av3-step')).toHaveCount(5);
  await hero.locator('.av3-claim--big .kb').click();
  await expect.poll(async () => (await s2(page)).gems).toBe(140);
  expect((await s2(page)).ach).toEqual({ roll: 1 });
  await expect(hero.locator('.av3-hero-label')).toHaveText('NICE');
  // after the stamp: nothing ready → the closest one (TYPE WORDS 60 / 100) is the hero, ALMOST, with its bar
  await expect(hero.locator('.av3-hero-label')).toHaveText('ALMOST', { timeout: 5000 });
  await expect(hero).toHaveAttribute('data-hero', 'type');
  await expect(hero.locator('.av3-hero-pct')).toContainText('60%');
  await expect(ach.locator('.av3-ready-n')).toHaveText('0');
});

test('phone 390×844: the same screen, a claim pays, no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ach = await boot(page, { count: { words: 150 } });
  const overflow = await page.evaluate(() => document.querySelector('.av3-overlay').scrollWidth - document.querySelector('.av3-overlay').clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ach.locator('[data-ach="type"] .av3-claim').click();
  await expect.poll(async () => (await s2(page)).gems).toBe(140);
  await ach.locator('.av3-back').click();
  await expect(ach).toHaveCount(0);
});

// Andy oct9 "make achievements have the notification symbol too": the menu trophy wears the same plain notification dot
// as the other nav buttons while a tier is ready to claim — and it clears once nothing is claimable.
for (const vp of [{ width: 1366, height: 657 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: the menu trophy dots while a tier is claimable, and clears once it is claimed`, async ({ page }) => {
    await page.setViewportSize(vp);
    const ach = await boot(page, { count: { words: 150, epic: 1 } }); // only TYPE WORDS I is ready
    const trophy = page.locator(isPhoneMenu(page) ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach');
    await ach.locator('.av3-back').click();
    await expect(ach).toHaveCount(0);
    await expect(trophy.locator('.kb-idot')).toHaveCount(1);
    await expect(trophy.locator('.kb-idot')).toHaveText(''); // a plain dot — no count (no numbers on the menu)
    await expect(trophy).toHaveAttribute('aria-label', 'Open achievements — a reward is ready to claim');
    await trophy.click();
    await ach.locator('[data-ach="type"] .av3-claim').click();
    await expect.poll(async () => (await s2(page)).ach).toEqual({ type: 1 });
    await ach.locator('.av3-back').click();
    await expect(ach).toHaveCount(0);
    await expect(trophy.locator('.kb-idot')).toHaveCount(0);
    await expect(trophy).toHaveAttribute('aria-label', 'Open achievements');
  });
}
