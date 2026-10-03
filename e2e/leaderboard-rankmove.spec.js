// e2e/leaderboard-rankmove.spec.js — H2a: the board's rank-change ▲N through the REAL path.
//
// The menu's rank check (checkRankUp) moves lastRank to the new rank on mount, and tapping the trophy
// clears the news flag BEFORE the board loads. The board must still know where the climb started
// (taw.lb.rankFrom), so: menu → trophy → your row carries ▲N. Seeding lastRank AFTER the menu loaded
// would skip the menu's check and hide exactly that bug, so nothing here touches storage mid-run.
//
// Also pinned: the ▲N is consumed by the open (a second open does not replay it), the slide runs once
// per visit (switching ALL-TIME / THIS WEEK does not replay it), reduced motion gets the static chip,
// and the pin strip never sits over a row.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const ROWS = [
  ['snapplemelon', 195], ['Xavi', 168], ['elol', 156], ['NoBuffCookies', 147], ['Daan', 144],
  ['Tangie', 126], ['maSON_im_cRYAN', 119], ['creator', 118], ['wordgoblin', 40], ['qwertyuiop', 31],
].map(([username, level], i) => ({ id: `r${i}`, username, level, rebirths: 0, lifetime_words: 500 - i, wins_per_word: 10 }));

async function setup(page, { lastRank = 12 } = {}) {
  await installBackendMock(page);
  const shared = {
    rows: [...ROWS.map((r) => ({ ...r })), { id: 'me', username: 'Climber_1', level: 60, rebirths: 0, lifetime_words: 300, wins_per_word: 5 }],
    secrets: new Map([['s'.repeat(48), 'me']]),
    saves: new Map(),
  };
  await mockBoard(page, [], { caps: true, shared, weekly: true });
  await page.addInitScript((last) => {
    try {
      // once per test: a reload / second goto must not re-seed the "last seen" rank
      if (sessionStorage.getItem('rankmove.seeded')) return;
      sessionStorage.setItem('rankmove.seeded', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 }));
      localStorage.setItem('taw.lb.secret', 's'.repeat(48));
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'Climber_1' }));
      localStorage.setItem('taw.lb.lastRank', String(last));
    } catch { /* blocked */ }
  }, lastRank);
}

async function openBoardFromMenu(page) {
  await page.goto('/?portal=1');
  await menuReady(page);
  // the menu's own rank check runs first (it is what moves lastRank to #9 and shows the moment)
  await expect(page.locator('.lb-rankup')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.lb-rankup')).toBeHidden({ timeout: 6000 });
  await page.getByRole('button', { name: /Open leaderboard/ }).click();
  await expect(page.locator('.lb-row.is-me')).toHaveAttribute('data-rank', '9');
}

test('menu → trophy: your row wears ▲3, once — a second open does not replay it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await setup(page);
  await openBoardFromMenu(page);
  await expect(page.locator('.lb-row.is-me .lb-move')).toHaveText('▲3');
  await expect(page.locator('.lb-hero-move')).toContainText('▲3');
  await expect(page.locator('.lb-hero-target')).toContainText('58 LEVELS TO #8');

  // THIS WEEK and back: the chip is still there, but the slide does not run again
  await page.locator('.lb-tab', { hasText: 'THIS WEEK' }).click();
  await page.locator('.lb-tab', { hasText: 'ALL-TIME' }).click();
  await expect(page.locator('.lb-row.is-me .lb-move')).toHaveText('▲3');
  const running = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.lb-row.is-me')).length);
  expect(running, 'the slide is once per visit, not per tab switch').toBe(0);

  // close and reopen: the news was read, nothing replays
  await page.locator('.lb-close').click();
  await page.getByRole('button', { name: /Open leaderboard/ }).click();
  await expect(page.locator('.lb-row.is-me')).toHaveAttribute('data-rank', '9');
  await expect(page.locator('.lb-move')).toHaveCount(0);
  await expect(page.locator('.lb-hero-move')).toHaveCount(0);
});

test('reduced motion: the ▲N chip is static — no slide, no pop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 625 });
  await setup(page);
  await openBoardFromMenu(page);
  await expect(page.locator('.lb-row.is-me .lb-move')).toHaveText('▲3');
  const anims = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.lb-row.is-me, .lb-hero')).length);
  expect(anims).toBe(0);
});

test('phone: the hero is a one-line strip and the pin never covers a row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { lastRank: 9 }); // no move: this test is about layout
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.getByRole('button', { name: /Open leaderboard/ }).click();
  await expect(page.locator('.lb-row.is-me')).toHaveAttribute('data-rank', '9');
  await expect(page.locator('.lb-hero-target .lb-short')).toBeVisible();
  await expect(page.locator('.lb-hero-target .lb-short')).toHaveText('· 58 LV TO #8');
  // the strip is one line: rank and target share a baseline row
  const line = await page.locator('.lb-hero-line').boundingBox();
  const rank = await page.locator('.lb-you-rank').boundingBox();
  expect(line.height).toBeLessThanOrEqual(rank.height + 8);

  // scroll the board to the top: if your row is out of view, the pin stands in for it — below the
  // scroll box, overlapping no row
  await page.locator('.lb-body').evaluate((b) => { b.scrollTop = 0; });
  const pin = page.locator('.lb-pin-btn');
  if (await pin.count()) {
    const pb = await pin.boundingBox();
    const body = await page.locator('.lb-body').boundingBox();
    expect(pb.y).toBeGreaterThanOrEqual(body.y + body.height - 2); // sub-pixel rounding (CI: 688.56 vs 688.58)
    await pin.click();
    await expect(page.locator('.lb-row.is-me')).toBeInViewport();
    await expect(pin).toHaveCount(0);
  }
});
