// e2e/leaderboard-top10.spec.js — Andy oct2 LB10: the board shows the TOP 10 only. A claimed player
// below it gets ONE pinned row with their real rank (fetched from the server), never "unranked"; the
// end-screen "YOU'D BE #N" is the true rank past 10 (a server-side count), not capped at 10.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const seed = (n) => Array.from({ length: n }, (_, i) => ({
  id: `seed-${i + 1}`, username: `Player${i + 1}`, level: 60 - i, rebirths: 0, lifetime_words: 10000 - i * 100, wins_per_word: 10,
}));

test('the board shows 10 rows; a claimed player at #12 gets a pinned row with that rank', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  const rows = [...seed(15)];
  rows.splice(11, 0, { id: 'me-1', username: 'Typer_47', level: 49, rebirths: 0, lifetime_words: 8950, wins_per_word: 5 });
  await mockBoard(page, rows);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me-1', username: 'Typer_47' }));
    localStorage.setItem('taw.lb.secret', 'a'.repeat(48));
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.homepage-nav-btn.is-board').click();
  await expect(page.locator('.lb-list:not(.lb-list--me) .lb-row')).toHaveCount(10);
  const me = page.locator('.lb-list--me .lb-row.is-me');
  await expect(me).toHaveAttribute('data-rank', '12');
  await expect(me.locator('.lb-rank')).toHaveText('12');
  await expect(me.locator('.lb-you-badge')).toHaveText('YOU');
  await expect(page.locator('body')).not.toContainText(/unranked/i);
});

const OPENER_WORD = { a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future', g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice', o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where' };
const E_WORDS = ['estate', 'elite', 'escape', 'expense'];

test("an unclaimed player who would rank #13 is told #13 — the end-screen rank is true past 10", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  await mockBoard(page, seed(12));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries({ 'taw.chain.runs': '5', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1', 'taw.seenMenu': '1', wa_has_played: '1' })) localStorage.setItem(k, v);
  });
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  const pool = [...E_WORDS];
  for (let i = 0; i < 4; i += 1) {
    const letter = ((await page.locator('.solo-center').first().innerText()).trim()).toLowerCase().slice(0, 1);
    const input = page.locator('.solo-input');
    await input.fill(i === 0 ? OPENER_WORD[letter] : pool.shift());
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });
  await expect(page.locator('.lb-cp .lb-cp-rank')).toHaveText('#13', { timeout: 10000 }); // clutter pass: the kicker no longer repeats it
});
