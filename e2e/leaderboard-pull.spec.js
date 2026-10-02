// e2e/leaderboard-pull.spec.js — STEP 47 gate (A13): the board pulls players in.
//
// One continuous story on an UNCLAIMED profile (no name, LV1, no rebirths):
//   1. play a real CHAIN round → the death card offers "YOU'D BE #4 ON THE BOARD";
//   2. claim a name inline, without leaving the end screen;
//   3. the board lists that name as YOU;
//   4. the player levels past someone → the next menu visit shows "#4 → #3" and badges the trophy;
//   5. opening the board clears the badge.
// Plus: a short board pads to 10 rows with numbered "YOUR NAME HERE?" invitations, never fake players;
// the prompt never shows twice in a session; a claimed player never sees it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const SEED = [
  { id: 'seed-1', username: 'WordWizard', level: 152, rebirths: 6, lifetime_words: 48210, wins_per_word: 912.4 },
  { id: 'seed-2', username: 'BombSquad', level: 88, rebirths: 2, lifetime_words: 20111, wins_per_word: 301.0 },
  { id: 'seed-3', username: 'LexiLoop', level: 40, rebirths: 0, lifetime_words: 5300, wins_per_word: 44.5 },
];

const OPENER_WORD = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future',
  g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice',
  o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where',
};
const E_WORDS = ['estate', 'elite', 'escape', 'expense'];

async function playChainLinks(page, n) {
  const pool = [...E_WORDS];
  for (let i = 0; i < n; i += 1) {
    const letter = ((await page.locator('.solo-center').first().innerText()).trim()).toLowerCase().slice(0, 1);
    const word = i === 0 ? OPENER_WORD[letter] : pool.shift();
    const input = page.locator('.solo-input');
    await input.fill(word);
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
}

async function seedUnclaimed(page) {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('seeded')) return; // seed ONCE: later navigations keep what the run earned
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('taw.chain.runs', '5'); // past CHAIN's tutorial card
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('wa_has_played', '1');
    } catch { /* storage blocked */ }
  });
}

test('unclaimed player: end-screen claim → on the board → rank-up moment + trophy badge', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  await seedUnclaimed(page);
  const board = await mockBoard(page, SEED);

  // 1. A real CHAIN round.
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  await playChainLinks(page, 4);
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });

  const prompt = page.locator('.lb-cp');
  await expect(prompt).toBeVisible({ timeout: 10000 });
  await expect(prompt).toContainText('YOU’D BE #4 ON THE BOARD');
  // "Seen" is ON SCREEN, not rendered: the session's one shot is spent only once it scrolls into view.
  await prompt.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('taw.lb.promptShown'))).toBe('1');

  // 2. Claim inline.
  await prompt.getByRole('button', { name: 'CLAIM YOUR NAME' }).click();
  const input = page.locator('#lb-cp-input');
  await expect(input).toBeFocused();
  await input.fill('Typer_47');
  await expect(page.locator('.lb-cp-verdict')).toHaveText('FREE. CLAIM IT.');
  await prompt.getByRole('button', { name: 'CLAIM' }).click();
  await expect(page.locator('.lb-cp-done')).toContainText('YOU’RE #4.');
  expect(board.calls.claim).toBe(1);
  expect(board.rows.some((r) => r.username === 'Typer_47')).toBe(true);

  // 3. The board lists me.
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.getByRole('button', { name: /Open leaderboard/ }).click();
  const me = page.locator('.lb-row.is-me');
  await expect(me.locator('.lb-name')).toHaveText('Typer_47');
  await expect(me.locator('.lb-you-badge')).toHaveText('YOU');
  await expect(me).toHaveAttribute('data-rank', '4');
  // 4 real rows → 6 numbered invitations (#5..#10), and none of them pretends to be a player.
  await expect(page.locator('.lb-slot')).toHaveCount(6);
  await expect(page.locator('.lb-slot').first()).toHaveAttribute('data-rank', '5');
  await expect(page.locator('.lb-slot').first()).toContainText('YOUR NAME HERE?');
  await expect(page.locator('.lb-row')).toHaveCount(4);
  await page.locator('.lb-close').click();

  // 4. I level past LexiLoop's LV40 (the board ranks by rebirths, then LEVEL — Andy oct2) — the next
  //    menu visit pushes it and shows the rank-up.
  await page.evaluate(() => localStorage.setItem('taw.xp', JSON.stringify({ lv: 41, into: 0 })));
  await page.goto('/?portal=1');
  await menuReady(page);
  const moment = page.locator('.lb-rankup');
  await expect(moment).toBeVisible({ timeout: 10000 });
  await expect(moment.locator('.lb-rankup-from')).toHaveText('#4');
  await expect(moment.locator('.lb-rankup-to')).toHaveText('#3');
  await expect(moment.locator('.lb-rankup-sub')).toContainText('LV 41');
  const trophy = page.getByRole('button', { name: /Open leaderboard/ });
  await expect(trophy).toHaveAttribute('aria-label', /rank went up/);
  await expect(moment).toBeHidden({ timeout: 5000 }); // finite: gone after its 2.2s
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length);
  expect(infinite, 'the moment adds no infinite animation').toBe(0);

  // 5. Opening the board reads the news.
  await trophy.click();
  await expect(page.locator('.lb-row.is-me')).toHaveAttribute('data-rank', '3');
  await page.locator('.lb-close').click();
  await expect(page.getByRole('button', { name: /Open leaderboard/ })).toHaveAttribute('aria-label', 'Open leaderboard');
});

