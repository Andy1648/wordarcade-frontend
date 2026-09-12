// e2e/rarity-moment.spec.js — THE SAME LADDER, IN EVERY MODE, AT THE WORD.
//
// Word Bomb's tiered word landing replaced two things that were wrong in the same way: a rarity
// multiplier nobody could see, and a centre-screen popup you clicked away. The other three modes
// still had the second one — `RarityFlash`, `position: fixed; top: 30%; left: 50%` of the
// VIEWPORT, a label announced over the middle of the screen in three timed typing modes while the
// player's eyes are on a field at the bottom. This file is the gate for the replacement:
//
//   1. THE ANCHOR. Every mode's reaction lives in a slot belonging to the thing it is about — the
//      field in CHAIN and FUSE, the mugshot slots in SAT RUSH — and nothing about it is fixed to
//      the viewport. No `position: fixed` ancestor on any transient.
//   2. IT COVERS NOTHING. Not the field, not the clock, not the prompt, not the HUD.
//   3. ONE LADDER. The band names and colours come from progress/rarity.js in every mode; the only
//      thing a mode may re-cut is the MATERIALS (SAT RUSH prints its tiers in the page's own inks
//      instead of house neon, because it is a duotone press, not a neon sticker sheet).
//
// `?rarityempty=1` loads an empty corpus, which by rarityIndex's own contract makes every accepted
// word OBSCURE. That is what makes this testable at all: otherwise each mode needs a word it
// happens to accept that the corpus happens not to contain.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

fs.mkdirSync('claude/rarity-shots', { recursive: true });

const VIEW = { width: 1366, height: 768 };
const ME = 'e2e-player';
const WB_PLAYERS = [
  { id: ME, name: 'ANDY', lives: 3, isHost: true },
  { id: 'p1', name: 'RIVAL', lives: 3, isHost: false },
];

async function seed(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.chain.runs', '5');
      localStorage.setItem('taw.fuse.runs', '5');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.rebirths', '1');
    } catch { /* storage blocked */ }
  });
}

/** Nothing transient may be fixed to the viewport, and nothing may cover the listed boxes. */
async function anchorCheck(page, protectedSel) {
  return page.evaluate((prot) => {
    const out = { fixed: [], over: [] };
    const trans = ['.wl', '.wl-stamp', '.wl-wins'];
    const px = (a, b) => {
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return ox > 1 && oy > 1 ? Math.round(Math.min(ox, oy)) : 0;
    };
    for (const sel of trans) {
      for (const t of document.querySelectorAll(sel)) {
        // Walk up: a slot pinned to the VIEWPORT is precisely the thing this replaced. The app's
        // own full-screen chrome layers (.app-viewport and friends) are `fixed` by design and are
        // not what this is looking for — a pinned LABEL is a small box at its own coordinates, so
        // anything covering essentially the whole screen is skipped.
        for (let e = t; e && e !== document.body; e = e.parentElement) {
          if (getComputedStyle(e).position !== 'fixed') continue;
          const b = e.getBoundingClientRect();
          if (b.width >= window.innerWidth * 0.95 && b.height >= window.innerHeight * 0.95) continue;
          out.fixed.push(sel + ' inside fixed ' + e.className);
          break;
        }
        for (const p of prot) {
          for (const pe of document.querySelectorAll(p)) {
            const n = px(t.getBoundingClientRect(), pe.getBoundingClientRect());
            if (n) out.over.push(sel + ' over ' + p + ' ' + n + 'px');
          }
        }
      }
    }
    out.fixed = [...new Set(out.fixed)];
    out.over = [...new Set(out.over)];
    return out;
  }, protectedSel);
}

// One word per CHAIN opener, every one ending in a letter with a deep supply.
const CHAIN_OPENERS = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future',
  g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice',
  o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where',
};

