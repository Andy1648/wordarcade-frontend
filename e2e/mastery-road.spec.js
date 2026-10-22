// e2e/mastery-road.spec.js — MODE MASTERY ROADS live ONLY in the ACHIEVEMENTS screen's MASTERY tab (Andy oct21: "in the
// achievements page at most … I don't want that on the main screen"). The screen opens on MASTERY when only a road
// reward waits, the five modes switch roads, a reached node CLAIMs once (gems into the pill), the mode dialog has no road
// in it, and the laptop stages (1366x768 / 1366x650) never scroll. Shots land in claude/mastery-road/shots.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { isPhoneMenu, navControl, revealMode } from './support/menu.js';

const SHOTS = 'claude/mastery-road/shots';
const SECRET = 'b2'.repeat(24);
// cumulative words to REACH a mastery level (mastery.js masteryWordsToReach — round(30 + 1.2 × l²) a level)
const toReach = (lv) => { let s = 0; for (let l = 1; l < lv; l++) s += Math.round(30 + 1.2 * l * l); return s; };

async function boot(page, { mastery, road = {} }) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-road', username: 'Roadie', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, mastery, road }) => {
    if (sessionStorage.getItem('road.seeded')) return;
    sessionStorage.setItem('road.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Roadie' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.count', JSON.stringify({ words: 40, bots: 1 })); // no achievement tier ready
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 100 }));
    localStorage.setItem('taw.mastery', JSON.stringify(mastery));
    localStorage.setItem('taw.s2.road', JSON.stringify(road));
  }, { secret: SECRET, id: row.id, mastery, road });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'stats').waitFor({ state: 'visible' });
}
const openAch = async (page) => {
  await page.locator(isPhoneMenu(page) ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach').click();
  const ach = page.locator('.av3-overlay');
  await ach.waitFor({ state: 'visible' });
  return ach;
};
const gems = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0);
// CHAIN at M9 (nodes M4 / M7 / M8 reached, M4 claimed → 2 READY — the most, so it opens), WORD BOMB M3 (1 ready), BLITZ M3, SAT M2
const SEED = { mastery: { chain: toReach(9) + 40, 'word-bomb': toReach(3) + 12, 'category-blitz': toReach(3) + 5, 'sat-rush': toReach(2) + 3 }, road: { chain: [0], 'sat-rush': [0] } };

for (const vp of [{ width: 1366, height: 768, tag: 'laptop' }, { width: 1366, height: 650, tag: 'chromebook' }, { width: 390, height: 844, tag: 'phone' }]) {
  test(`MASTERY tab: opens on the waiting road, claims once, switches modes (${vp.tag})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await boot(page, SEED);
    const ach = await openAch(page);
    const panel = ach.getByTestId('mastery-panel');
    await expect(panel).toBeVisible(); // only road rewards wait → it opens on MASTERY
    await expect(ach.locator('.mp-mode.is-on')).toHaveAttribute('data-mode', 'chain');
    await expect(ach.getByTestId('road-node-0')).toHaveAttribute('data-state', 'claimed');
    await expect(ach.getByTestId('road-node-1')).toHaveAttribute('data-state', 'ready');
    await expect(ach.getByTestId('road-node-3')).toHaveAttribute('data-state', 'locked');
    await expect(ach.locator('.mp-node')).toHaveCount(12);
    if (vp.width >= 1000) {
      // the whole road on screen at once: no scroll, the 12th node inside the viewport
      expect(await page.evaluate(() => { const o = document.querySelector('.av3-overlay'); return o.scrollHeight <= o.clientHeight + 1; })).toBe(true);
      const last = await ach.getByTestId('road-node-11').boundingBox();
      expect(last.y + last.height).toBeLessThanOrEqual(vp.height);
      expect(last.x + last.width).toBeLessThanOrEqual(vp.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-1-mastery.png` });

    const before = await gems(page);
    await ach.getByTestId('road-claim-1').click(); // CHAIN's 10-gem chest
    await expect(ach.getByTestId('road-node-1')).toHaveAttribute('data-state', 'claimed');
    await expect(ach.getByTestId('road-claim-1')).toHaveCount(0);
    await expect.poll(() => gems(page)).toBe(before + 10);
    await ach.getByTestId('road-claim-2').click(); // the ROLL TICKET: a flat 75
    await expect.poll(() => gems(page)).toBe(before + 85);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-2-claimed.png` });

    await ach.locator('.mp-mode[data-mode="word-bomb"]').click();
    await expect(ach.locator('.mp-mode.is-on')).toHaveAttribute('data-mode', 'word-bomb');
    await expect(ach.getByTestId('road-node-0')).toHaveAttribute('data-state', 'ready'); // WORD BOMB's bronze badge (M2)
    await ach.getByRole('tab', { name: 'ACHIEVEMENTS' }).click();
    await expect(ach.locator('.av3-cell').first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-3-achievements-tab.png` });
  });
}

test('the road is nowhere on the menu: the mode dialog has no mastery strip', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, SEED);
  await (await revealMode(page, 'word-bomb')).click();
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await expect(page.locator('.mode-dialog-shell')).not.toContainText('MASTERY');
  await expect(page.getByTestId('mastery-panel')).toHaveCount(0);
});
