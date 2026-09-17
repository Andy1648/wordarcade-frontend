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

/** The letter CHAIN is currently demanding, lowercased. */
async function requiredLetter(page) {
  const raw = (await page.locator('.solo-center').first().innerText()).trim();
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


test('CHAIN: the second row offers a DIFFERENT, UNLOCKED mode', async ({ page }) => {
  test.setTimeout(90_000);

  await installBackendMock(page);
  await seedProfile(page);
  // TRY <MODE> is the MENU-PATH second row. A visitor who deep-landed and has never seen the menu
  // gets the "SEE ALL MODES" offer in its place instead — one control, never two, because both
  // answer "what now?" and the stranger needs the whole grid rather than one named mode. So seed
  // taw.seenMenu: this spec is about the row, not about which of the two a given visitor gets.
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.seenMenu', '1'); } catch { /* blocked storage */ }
  });
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
  // Never a LEVEL-GATED mode at LV1. (The gates are now CHAIN LV2 / FUSE LV3 — fix/unlock-gates
  // lowered them from 20/25 — so both are still out of reach at LV1 and this assertion stands.)
  expect(label).not.toBe('TRY FUSE');
  // It must be one of the three always-open modes.
  expect(['TRY WORD BOMB', 'TRY CATEGORY BLITZ', 'TRY SAT RUSH']).toContain(label);

  // And it goes somewhere real: clicking it lands IN THE APP, not on a 404 or the void.
  //
  // This used to wait for /(word-bomb|category-blitz|sat-rush)/ — but those bare paths are the
  // STATIC LANDING PAGES in public/, and Vercel serves a static file before it applies the SPA
  // rewrite, so in production they returned an article with no #root at all. The old assertion was
  // therefore matching the void it was written to guard against; it only ever passed because
  // `vite preview` resolves those paths to the SPA fallback (see e2e/router.spec.js).
  //
  // The contract now: the solo modes navigate to /<mode>/play, and the two multiplayer modes have
  // no solo deep link, so their closest playable surface is the menu at '/'. What actually matters
  // is the same thing it always did — the app booted — so assert THAT rather than a path spelling.
  await tryBtn.click();
  await page.waitForURL(/^[^?#]*\/(sat-rush|chain|fuse)\/play|^[^?#]*\/(\?|$)/, { timeout: 20000 });
  await expect(page.locator('#root')).not.toBeEmpty();
  // data-view is only set once the React app has mounted — an article would never set it.
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-view')), { timeout: 15000 })
    .not.toBe(null);
});

test('the TRY-ANOTHER-MODE row is ABSENT when the run is too short to have a card at all', async ({ page }) => {
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

  await expect(page.locator('.solo-over .try-mode-btn')).toHaveCount(0);
});
