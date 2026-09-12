// e2e/number-format.spec.js — EVERY NUMBER THE PLAYER READS GOES THROUGH format.js.
//
// format.js says so in its first line ("a raw `47110` on screen is a bug") and nothing
// enforced it. A source grep is not enough either: it finds `toLocaleString` (there was
// none) and misses the actual failures, which were plain JSX interpolations of an integer.
// Three of them were the most-seen numbers in the game — the live "+N WINS" pill, which is
// on screen for every word of every run in every mode, and the game-over WINS EARNED total.
// At R10 a run pays ~1e10, so that card read "+16384927364710 WINS".
//
// So this checks the RENDERED DOM instead. formatNum's output can never contain five
// consecutive digits: under 10,000 it groups in threes with a thin space (U+2009), and at or
// above 10,000 it abbreviates to three significant figures with a K/M/B/T suffix. A run of
// five bare digits in visible text is therefore, by construction, a number that skipped it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// A rich, deeply-rebirthed save — the state where an unformatted number is unmissable.
const RICH = {
  'taw.wins': '48213947221',
  'taw.winsLifetime': '992138470221',
  'taw.xp': JSON.stringify({ lv: 214, into: 918273 }),
  'taw.rebirths': '10',
  'taw.keytier': '17',
  'taw.letters': '8123456',
};

const THIN = ' ';

// Things that legitimately hold a long digit run and are not economy figures.
const ALLOWED = [
  /^\d{4}$/,                 // a room code is four characters; a four-digit one is fine
  /^\d{1,2}:\d{2}$/,         // clock
];

async function scan(page) {
  return page.evaluate((thin) => {
    const bad = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const raw = (n.nodeValue || '').trim();
      if (!raw) continue;
      const el = n.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      if (!el.getClientRects().length) continue;
      // strip the thin space so a correctly grouped "48 213 947 221" is not five digits
      const flat = raw.split(thin).join('|');
      const hit = flat.match(/\d{5,}/);
      if (!hit) continue;
      bad.push({
        text: raw.slice(0, 48),
        where: el.tagName.toLowerCase()
          + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      });
    }
    return bad;
  }, THIN);
}

const filtered = (rows) => rows.filter((r) => !ALLOWED.some((re) => re.test(r.text)));
const show = (rows) => rows.map((r) => `${r.where} "${r.text}"`).join(' | ');

async function richMenu(page) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, RICH);
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
}

test('the menu prints no raw number', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await richMenu(page);
  const bad = filtered(await scan(page));
  expect(bad, `unformatted numbers on the menu: ${show(bad)}`).toEqual([]);
});

for (const [label, sel] of [['SHOP', '.homepage-nav-btn.is-shop'], ['STATS', '.homepage-nav-btn.is-stats'], ['REBIRTH', '.homepage-nav-btn.is-rebirth']]) {
  test(`${label} prints no raw number`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await richMenu(page);
    await page.locator(sel).click();
    await page.waitForTimeout(500);
    const bad = filtered(await scan(page));
    expect(bad, `unformatted numbers in ${label}: ${show(bad)}`).toEqual([]);
  });
}

test('the in-game WINS pill and the game-over total print no raw number', async ({ page }) => {
  // This is the case the source grep could not see and the one that mattered most: the pill
  // is on screen for every word of every run, and the total is the last thing a run says.
  await page.setViewportSize({ width: 1280, height: 720 });
  const ME = 'e2e-player';
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, RICH);
  const mock = await (async () => {
    const m = await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    return m;
  })();
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p1', name: 'PLAYER1', lives: 3 },
  ];
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 } });
  await page.waitForTimeout(4800);

  // Bank enough words to clear the payout gate, with a rebirthed multiplier behind them.
  for (const w of ['STRAND', 'MINSTREL', 'STRIDE', 'ABSTRACT']) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: w, playerId: ME } });
    await page.waitForTimeout(120);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [w], timerSeconds: 30, maxLives: 3 } });
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
  const inGame = filtered(await scan(page));
  expect(inGame, `unformatted numbers on the board: ${show(inGame)}`).toEqual([]);

  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, players } });
  await page.waitForTimeout(900);
  const over = filtered(await scan(page));
  expect(over, `unformatted numbers on the game-over card: ${show(over)}`).toEqual([]);
});
