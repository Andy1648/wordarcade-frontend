// e2e/nearmiss.spec.js — EXTENSION b, the end-screen NEAR-MISS line (dormant behind ?nearmiss=1).
//
//   1. With the flag, a save sitting half-way into an early level (one CHAIN run clears several
//      levels there) shows ONE line on the CHAIN death card, and tapping it starts a new run — the
//      line IS the restart, no new action.
//   2. Without the flag, the same run shows nothing.
//
// The run's yield is seeded (taw.nm.avg = smoothed letters per run) so the "one more run gets it"
// test doesn't depend on how many links this particular run made. The claim prompt is marked seen
// for the session: it owns the slot while it is up (NearMiss.css), and this spec is about the line.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// CHAIN openers, each ending in 'e' so every later link is an e-word (see solo-endgame.spec.js).
const OPENER_WORD = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future',
  g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice',
  o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where',
};
const E_WORDS = ['estate', 'elite', 'escape', 'expense', 'example', 'everyone', 'evidence', 'exchange'];

async function seed(page) {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('nm.seeded')) return;
      sessionStorage.setItem('nm.seeded', '1');
      localStorage.setItem('taw.chain.runs', '5'); // not the first-run tutorial card
      localStorage.setItem('taw.seenMenu', '1'); // the menu-path second row (not the deep-link offer)
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 5, f: 0.5, rc: 0, v: 10 }));
      localStorage.setItem('taw.nm.avg', '250'); // ~50 words a run
      sessionStorage.setItem('taw.lb.promptShown', '1'); // the claim prompt already had its turn
    } catch { /* storage blocked — the assertions fail loudly */ }
  });
}

async function playLinks(page, n) {
  const input = page.locator('.solo-input');
  const pool = [...E_WORDS];
  for (let i = 0; i < n; i += 1) {
    const letter = ((await page.locator('.solo-center').first().innerText()).trim().toLowerCase())[0];
    const word = i === 0 ? OPENER_WORD[letter] : pool.shift();
    expect(word, `no word for required letter "${letter}"`).toBeTruthy();
    if (i === 0 && pool.includes(word)) pool.splice(pool.indexOf(word), 1);
    await input.fill(word);
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
}

async function dieInChain(page, url) {
  await installBackendMock(page);
  await seed(page);
  await page.goto(url);
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  await playLinks(page, 4); // past the 3-link tutorial card
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });
}

test('?nearmiss=1: the CHAIN death card shows one near-miss line, and tapping it starts a new run', async ({ page }) => {
  test.setTimeout(90_000);
  await dieInChain(page, '/?chain=1&portal=1&nearmiss=1');

  const line = page.locator('.solo-over .nm-line');
  await expect(line).toHaveCount(1);
  await expect(line).toBeVisible();
  await expect(line).toHaveText(/^(\d[\d,.]*[A-Z]* LETTERS? TO LV \d[\d,.]*[A-Z]*|KEY POWER T\d+ IN \d[\d,.]*[A-Z]* WORDS?|\d+ LV TO #\d+)$/);
  // a real tap target, never tiny text
  const box = await line.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const fs = await line.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs).toBeGreaterThanOrEqual(13);

  await line.click();
  await expect(page.locator('.solo-over')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('.solo-input')).toBeVisible();
});

test('without the flag the same death card shows no near-miss line', async ({ page }) => {
  test.setTimeout(90_000);
  await dieInChain(page, '/?chain=1&portal=1');
  await expect(page.locator('.solo-over .try-mode-btn')).toBeVisible(); // the slot itself rendered
  await expect(page.locator('.nm-line')).toHaveCount(0);
});
