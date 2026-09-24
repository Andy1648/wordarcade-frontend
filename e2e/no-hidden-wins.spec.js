// no-hidden-wins.spec.js — EVERY WIN THE PLAYER EARNS IS SHOWN, ATTRIBUTED, WHEN IT HAPPENS.
//
// ANDY, REPEATEDLY: "I be here getting like 800 but it gives like over 2k — idk where the thing
// comes from." / "Every single win he earns, no random hidden wins."
//
// THE INVARIANT, and it is the whole point of this file:
//
//     sum(every wins line the UI showed)  ===  delta(taw.wins) across the same span
//
// If those two disagree, the difference is money that appeared in the player's balance with
// nothing on screen accounting for it. That is the bug, stated as arithmetic.
//
// WHY A SCRIPTED RUN AND NOT A UNIT TEST. The per-word payout is already unit-tested; what is NOT
// testable in a unit is the JOIN between "what was credited" and "what was rendered", which lives
// across wins.js, App.jsx and three components. The only place both facts exist at once is a real
// run in a real DOM.
//
// THE SEED IS DELIBERATE. The collection sits at 99 distinct words, so the 100-word milestone
// (COLLECTION_MILESTONES[0], 5,000 wins, rebirth-scaled) fires DURING the run — which is exactly
// the shape of Andy's report: a four-figure run total with a five-figure balance change.
//
// WHAT THIS DOES NOT ASSERT: that the per-word amounts are CORRECT. perWordWins/bankWordWins own
// that and have their own unit tests. This asserts only that nothing is credited invisibly.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';

// 99 distinct collected words — one short of the first milestone.
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
  'taw.keytier': '2',
  'taw.collection': collectionAt(99),
};

// Twenty real words, all valid Word Bomb answers containing "str".
const WORDS = [
  'STRAND', 'MINSTREL', 'STRIDE', 'ABSTRACT', 'STRAY', 'STREAM', 'STRONG', 'STRIPE',
  'STRUT', 'STRAP', 'STREET', 'STRESS', 'STRIKE', 'STRING', 'STROLL', 'STRUCK',
  'STRAIN', 'STRANGE', 'STREAK', 'STRICT',
];

async function readWins(page) {
  return page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));
}

test('no hidden wins: every credit is on screen, over a 20-word run', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, SEED);

  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);

  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p1', name: 'PLAYER1', lives: 3 },
  ];
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 } });
  await page.waitForTimeout(4800); // the 3-2-1-GO! overlay

  const before = await readWins(page);

  const used = [];
  for (const w of WORDS) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w, playerId: ME } });
    await page.waitForTimeout(140);
    used.push(w);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: used, timerSeconds: 30, maxLives: 3 } });
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(500);

  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, players } });
  await page.waitForTimeout(1200);

  const after = await readWins(page);
  const delta = after - before;
  expect(delta, 'the run credited nothing — the test would be vacuous').toBeGreaterThan(0);

  // WHAT THE UI SAID IT PAID. The game-over card's WINS EARNED is the run's own claim about
  // itself; it is the number Andy reads. Parsed from the rendered DOM rather than from state, so
  // this measures what a player can actually see.
  const shown = await page.evaluate(() => {
    const num = document.querySelector('.wins-earned-num');
    return {
      total: num ? Number((num.textContent || '').replace(/[^0-9]/g, '')) : null,
      lines: [...document.querySelectorAll('[data-wins-line]')].map((n) => ({
        label: n.getAttribute('data-wins-line'),
        amount: Number(n.getAttribute('data-wins-amount') || 0),
      })),
    };
  });

  const lineSum = shown.lines.reduce((a, l) => a + l.amount, 0);

  // Nothing may be credited under a placeholder label — that is a credit whose reason was never
  // written down, which is the same defect wearing a name.
  const anon = shown.lines.filter((l) => !l.label || l.label === 'UNATTRIBUTED');
  expect(anon, `credits with no reason: ${JSON.stringify(anon)}`).toEqual([]);

  // The headline number must equal its own rows, or the card contradicts itself.
  expect(shown.total, 'WINS EARNED does not equal the sum of its own lines').toBe(lineSum);

  // THE INVARIANT. Any shortfall is a credit with nothing on screen behind it.
  expect(
    lineSum,
    `the UI accounted for ${lineSum} wins but taw.wins moved by ${delta} — `
    + `${delta - lineSum} wins were credited with nothing on screen saying so. `
    + `Lines shown: ${JSON.stringify(shown.lines)}`,
  ).toBe(delta);
});