test('the claim prompt is once per session and never for a claimed player', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackendMock(page);
  await seedUnclaimed(page);
  await mockBoard(page, SEED);
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  await playChainLinks(page, 4);
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });
  const prompt = page.locator('.lb-cp');
  await expect(prompt).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000); // entrance (600ms delay + 280ms) finished — measure the resting box
  // 44px targets, nothing under 13px, no horizontal scroll at 390.
  const m = await page.evaluate(() => {
    const p = document.querySelector('.lb-cp');
    const small = [p, ...p.querySelectorAll('*')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .map((el) => parseFloat(getComputedStyle(el).fontSize))
      .filter((fs) => fs < 13);
    const btns = [...p.querySelectorAll('button')].map((b) => b.getBoundingClientRect()).map((r) => Math.min(r.width, r.height));
    return { small, minBtn: Math.min(...btns), hScroll: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  expect(m.small).toEqual([]);
  expect(m.minBtn).toBeGreaterThanOrEqual(44);
  expect(m.hScroll).toBe(false);
  await prompt.getByRole('button', { name: 'Dismiss' }).click();
  await expect(prompt).toBeHidden();

  // Same session, another run: no second prompt.
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  await playChainLinks(page, 4);
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.lb-cp')).toHaveCount(0);
});

test('a network over its claim limit gets plain copy, not an error dump', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  await seedUnclaimed(page);
  await mockBoard(page, SEED);
  await page.route('https://lb.e2e.invalid/rest/v1/rpc/lb_claim', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'rate_limited' }) }));
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  await playChainLinks(page, 4);
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });
  const prompt = page.locator('.lb-cp');
  await expect(prompt).toBeVisible({ timeout: 10000 });
  await prompt.getByRole('button', { name: 'CLAIM YOUR NAME' }).click();
  await page.locator('#lb-cp-input').fill('Typer_48');
  await expect(page.locator('.lb-cp-verdict')).toHaveText('FREE. CLAIM IT.');
  await prompt.getByRole('button', { name: 'CLAIM' }).click();
  await expect(page.locator('.lb-cp-verdict')).toHaveText('THE BOARD IS BUSY FROM THIS NETWORK. TRY IN AN HOUR.');
});
