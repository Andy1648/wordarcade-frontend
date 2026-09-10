// e2e/solo-endgame.spec.js — the CHAIN/FUSE end screen is no longer a dead end (feat/solo-endgame).
//
// Two things are proven here against a REAL run, not a stub:
//   1. Finishing a CHAIN run with 4 links produces a share receipt in the chain-fuse spec shape,
//      and its last line deep-links into /chain (the route has to actually resolve).
//   2. The second row names a DIFFERENT, UNLOCKED mode — never the mode just played, never one the
//      player cannot reach.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// One word per CHAIN opener (chain.js CHAIN_OPENERS = 'abcdefghilmnoprstw'), every one of them
// ENDING IN 'E' so the next required letter is always 'e' — a letter with a deep supply, so the
// engine's dead-end reroute never fires and the run stays deterministic.
const OPENER_WORD = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future',
  g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice',
  o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where',
};
// Distinct e-words for every link after the first (CHAIN rejects a repeat).
const E_WORDS = ['estate', 'elite', 'escape', 'expense', 'example', 'everyone', 'evidence', 'exchange'];

/**
 * A profile that is NOT on its first run: CHAIN's run-1 death card is a how-to-play card with no
 * score line and no share button (SoloShell's `over.bare`), which is correct behaviour and not what
 * these tests are about. The spotlight flags are pre-marked so the one-time overlay never sits
 * between the test and the input.
 */
async function seedProfile(page, extra = {}) {
  await page.addInitScript((seed) => {
    try {
      localStorage.setItem('taw.chain.runs', '5');
      localStorage.setItem('taw.fuse.runs', '5');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, v);
    } catch { /* storage blocked — the test will fail loudly on its own assertions */ }
  }, extra);
}

/** The letter CHAIN is currently demanding, lowercased.
 *  feat/solo-slabs moved the required letter out of the generic `.solo-center` box and
 *  into the IN slab's face (`.solo-in-face`) — SoloShell renders `slabs` INSTEAD of
 *  `.solo-center` when a mode supplies them. Prefer the slab face and fall back to
 *  `.solo-center` so this helper works for slab and non-slab modes alike. */
async function requiredLetter(page) {
  const slab = page.locator('.solo-in-face').first();
  const target = (await slab.count()) ? slab : page.locator('.solo-center').first();
  const raw = (await target.innerText()).trim();
  return raw.toLowerCase().slice(0, 1);
}

/** Type one word and submit it; resolves once CHAIN has moved on to the next required letter. */
async function playWord(page, word) {
  const input = page.locator('.solo-input');
  await input.fill(word);
  await input.press('Enter');
  // The accepted word clears the field — the engine's own signal that it took the submission.
  await expect(input).toHaveValue('', { timeout: 5000 });
}

/** Play `n` accepted links, then return the words used. */
async function playLinks(page, n) {
  const used = [];
  const pool = [...E_WORDS];
  for (let i = 0; i < n; i += 1) {
    const letter = await requiredLetter(page);
    let word;
    if (i === 0) {
      word = OPENER_WORD[letter];
      // If the opener itself is 'e', don't also spend an e-word on it.
      if (word) pool.splice(pool.indexOf(word), 1);
    } else {
      expect(letter, `link ${i + 1} should be chained onto an "e"`).toBe('e');
      word = pool.shift();
    }
    expect(word, `no word mapped for required letter "${letter}"`).toBeTruthy();
    await playWord(page, word);
    used.push(word);
  }
  return used;
}

test('CHAIN: a 4-link run yields the spec-shaped share receipt, deep-linked to /chain', async ({ page, context, baseURL }) => {
  test.setTimeout(90_000); // the run has to die on a real ~10s clock, not a stub

  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await installBackendMock(page);
  await seedProfile(page);
  await page.goto('/?chain=1&portal=1');

  await page.locator('.solo-root').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });

  const used = await playLinks(page, 4);
  expect(used).toHaveLength(4);

  // Stop typing and let the clock run out — the only way a CHAIN run ends.
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });

  // The receipt exists (4 links clears the 3-word suppression gate).
  const copyBtn = page.locator('.solo-over .copy-result-btn');
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  await expect(copyBtn).toHaveText('COPIED!');

  // The Windows clipboard normalises LF to CRLF on the way out, so split on either — the \r is a
  // platform artifact of the round-trip, not something buildResultCard emits.
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const lines = text.split(/\r?\n/);

  // Line 1: brand + mode, EM DASH.
  expect(lines[0]).toBe('TYPE A WORD — CHAIN');
  // Line 2: "<n> LINKS · <n> PTS" — CHAIN counts LINKS, uppercase units, '·' separator, no LV.
  expect(lines[1]).toMatch(/^4 LINKS · [\d,]+ PTS$/);
  expect(lines[1]).not.toMatch(/LV/);
  // Line 3: one glyph per link + the ⬛ that ended it. 4 links + 1 killer = 5, under the 30 cap.
  expect(lines[2]).toMatch(/^[🟩🟨🟥]{4}⬛$/u);
  // Line 4: a deep link INTO the mode.
  expect(lines[3]).toContain('/chain');
  expect(lines).toHaveLength(4);

  // THE DEEP LINK MUST RESOLVE — a receipt whose last line 404s is worse than no receipt.
  await page.goto(lines[3]);
  await expect(page.locator('.solo-root')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.solo-input')).toBeVisible({ timeout: 20000 });
});

test('CHAIN: the second row offers a DIFFERENT, UNLOCKED mode', async ({ page }) => {
  test.setTimeout(90_000);

  await installBackendMock(page);
  await seedProfile(page);
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });

  await playLinks(page, 4);
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });

  const tryBtn = page.locator('.solo-over .try-mode-btn');
  await expect(tryBtn).toBeVisible();
  const label = (await tryBtn.innerText()).trim();

  expect(label).toMatch(/^TRY /);
  // Never the mode just played.
  expect(label).not.toBe('TRY CHAIN');
  // Never a LEVEL-GATED mode at LV1 — CHAIN (LV20) and FUSE (LV25) are both out of reach here.
  expect(label).not.toBe('TRY FUSE');
  // It must be one of the three always-open modes.
  expect(['TRY WORD BOMB', 'TRY CATEGORY BLITZ', 'TRY SAT RUSH']).toContain(label);

  // And it goes somewhere real: clicking it lands on that mode's route, not a 404 or the void.
  await tryBtn.click();
  await page.waitForURL(/\/(word-bomb|category-blitz|sat-rush)/, { timeout: 20000 });
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('the second row is ABSENT when the run is too short to have a card at all', async ({ page }) => {
  // The suppression companion: a sub-3-link run gets CHAIN's tutorial death card (`over.bare`),
  // which deliberately carries neither the share receipt nor the TRY row — the first-run card is
  // already a guided next step, so a second one would be noise.
  //
  // NOTE ON "EVERYTHING ELSE LOCKED": that state cannot be produced in the shipped app — Word Bomb,
  // Category Blitz and SAT Rush carry no unlockLevel, so at least one suggestion always exists.
  // The row-is-absent path is therefore covered where it IS reachable: src/progress/nextMode.test.js
  // ('returns null when there is nothing honest to offer') drives the chooser with only gated modes.
  test.setTimeout(90_000);

  await installBackendMock(page);
  await seedProfile(page);
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });

  await playLinks(page, 2); // under the 3-word gate
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });

  await expect(page.locator('.solo-over .copy-result-btn')).toHaveCount(0);
  await expect(page.locator('.solo-over .try-mode-btn')).toHaveCount(0);
});
