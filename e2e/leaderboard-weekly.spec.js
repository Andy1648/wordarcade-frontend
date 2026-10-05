// e2e/leaderboard-weekly.spec.js — BB3 (Andy oct2): a weekly leaderboard that resets Monday 00:00 ET,
// server-side (013_weekly_board.sql, mocked). ALL-TIME stays the default; THIS WEEK lists only players
// who typed this ET week, by words typed this week; a claimed player's FIRST submit is a baseline
// (a lifetime of words never lands in one week); the reset countdown names Monday 00:00 ET.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const SECRET = 'a'.repeat(48);
const seedRows = () => [
  { id: 'w1', username: 'WeekWarrior', level: 12, rebirths: 0, lifetime_words: 900, wins_per_word: 3, week_words: 300 },
  { id: 'w2', username: 'SlowBurn', level: 80, rebirths: 1, lifetime_words: 9000, wins_per_word: 9, week_words: 120 },
  { id: 'w3', username: 'Lapsed', level: 99, rebirths: 2, lifetime_words: 20000, wins_per_word: 20, week_words: 0 },
  { id: 'me-1', username: 'Typer_47', level: 5, rebirths: 0, lifetime_words: 0, wins_per_word: 0 },
];

async function boot(page, { weekly, shared }) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  await mockBoard(page, [], { caps: true, weekly, shared });
  await page.addInitScript((secret) => {
    if (sessionStorage.getItem('wk.seeded')) return;
    sessionStorage.setItem('wk.seeded', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me-1', username: 'Typer_47' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.mastery', JSON.stringify({ chain: 500 }));
  }, SECRET);
}

test('without 013 there is no weekly switch (the all-time board is unchanged)', async ({ page }) => {
  const shared = { rows: seedRows(), secrets: new Map([[SECRET, 'me-1']]), saves: new Map() };
  await boot(page, { weekly: false, shared });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.homepage-nav-btn.is-board').click();
  await expect(page.locator('.lb-row').first()).toBeVisible();
  await expect(page.locator('.lb-tab')).toHaveCount(0);
});

test('THIS WEEK: only this week’s typers, most words first; my first submit is a baseline, then my words count', async ({ page }) => {
  const shared = { rows: seedRows(), secrets: new Map([[SECRET, 'me-1']]), saves: new Map() };
  await boot(page, { weekly: true, shared });
  await page.goto('/?portal=1');
  await menuReady(page);
  await expect.poll(() => shared.rows.find((r) => r.id === 'me-1').submitted).toBe(true); // the menu's push = baseline

  await page.locator('.homepage-nav-btn.is-board').click();
  await expect(page.locator('.lb-tab.is-on')).toHaveText('ALL-TIME'); // the default
  await page.getByRole('tab', { name: 'THIS WEEK' }).click();
  const rows = page.locator('.lb-list:not(.lb-list--me) .lb-row--week');
  await expect(rows).toHaveCount(2); // Lapsed typed nothing this week; my 500 lifetime words are the baseline
  await expect(rows.nth(0).locator('.lb-name')).toHaveText('WeekWarrior');
  await expect(rows.nth(0).locator('.lb-week-words')).toHaveText('300');
  await expect(rows.nth(1).locator('.lb-name')).toHaveText('SlowBurn');
  await expect(page.locator('.lb-week-reset')).toHaveText(/^RESETS MONDAY 00:00 ET · IN (\d+D \d+H|\d+H \d+M|\d+M)$/);

  // I type 140 words this week → the next push counts them → #2 this week
  await page.evaluate(() => localStorage.setItem('taw.mastery', JSON.stringify({ chain: 640 })));
  await page.goto('/?portal=1');
  await menuReady(page);
  await expect.poll(() => shared.rows.find((r) => r.id === 'me-1').week_words).toBe(140);
  await page.locator('.homepage-nav-btn.is-board').click();
  await page.getByRole('tab', { name: 'THIS WEEK' }).click();
  const me = page.locator('.lb-row--week.is-me');
  await expect(me).toHaveAttribute('data-rank', '2');
  await expect(me.locator('.lb-week-words')).toHaveText('140');
  // loop 3: the name card shows the rank of the board being viewed
  await expect(page.locator('.lb-you-rank')).toHaveText('#2'); // clutter pass: the THIS WEEK tab names the board
  await page.screenshot({ path: 'claude/batch-b/bb3-weekly-1280x720.png' });
});
