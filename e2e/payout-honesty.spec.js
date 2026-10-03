// e2e/payout-honesty.spec.js — fix/payout-honesty: what a Word Bomb word is QUOTED, what the
// receipt SAYS it paid, and what actually lands in storage are one number.
//
// Played through the mock-WS harness on CHILL and HELL, at 0 and 10 MOMENTUM marks. For every
// accepted word:
//   XP    taw.xp delta  ==  0 and the receipt has NO XP line (PROGRESSION v11, amended: a game WORD
//         pays WINS ONLY — the bar fills from LETTERS typed, and this harness types none)
//   WINS  taw.wins (+ taw.winsCarry tenths) delta  ==  the receipt's "+N WINS"  ==  the card's
//         WINS / WORD quote × what the card cannot know
//
// WHICH QUOTE THE CARD IS MAKING. The menu card (GameCard) calls perWordRateNow() with NO
// difficulty — it quotes a 5-letter COMMON word on CHILL, with the player's permanent stack
// (mode, rebirth, streak, momentum/mark/mastery as BONUS). So:
//   - DIFFICULTY is not on the menu card. It is picked later, in the room. The in-game LiveStack
//     (the receipt slot before the first word) IS difficulty-aware, and is checked against
//     card × DIFFICULTY_MULT here, so HELL's ×2 is quoted somewhere before the player pays it.
//   - COMBO (+0.1 per consecutive accept, so the FIRST word is already ×1.1), RARITY, LENGTH and
//     LUCKY are per-word: no card can know them. The receipt names each one; the spec multiplies
//     the card quote by exactly the per-word rows the receipt names, and fails on anything else.
//   - The 3-word GATE: words 1-2 bank no wins (receipt says HELD); word 3 releases all three.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { need } from '../src/progress/xp.js';

const ME = 'e2e-player';
// 5 letters (the card's reference length) and COMMON (rarity ×1), so the only per-word factor the
// receipt should name is COMBO (and LUCKY, on the 1-in-40 word that draws it).
const WORDS = ['water', 'house', 'money', 'world', 'paper'];
const DIFF_MULT = { chill: 1, hard: 2 };
const SETUPS = [
  { diff: 'chill', label: 'CHILL', momentum: 0 },
  { diff: 'chill', label: 'CHILL', momentum: 10 },
  { diff: 'hard', label: 'HELL', momentum: 0 },
  { diff: 'hard', label: 'HELL', momentum: 10 },
];
const PERMANENT = new Set(['MODE', 'DIFFICULTY', 'REBIRTH', 'STREAK', 'BONUS']);
const PER_WORD = new Set(['COMBO', 'LUCKY', 'FORGE']); // what the card legitimately cannot know (FORGE depends on the word's letters)

const num = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

test.use({ viewport: { width: 1366, height: 768 } });

