// node --test — PAYOUT HONESTY (fix/payout-honesty). ANDY: "nothing hidden. Every number on a card
// must match what the game actually awards." One test per measured violation, plus the grid the
// acceptance asks for (Word Bomb × CHILL/HELL × 0/1/5/10 momentum marks, card vs awarded).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { perWordRateNow, awardWordXp, bankWordWins, bankWeight, getWins } from './wins.js';
import { FORGE_KEY, forgeMultForWord } from './forge.js';
import { formatMultExact } from '../format.js';

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

function withStorage(fn, seed = {}) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)]));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn();
  } finally {
    globalThis.localStorage = saved;
  }
}

// Every `name({ ... })` call in a source file, as the text between its braces.
function callArgs(text, name) {
  const out = [];
  const re = new RegExp(`${name}\\(\\{`, 'g');
  let m;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ at: m.index, body: text.slice(start, i - 1) });
  }
  return out;
}
const difficultyArg = (body) => {
  const m = /\bdifficulty:\s*([^,\n}]+)/.exec(body);
  return m ? m[1].trim() : null;
};

// ---- BUG 1 -------------------------------------------------------------------------------------
// The card's "XP / WORD" line includes difficulty; the live XP award did not, because App.jsx never
// passed it to awardWordXp (bankWordWins, a few lines below, always did). On HELL the card quoted
// 2× the XP actually credited.
test('BUG 1: the in-game XP award carries DIFFICULTY exactly as the wins bank and the card do', () => {
  const app = src('../App.jsx');
  const awards = callArgs(app, 'awardWordXp');
  const banks = callArgs(app, 'bankWordWins');
  assert.ok(awards.length >= 2, 'expected the Word Bomb + Blitz awardWordXp calls in App.jsx');
  for (const a of awards) {
    const bank = banks.find((b) => b.at > a.at); // the SAME word's wins bank, just below it
    assert.ok(bank, 'every XP award in App.jsx is followed by its wins bank');
    const bankDiff = difficultyArg(bank.body);
    assert.ok(bankDiff, 'the wins bank passes difficulty');
    assert.equal(
      difficultyArg(a.body),
      bankDiff,
      `awardWordXp({${a.body.trim().slice(0, 60)}…}) must pass the same difficulty as its bankWordWins`,
    );
  }
  // The credited amount equals the card's line on every difficulty. Rebirth Rush: difficulty is OUT of the
  // frozen formula, so CHILL and HELL both quote AND pay the base 100 (10 wins) on a 5-letter Word Bomb word.
  withStorage(() => {
    for (const difficulty of ['chill', 'hard']) {
      const card = perWordRateNow({ mode: 'word-bomb', difficulty, keyTier: 0, rebirthCount: 0 });
      const res = awardWordXp({ mode: 'word-bomb', difficulty, wordLength: 5, weight: 1, keyTier: 0, rebirthCount: 0 });
      assert.equal(res.gain, card.xp, difficulty);
      assert.equal(card.xp, 100, `${difficulty}: a 100 (10-win) Word Bomb word`);
    }
  });
});

// ---- BUG 2 -------------------------------------------------------------------------------------
// formatMult (one decimal) printed ×1.05 as ×1.1, ×1.25 as ×1.3, ×1.15 as ×1.2 on the mode cards and
// the live panel. They must use the receipt's formatter (PayoutBreakdown → formatMultExact).
test('BUG 2: mode cards + live panel print multipliers with the RECEIPT formatter (formatMultExact)', () => {
  const receipt = src('../components/PayoutBreakdown.jsx');
  assert.match(receipt, /formatMultExact/, 'the receipt formatter is formatMultExact');
  for (const file of ['GameCard.jsx', 'ModeExample.jsx', 'LiveStack.jsx']) {
    const text = src(`../components/${file}`);
    assert.ok(!/\bformatMult\(/.test(text), `${file} must not use the rounding formatMult`);
    assert.match(text, /formatMultExact\(/, `${file} must print × with formatMultExact`);
  }
  assert.equal(formatMultExact(1.05), '1.05');
  assert.equal(formatMultExact(1.25), '1.25');
  assert.equal(formatMultExact(1.15), '1.15');
  assert.equal(formatMultExact(2.02), '2.02');
});

// ---- BUG 3 (the LETTER FORGE, now OUT of the formula) ------------------------------------------
// Rebirth Rush froze the wins formula (BASE 10 × len/5 × MODE × 5^R × MARK × BOOST): the LETTER FORGE no
// longer multiplies a word. Honesty still holds — the card, the XP award and the wins bank agree — and a
// forged letter must not secretly pay (or be shown to pay) anything.
test('BUG 3: forge levels on a letter in the word change NOTHING the word awards (forge is out of the formula)', () => {
  for (const m of [0, 1, 5, 10]) {
    withStorage(
      () => {
        const word = 'tease';
        assert.equal(forgeMultForWord(word), 1 + 0.1 * m, 'the forge store itself still reads');
        const xp = awardWordXp({ mode: 'word-bomb', difficulty: 'chill', wordLength: 5, weight: 1, keyTier: 0, rebirthCount: 0, word }).gain;
        let banked = 0;
        for (let w = 3; w < 13; w++) {
          banked += bankWordWins({ mode: 'wordBomb', difficulty: 'chill', prevWords: w, nowWords: w + 1, prevWeight: w * bankWeight(1, word), nowWeight: (w + 1) * bankWeight(1, word), wordLength: 5, rebirthCount: 0 });
        }
        assert.equal(bankWeight(1, word), 1, `E lv ${m}: the banking weight carries no forge`);
        assert.equal(xp, 100, `E lv ${m}: XP is the base 100`);
        assert.equal(banked, 100, `E lv ${m}: 10 words bank 10 × 10`);
        assert.equal(getWins(), banked);
      },
      { [FORGE_KEY]: JSON.stringify({ e: m }) },
    );
  }
});

// ---- THE ACCEPTANCE GRID -----------------------------------------------------------------------
test('card quotes the word; the awarded word = the card, for CHILL/HELL × E lv 0/1/5/10', () => {
  for (const difficulty of ['chill', 'hard']) {
    for (const m of [0, 1, 5, 10]) {
      withStorage(
        () => {
          const card = perWordRateNow({ mode: 'word-bomb', difficulty, keyTier: 0, rebirthCount: 0 });
          assert.deepEqual([card.xp, card.rate], [100, 10], `${difficulty}/${m} card`);
          const word = 'tease';
          const xp = awardWordXp({ mode: 'word-bomb', difficulty, wordLength: 5, weight: 1, keyTier: 0, rebirthCount: 0, word }).gain;
          let banked = 0;
          for (let w = 3; w < 13; w++) {
            banked += bankWordWins({ mode: 'wordBomb', difficulty, prevWords: w, nowWords: w + 1, prevWeight: w * bankWeight(1, word), nowWeight: (w + 1) * bankWeight(1, word), wordLength: 5, rebirthCount: 0 });
          }
          assert.deepEqual([xp, banked / 10], [100, 10], `${difficulty}/${m} awarded`);
        },
        { [FORGE_KEY]: JSON.stringify({ e: m }) },
      );
    }
  }
});
