// node --test — PAYOUT HONESTY (fix/payout-honesty). ANDY: "nothing hidden. Every number on a card
// must match what the game actually awards." One test per measured violation, plus the grid the
// acceptance asks for (Word Bomb × CHILL/HELL × 0/1/5/10 momentum marks, card vs awarded).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { perWordRateNow, awardWordXp, bankWordWins, getWins } from './wins.js';
import { MOMENTUM_KEY, momentumMult } from './momentum.js';
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
  // And passing it makes the credited XP equal the card's XP line on HELL.
  withStorage(() => {
    const card = perWordRateNow({ mode: 'word-bomb', difficulty: 'hard', keyTier: 0, rebirthCount: 0 });
    const res = awardWordXp({ mode: 'word-bomb', difficulty: 'hard', wordLength: 5, weight: 1, keyTier: 0, rebirthCount: 0 });
    assert.equal(res.gain, card.xp);
    assert.equal(card.xp, 200, 'HELL is ×2 on a 100-XP Word Bomb word');
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

// ---- BUG 3 -------------------------------------------------------------------------------------
// xpPerWord snapped to the nearest 10 XP, so a 100-XP / 10-win word stayed 100 XP / 10 wins from
// 0 through 9 momentum marks while the shop said "+1%" a mark. Every mark must change the award.
test('BUG 3: every momentum mark 0→10 changes what a 10-win Word Bomb word awards (XP and wins)', () => {
  let prev = null;
  for (let m = 0; m <= 10; m++) {
    withStorage(
      () => {
        const card = perWordRateNow({ mode: 'word-bomb', difficulty: 'chill', keyTier: 0, rebirthCount: 0 });
        const xp = awardWordXp({ mode: 'word-bomb', difficulty: 'chill', wordLength: 5, weight: 1, keyTier: 0, rebirthCount: 0 }).gain;
        // Bank ten post-gate words: exactly the card's rate × 10, to the win (tenths carried).
        let banked = 0;
        for (let w = 3; w < 13; w++) {
          banked += bankWordWins({ mode: 'wordBomb', difficulty: 'chill', prevWords: w, nowWords: w + 1, wordLength: 5, rebirthCount: 0 });
        }
        assert.equal(xp, Math.round(100 * momentumMult(m)), `mark ${m}: XP is 100 × (1 + ${m}%)`);
        assert.equal(xp, card.xp, `mark ${m}: awarded XP === card XP`);
        assert.equal(banked, Math.round(card.rate * 10), `mark ${m}: 10 words bank 10 × the card's ${card.rate}`);
        assert.equal(getWins(), banked);
        if (prev) {
          assert.ok(xp > prev.xp, `mark ${m} must award more XP than mark ${m - 1} (${xp} vs ${prev.xp})`);
          assert.ok(banked > prev.banked, `mark ${m} must bank more wins than mark ${m - 1} (${banked} vs ${prev.banked})`);
        }
        prev = { xp, banked };
      },
      { [MOMENTUM_KEY]: m },
    );
  }
});

// ---- THE ACCEPTANCE GRID -----------------------------------------------------------------------
test('card === awarded for Word Bomb × CHILL/HELL × 0/1/5/10 marks (XP per word, wins per word)', () => {
  const expected = {
    chill: { 0: [100, 10], 1: [101, 10.1], 5: [105, 10.5], 10: [110, 11] },
    hard: { 0: [200, 20], 1: [202, 20.2], 5: [210, 21], 10: [220, 22] },
  };
  for (const difficulty of ['chill', 'hard']) {
    for (const m of [0, 1, 5, 10]) {
      withStorage(
        () => {
          const card = perWordRateNow({ mode: 'word-bomb', difficulty, keyTier: 0, rebirthCount: 0 });
          const xp = awardWordXp({ mode: 'word-bomb', difficulty, wordLength: 5, weight: 1, keyTier: 0, rebirthCount: 0 }).gain;
          let banked = 0;
          for (let w = 3; w < 13; w++) {
            banked += bankWordWins({ mode: 'wordBomb', difficulty, prevWords: w, nowWords: w + 1, wordLength: 5, rebirthCount: 0 });
          }
          const [xpWant, winsWant] = expected[difficulty][m];
          assert.deepEqual([card.xp, card.rate], [xpWant, winsWant], `${difficulty}/${m} card`);
          assert.deepEqual([xp, banked / 10], [xpWant, winsWant], `${difficulty}/${m} awarded`);
        },
        { [MOMENTUM_KEY]: m },
      );
    }
  }
});