for (const s of SETUPS) {
  test(`payout honesty: Word Bomb ${s.label} @ ${s.momentum} momentum — card, receipt and ledger agree`, async ({ page }) => {
    const mock = await installBackendMock(page);
    await page.addInitScript((momentum) => {
      // Deterministic factors. A LUCKY word carries a 5th factor, and the COMPACT receipt shows the
      // 4 biggest and folds the rest into "+1 MORE" — which hides WHICH factor it holds, so the
      // permanent/per-word split below cannot be checked (a full-suite run hit it on "money").
      // LUCKY's own payout is gated by parity-wb-blitz; the rare pop never shows on a receipt but
      // lands ~100 wins inside the banked delta.
      window.__TAW_LUCKY = 'off';
      window.__TAW_RARE_POP = 'off';
      if (sessionStorage.getItem('ph.seeded')) return;
      sessionStorage.setItem('ph.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      // Andy oct2: MOMENTUM became the LETTER FORGE; an old momentum count migrates buy-for-buy, so
      // this seed now means "N forged letters" and the receipt carries a per-word FORGE row.
      localStorage.setItem('taw.momentum', String(momentum));
    }, s.momentum);
    await page.goto('/?portal=1');
    await expect.poll(() => mock.connectionAttempts(), { timeout: 15000 }).toBeGreaterThan(0);

    // THE CARD'S QUOTE (menu, no difficulty → the CHILL quote at this momentum).
    const card = page.locator('.game-card-magnet[data-game="word-bomb"]');
    // Andy oct2: the card no longer quotes XP / WORD — it quotes WINS / WORD (the base word) and
    // says what fills the bar. PROGRESSION v11 (amended): words pay WINS only.
    const perkEl = card.locator('.game-card-xp').filter({ visible: true }).first();
    const winsEl = card.locator('.game-card-payout').filter({ visible: true }).first();
    // v11 (amended): the card says what fills the bar — "BASE 10 XP / LETTER" — beside its WINS / WORD.
    await expect(perkEl).toContainText('BASE 10 XP / LETTER');
    const cardWins = num((await winsEl.innerText()).split('WINS')[0]);
    const cardXp = cardWins * 10;

    const readLedger = () => page.evaluate(() => {
      // PV10: the XP number comes from the app's probe (taw.xp stores the fraction into the level).
      const xp = window.__tawXp ? window.__tawXp() : { level: 1, intoLevel: 0 };
      return {
        lv: xp.level,
        into: Math.round(xp.intoLevel),
        wins: Number(localStorage.getItem('taw.wins') || 0),
        carry: Number(localStorage.getItem('taw.winsCarry') || 0),
      };
    });
    const cumXp = (l) => {
      let t = l.into;
      for (let n = 1; n < l.lv; n += 1) t += need(n);
      return t;
    };
    const winTenths = (l) => l.wins * 10 + l.carry;

    const players = [
      { id: ME, name: 'YOU', lives: 3, isHost: true },
      { id: 'p2', name: 'RIVAL', lives: 3, isHost: false },
    ];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: s.diff, players } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(80);
    const myTurn = () => mock.pushToClient({
      type: 'turn_update',
      payload: { currentPlayerId: ME, players, combo: 'er', timerSeconds: 22, maxLives: 3, round: 1, difficultyKey: s.diff, usedWords: [], usedAnswers: [] },
    });
    myTurn();

    // THE DIFFICULTY-AWARE QUOTE: the LiveStack in the receipt slot before the first word.
    const lstack = page.locator('.wb-receipt-rail .lstack-rate');
    await expect(lstack).toBeVisible();
    const stackWins = num(await lstack.innerText());
    expect(stackWins * 10, `in-game quote = card × ${s.label} ×${DIFF_MULT[s.diff]}`).toBeCloseTo(cardXp * DIFF_MULT[s.diff], 6);

    const rows = [];
    let released = 0; // receipt XP of words the 3-word gate is still holding
    for (let i = 0; i < WORDS.length; i += 1) {
      const before = await readLedger();
      myTurn();
      await page.waitForTimeout(40);
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: WORDS[i] } });
      await expect.poll(async () => cumXp(await readLedger()), { timeout: 8000 }).toBeGreaterThan(cumXp(before));
      await expect(page.locator('.wb-receipt')).toBeVisible();
      await page.waitForTimeout(60);
      const after = await readLedger();
      const receipt = await page.evaluate(() => {
        const r = document.querySelector('.wb-receipt');
        const terms = [...r.querySelectorAll('.payout-term')]
          .filter((t) => t.querySelector('.payout-k'))
          .map((t) => ({ k: t.querySelector('.payout-k').textContent.trim(), v: Number(t.querySelector('.payout-v').textContent.replace(/[^0-9.]/g, '')) }));
        return {
          xp: r.querySelector('.payout-headline-xp'),
          wins: r.querySelector('.payout-headline-wins').textContent,
          held: !!r.querySelector('.payout-held'),
          base: r.querySelector('.payout-term--base').textContent, // "BASE 1 WINS / LETTER × 5 LETTERS"

          terms,
        };
      });
      const receiptWins = num(receipt.wins.split('WINS')[0]);
      const [perLetter, letters] = receipt.base.split('×').map(num);

      const unknown = receipt.terms.filter((t) => !PERMANENT.has(t.k) && !PER_WORD.has(t.k));
      expect(unknown, `word "${WORDS[i]}": receipt names a factor this spec did not plan for (rarity / length / cap?)`).toEqual([]);
      const perm = receipt.terms.filter((t) => PERMANENT.has(t.k)).reduce((a, t) => a * t.v, 1);
      const perWord = receipt.terms.filter((t) => PER_WORD.has(t.k));
      const perWordMult = perWord.reduce((a, t) => a * t.v, 1);
      const quote = cardXp * DIFF_MULT[s.diff]; // the WINS / WORD quote for THIS setup, in XP units (× 10)
      const expected = Math.round(Number((quote * perWordMult).toPrecision(12))); // the wins product
      const receiptWinsXp = Math.round(receiptWins * 10);

      const awardedXp = cumXp(after) - cumXp(before);
      const bankedTenths = winTenths(after) - winTenths(before);
      released += receiptWinsXp;
      const n = i + 1;
      const expectTenths = n < 3 ? 0 : released;
      if (n >= 3) released = 0;

      rows.push({
        word: WORDS[i],
        cardQuoteXp: cardXp,
        setupQuoteXp: quote,
        perWord: perWord.map((t) => `${t.k} ×${t.v}`).join(' ') || '—',
        expectedWinsXp: expected,
        awardedXp,
        receiptWins,
        bankedWins: bankedTenths / 10,
        permanentOnReceipt: perm,
      });

      expect(awardedXp, `word "${WORDS[i]}": a game WORD moves the bar by 0 XP`).toBe(0);
      expect(receipt.xp, `word "${WORDS[i]}": no XP line on a game receipt`).toBeNull();
      expect(receiptWinsXp, `word "${WORDS[i]}": receipt WINS × 10 == card quote ${quote} × ${perWord.map((t) => `${t.k} ×${t.v}`).join(' ')}`).toBe(expected);
      expect(perm, `word "${WORDS[i]}": receipt's permanent stack == the setup's quoted multiplier`).toBeCloseTo(quote / (letters * perLetter * 10), 6); // the base is in WINS (× 10 = XP units)
      expect(receipt.held, `word ${n}: HELD caption iff the 3-word gate holds it`).toBe(n < 3);
      expect(bankedTenths / 10, `word ${n} "${WORDS[i]}": wins banked (incl. carried tenths)`).toBeCloseTo(expectTenths / 10, 6);
    }
    test.info().annotations.push({ type: 'payout', description: JSON.stringify({ setup: `${s.label} m${s.momentum}`, rows }) });
    console.log(`[payout-honesty] ${s.label} m${s.momentum} ${JSON.stringify(rows)}`);
  });
}