/** Drop a Word Bomb board with ME on the clock, and hand back the mock. */
async function wbBoard(page, query) {
  const mock = await installBackendMock(page);
  await seed(page);
  await page.goto('/?portal=1&rarityempty=1' + (query || ''));
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'hard', players: WB_PLAYERS },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players: WB_PLAYERS, combo: 'str', usedWords: [], timerSeconds: 20, maxLives: 3 },
  });
  await page.waitForTimeout(4700);
  return mock;
}

test('CHAIN: the word lands at the field, not at the middle of the screen', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize(VIEW);
  await installBackendMock(page);
  await seed(page);
  await page.goto('/?chain=1&portal=1&rarityempty=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });

  const letter = (await page.locator('.solo-center').first().innerText()).trim().toLowerCase().slice(0, 1);
  await page.locator('.solo-input').fill(CHAIN_OPENERS[letter]);
  await page.locator('.solo-input').press('Enter');

  const wl = page.locator('.solo-react .wl');
  await expect(wl).toBeVisible({ timeout: 5000 });
  await expect(wl).toHaveClass(/wl--obscure/);
  await page.screenshot({ path: 'claude/rarity-shots/chain-obscure.png' });

  const m = await anchorCheck(page, ['.solo-input', '.solo-clock', '.solo-center', '.solo-hud', '.solo-out']);
  // eslint-disable-next-line no-console
  console.log('RARITY | CHAIN | fixed=' + (m.fixed.join(',') || 'none') + ' | over=' + (m.over.join(',') || 'none'));
  expect(m.fixed, 'the reaction is pinned to the viewport').toEqual([]);
  expect(m.over, 'the reaction covers part of the board').toEqual([]);
});

test('CHAIN on a phone: the same slot still clears the field and the clock', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackendMock(page);
  await seed(page);
  await page.goto('/?chain=1&portal=1&rarityempty=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });

  const letter = (await page.locator('.solo-center').first().innerText()).trim().toLowerCase().slice(0, 1);
  await page.locator('.solo-input').fill(CHAIN_OPENERS[letter]);
  await page.locator('.solo-input').press('Enter');

  const wl = page.locator('.solo-react .wl');
  await expect(wl).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'claude/rarity-shots/chain-obscure-390.png' });

  const m = await anchorCheck(page, ['.solo-input', '.solo-clock', '.solo-center', '.solo-hud', '.solo-out']);
  // eslint-disable-next-line no-console
  console.log('RARITY | CHAIN 390 | fixed=' + (m.fixed.join(',') || 'none') + ' | over=' + (m.over.join(',') || 'none'));
  expect(m.fixed, 'the reaction is pinned to the viewport').toEqual([]);
  expect(m.over, 'the reaction covers part of the board').toEqual([]);
  // ...and the page still does not scroll.
  const scroll = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
  expect(scroll, 'the landing made the page scroll').toBeLessThanOrEqual(0);
});

test('FUSE: the same slot, the same ladder', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize(VIEW);
  await installBackendMock(page);
  await seed(page);
  await page.goto('/?fuse=1&portal=1&rarityempty=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });

  // FUSE shows a fragment and takes any ACCEPT word containing it. The accept list is a repo file,
  // so the test can pick a word that is certain to be taken instead of guessing one.
  const accept = fs.readFileSync('src/solo/words.accept.txt', 'utf8').split(/\s+/);
  const fragment = (await page.locator('.solo-center').first().innerText()).trim().toLowerCase();
  const word = accept.find((w) => w.length >= 4 && w.includes(fragment));
  expect(word, 'no accepted word contains the fragment ' + fragment).toBeTruthy();

  await page.locator('.solo-input').fill(word);
  await page.locator('.solo-input').press('Enter');

  const wl = page.locator('.solo-react .wl');
  await expect(wl).toBeVisible({ timeout: 5000 });
  await expect(wl).toHaveClass(/wl--obscure/);
  await page.screenshot({ path: 'claude/rarity-shots/fuse-obscure.png' });

  const m = await anchorCheck(page, ['.solo-input', '.solo-clock', '.solo-center', '.solo-hud', '.solo-out']);
  // eslint-disable-next-line no-console
  console.log('RARITY | FUSE | fixed=' + (m.fixed.join(',') || 'none') + ' | over=' + (m.over.join(',') || 'none'));
  expect(m.fixed, 'the reaction is pinned to the viewport').toEqual([]);
  expect(m.over, 'the reaction covers part of the board').toEqual([]);
});

