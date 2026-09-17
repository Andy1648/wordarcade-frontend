// no-hidden-wins-solo.spec.js — BATCH G. THE SAME INVARIANT AS no-hidden-wins.spec.js, IN THE
// MODES IT NEVER COVERED.
//
//     sum(every wins line the UI showed)  ===  delta(taw.wins) across the same span
//
// no-hidden-wins.spec.js proves that for WORD BOMB. It is the only mode it drives — so the guard
// against Andy's "I be here getting like 800 but it gives like over 2k" has never been applied to
// CHAIN, FUSE or SAT Rush.
//
// WHY THAT MATTERS HERE SPECIFICALLY. The fix for the original report collects every bonus credit
// from the wins ledger into App.jsx's `winsBonusLines` (App.jsx ~562) and passes it to the game-over
// card, so a mid-run achievement or collection milestone is NAMED rather than appearing only in the
// balance. Both call sites that receive it are in GameScreen.jsx (word-bomb ~3729, blitz ~4388).
// SoloShell.jsx ~200 renders `<WinsEarnedTotal amount={over.winsEarned} />` with NO lines prop, and
// `over.winsEarned` is a per-word-money counter local to ChainGame/FuseGame. SAT Rush renders its
// own `+{winsEarned}` panel with the same per-word-only number.
//
// And the bonus is reachable in exactly these modes: all three call recordAcceptedWord (ChainGame
// ~152, FuseGame ~175, SatRushGame ~115), and collection.js ~135 grants a milestone payout through
// grantWins mid-run. Its own comment calls that grant "THE 5,000 ANDY COULD NOT ACCOUNT FOR".
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// One word per CHAIN opener (chain.js CHAIN_OPENERS), every one ENDING IN 'E' so the next required
// letter is always 'e' — a deep-supply letter, so the engine never reroutes and the run is
// deterministic. Same table as solo-endgame.spec.js, which is the proven driver for this mode.
const OPENER_WORD = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future',
  g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice',
  o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where',
};
const E_WORDS = ['estate', 'elite', 'escape', 'expense', 'example', 'everyone', 'evidence', 'exchange'];

/** 99 distinct collected words — one short of the first milestone, so the run crosses it. */
function collectionAt(n) {
  const w = {};
  for (let i = 0; i < n; i++) w[`seedword${i}`] = [0, 0, 20000, i];
  return JSON.stringify({ v: 1, seq: n, w, ms: [] });
}

const SEED = {
  'taw.wins': '10000',
  'taw.winsLifetime': '10000',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }),
  'taw.rebirths': '0',
  'taw.collection': collectionAt(99),
  // Not a first run: CHAIN's run-1 death card is a how-to card with no score line (SoloShell
  // `over.bare`), which renders no receipt at all and would make this vacuous.
  'taw.chain.runs': '5',
  'taw.fuse.runs': '5',
  'taw.seenMenuSpotlight': '1',
  'taw.seenGameSpotlight': '1',
  'taw.seenTeach.chain': '1',
  'taw.seenTeach.fuse': '1',
};

const readWins = (page) => page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));

/** What the end card CLAIMS the run paid, read from the rendered DOM rather than from state. */
async function readReceipt(page) {
  return page.evaluate(() => {
    const num = document.querySelector('.wins-earned-num');
    return {
      total: num ? Number((num.textContent || '').replace(/[^0-9]/g, '')) : null,
      lines: [...document.querySelectorAll('[data-wins-line]')].map((n) => ({
        label: n.getAttribute('data-wins-line'),
        amount: Number(n.getAttribute('data-wins-amount') || 0),
      })),
    };
  });
}

async function requiredLetter(page) {
  const raw = (await page.locator('.solo-center').first().innerText()).trim();
  return raw.toLowerCase().slice(0, 1);
}

async function playWord(page, word) {
  const input = page.locator('.solo-input');
  await input.fill(word);
  await input.press('Enter');
  await expect(input).toHaveValue('', { timeout: 5000 });
}

test('CHAIN: every credit is on screen — the run total must equal the balance delta', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, SEED);
  await installBackendMock(page);

  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });

  const before = await readWins(page);

  // Six accepted links: past the 3-word gate, and the first real word crosses the 100-word
  // collection milestone that the seed leaves one short of.
  const pool = [...E_WORDS];
  for (let i = 0; i < 6; i += 1) {
    const letter = await requiredLetter(page);
    const word = i === 0 ? OPENER_WORD[letter] : pool.shift();
    await playWord(page, word);
  }

  // End the run: a word that cannot be a link kills it.
  await playWord(page, 'zzzzz').catch(() => {});
  await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForTimeout(800);

  const after = await readWins(page);
  const delta = after - before;
  expect(delta, 'the run credited nothing — the test would be vacuous').toBeGreaterThan(0);

  const shown = await readReceipt(page);
  expect(shown.total, 'the CHAIN death card rendered no WINS EARNED total at all').not.toBeNull();

  const lineSum = shown.lines.length
    ? shown.lines.reduce((a, l) => a + l.amount, 0)
    : shown.total;

  const anon = shown.lines.filter((l) => !l.label || l.label === 'UNATTRIBUTED');
  expect(anon, `credits with no reason: ${JSON.stringify(anon)}`).toEqual([]);

  // THIS TEST MUST NOT PASS VACUOUSLY. If no bonus lands during the run, `total === delta` holds
  // trivially and proves nothing about the defect it was written for. The seed leaves the
  // collection one word short of the 100-word milestone, so the first accepted link must cross it
  // and the card must carry a named COLLECTION row. Without this assertion the whole spec is
  // satisfied by a run that never exercised the fix.
  const collection = shown.lines.filter((l) => (l.label || '').startsWith('COLLECTION'));
  expect(
    collection.length,
    `no COLLECTION milestone line on the card — the run did not cross the 100-word milestone, so `
      + `this test proved nothing. Lines: ${JSON.stringify(shown.lines)}`,
  ).toBeGreaterThan(0);

  expect(shown.total, 'WINS EARNED does not equal the sum of its own lines').toBe(lineSum);

  // THE INVARIANT.
  expect(
    shown.total,
    `CHAIN's card accounted for ${shown.total} wins but taw.wins moved by ${delta} — `
      + `${delta - shown.total} wins were credited with nothing on screen saying so. `
      + `Lines shown: ${JSON.stringify(shown.lines)}`,
  ).toBe(delta);
});
