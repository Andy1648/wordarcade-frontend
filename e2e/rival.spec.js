// e2e/rival.spec.js — extensions-spec a (RIVAL PINGS), dormant behind flagOn('rival').
//
// Last visit I was #4 (LV 146, no rebirths). Since then Xavi (LV 147) moved above me, so this visit's
// rank check reads #5. With ?rival=1 the menu shows the rank-up card's PASSED variant — the name and the
// gap — and tapping it opens the board. Without the flag, the drop shows nothing (today's behaviour).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const ROWS = [
  ['snapplemelon', 195], ['elol', 160], ['NoBuffCookies', 150], ['Xavi', 147], ['Daan', 120],
].map(([username, level], i) => ({ id: `r${i}`, username, level, rebirths: 0, lifetime_words: 500 - i, wins_per_word: 10 }));

async function setup(page) {
  await installBackendMock(page);
  const shared = {
    rows: [...ROWS.map((r) => ({ ...r })), { id: 'me', username: 'Climber_1', level: 146, rebirths: 0, lifetime_words: 300, wins_per_word: 5 }],
    secrets: new Map([['s'.repeat(48), 'me']]),
    saves: new Map(),
  };
  await mockBoard(page, [], { caps: true, shared });
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('rival.seeded')) return;
      sessionStorage.setItem('rival.seeded', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 146, f: 0, rc: 0, v: 10 }));
      localStorage.setItem('taw.econ', '12'); // already on Rebirth Rush: econ 12 (this spec is not about the one-time conversion)
      localStorage.setItem('taw.lb.secret', 's'.repeat(48));
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'Climber_1' }));
      // the last visit: #4, at the same level and rebirth count (so this drop is NOT my own rebirth)
      localStorage.setItem('taw.lb.lastRank', '4');
      localStorage.setItem('taw.lb.lastRb', '0');
      localStorage.setItem('taw.lb.lastLv', '146');
    } catch { /* blocked */ }
  });
}

test('?rival=1: someone passed you → the card names them and the gap; tap opens the board', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await setup(page);
  await page.goto('/?portal=1&rival=1');
  await menuReady(page);
  const card = page.locator('.lb-rankup.is-passed');
  await expect(card).toBeVisible({ timeout: 20000 }); // INFO priority: it waits behind the menu's arrival moments (~13 s on a LV146 save)
  await expect(card.locator('.lb-rankup-kicker')).toHaveText('XAVI PASSED YOU');
  await expect(card.locator('.lb-rankup-from')).toHaveText('#4');
  await expect(card.locator('.lb-rankup-to')).toHaveText('#5');
  await expect(card.locator('.lb-rankup-sub')).toHaveText('1 LV BEHIND');
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length);
  expect(infinite, 'the ping adds no infinite animation').toBe(0);

  await card.click();
  await expect(page.locator('.lb-row.is-me')).toHaveAttribute('data-rank', '5');
});

test('?rival=1: one ping per visit — a reload with no new pass shows nothing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/?portal=1&rival=1');
  await menuReady(page);
  await expect(page.locator('.lb-rankup.is-passed')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.lb-rankup.is-passed')).toBeHidden({ timeout: 6000 });
  await page.reload();
  await menuReady(page);
  await page.waitForTimeout(3000);
  await expect(page.locator('.lb-rankup')).toHaveCount(0);
});

test('no flag: the same drop shows nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await setup(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  // the rank check has run once lastRank moves to the live #5
  await expect.poll(() => page.evaluate(() => localStorage.getItem('taw.lb.lastRank')), { timeout: 10000 }).toBe('5');
  await page.waitForTimeout(1500);
  await expect(page.locator('.lb-rankup')).toHaveCount(0);
});