test('SAT RUSH: the capture reacts at the mugshot slots, in the page own ink', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(VIEW);
  await installBackendMock(page);
  await seed(page);
  await page.goto('/?satRush=1&portal=1&rarityempty=1');

  // Menu card -> Cover -> Play -> mode picker -> BRIEFING -> Start. (Same path as sat-rush.spec.)
  const card = page.locator('[data-game="sat-rush"]');
  await expect(card).toBeVisible({ timeout: 20000 });
  await card.locator('.game-card').click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.sr-modeselect')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /BRIEFING/ }).click();
  await page.getByRole('button', { name: 'Start the run' }).click();
  await page.locator('.sr-slots').waitFor({ state: 'visible', timeout: 30000 });

  // SAT RUSH reveals letters on a cadence and NEVER auto-reveals the last one, so typing whatever
  // is currently showing, repeatedly, always finishes a word eventually.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await page.locator('.sr-react .wl').count()) break;
    const letters = await page.evaluate(() => {
      const slots = [...document.querySelectorAll('.sr-slots .sr-slot')];
      return slots.map((s) => (s.textContent || '').trim()).join('');
    });
    const typed = letters.replace(/[^a-zA-Z]/g, '');
    if (typed) await page.keyboard.type(typed, { delay: 20 });
    await page.waitForTimeout(700);
  }

  const wl = page.locator('.sr-react .wl');
  await expect(wl).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'claude/rarity-shots/sat-obscure.png' });

  const m = await anchorCheck(page, ['.sr-hud', '.sr-clue', '.sr-reward']);
  // eslint-disable-next-line no-console
  console.log('RARITY | SAT | fixed=' + (m.fixed.join(',') || 'none') + ' | over=' + (m.over.join(',') || 'none'));
  expect(m.fixed, 'the reaction is pinned to the viewport').toEqual([]);
  // `.sr-slots` is NOT in that list on purpose: the capture perching on the top edge of the
  // mugshot row by a couple of px is a stamp applied to the mugshot, which is what this page does
  // with CAPTURED!! and ESCAPED!! already. What it must not touch is the CLUE (the thing you are
  // still reading), the HUD, or the reward footer.
  expect(m.over, 'the capture covers the clue, the HUD or the reward').toEqual([]);
});

test('WORD BOMB: option A and option B for the top rung, same frame', async ({ page }) => {
  test.setTimeout(90_000);
  for (const variant of ['a', 'b']) {
    await page.setViewportSize(VIEW);
    const mock = await wbBoard(page, variant === 'b' ? '&obscure=b' : '');
    mock.pushToClient({ type: 'word_result', payload: { playerId: ME, word: 'zymurgy', valid: true, accepted: true } });
    await page.waitForTimeout(320);
    const wl = page.locator('.wl');
    await expect(wl).toHaveClass(/wl--obscure/);
    if (variant === 'b') await expect(wl).toHaveClass(/wl--obscure-b/);
    else await expect(wl).not.toHaveClass(/wl--obscure-b/);
    await page.screenshot({ path: 'claude/rarity-shots/wb-obscure-' + variant + '.png' });
  }
});

test('WORD BOMB: the pre-submit hint, on and off', async ({ page }) => {
  test.setTimeout(90_000);
  for (const on of [false, true]) {
    await page.setViewportSize(VIEW);
    await wbBoard(page, on ? '&rarityhint=1' : '');
    await page.locator('.game-input').fill('stricture');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'claude/rarity-shots/wb-hint-' + (on ? 'on' : 'off') + '.png' });
    expect(await page.locator('.wb-rarity-hint').count(), 'the hint must be OFF by default').toBe(on ? 1 : 0);
  }
});
