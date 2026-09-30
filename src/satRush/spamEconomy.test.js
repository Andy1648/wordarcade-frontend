// spamEconomy.test.js — fix/sat-spam: mashing random letters must not pay.
//
// The exploit: every 3rd wrong keystroke revealed the next letter (the LAST one included), a clear
// paid full wins however it was reached, and wrong keys never cost a life — so a player spamming
// random letters solved every word for full money. This drives the REAL engine + slot input through
// a simulated clock that mirrors the hook's timeline (stage every 2800ms, free first letter +
// spell-along 1100ms ticks at the final stage, a 2-tick hold, then a miss; 850ms / 3200ms pauses),
// with two bots:
//   HONEST — knows 85% of words: reads the sentence, starts at stage 1, types at 6 keys/s with a 2%
//            typo rate (a wrong key, then the right one). The other 15% it rides the spell-along and
//            types the last letter.
//   SPAM   — a random letter every 100ms from the moment the word appears.
// "Before" = the same engine with the new rules off (spamRevealMiss: Infinity, every clear paid in
// full). Wins are measured in the unit every clear pays: word length x paid share.
// Gates (Andy): spam <= 10% of honest wins/min; honest unchanged +-5%.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSatRushEngine, spamPaidFraction } from './engine.js';
import { createSlotInput } from './input.js';

const STAGE_MS = 2800;
const SPELL_MS = 1100;
const CLEAR_PAUSE = 850;
const MISS_PAUSE = 3200;
const TICK = 50;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// Deterministic PRNG so the numbers in the table below reproduce exactly.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeWords(rng, n = 400) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const len = 5 + Math.floor(rng() * 7); // 5..11 letters, like the SAT deck
    let w = '';
    for (let k = 0; k < len; k++) w += LETTERS[Math.floor(rng() * 26)];
    rows.push({ word: w, pos: 'n', tier: 1 + (i % 5), gloss: 'g', context: 'c ___ c', root: null, alts: [] });
  }
  return rows;
}

function runBot(kind, { rules, seed }) {
  const rng = mulberry32(seed);
  const eng = createSatRushEngine({
    words: makeWords(mulberry32(seed + 1)),
    rng: mulberry32(seed + 2),
    config: rules ? {} : { spamRevealMiss: Infinity },
  });
  let t = 0;
  let wins = 0;
  let clears = 0;
  let words = 0;
  while (!eng.getState().gameOver && words < 150) {
    const cw = eng.nextWord();
    if (!cw) break;
    words += 1;
    const input = createSlotInput({ target: cw.word });
    const L = cw.word.length;
    const knows = kind === 'honest' && rng() < 0.85;
    const lastIdx = eng.config.stageMultipliers.length - 1;
    let wt = 0; // time into this word
    let stage = 0;
    let nextSpell = null;
    let missAt = null;
    let nextKey = kind === 'spam' ? 300 : knows ? STAGE_MS + 700 : null;
    let outcome = null;
    while (!outcome) {
      // ---- the hook's timeline ----
      if (stage < lastIdx && wt >= (stage + 1) * STAGE_MS) {
        eng.advanceStage();
        stage += 1;
        if (stage === lastIdx) {
          if (input.getState().revealed === 0) input.revealNextLetter(); // the free first letter
          nextSpell = wt + SPELL_MS;
        }
      }
      if (nextSpell !== null && wt >= nextSpell) {
        if (input.getState().revealed < L - 1) {
          input.revealNextLetter();
          nextSpell = wt + SPELL_MS;
        } else {
          nextSpell = null;
          missAt = wt + 2 * SPELL_MS;
        }
      }
      if (missAt !== null && wt >= missAt) outcome = 'miss';
      // an honest player who doesn't know it types the last letter once only one is missing
      if (!outcome && kind === 'honest' && !knows && nextKey === null && input.getState().revealed >= L - 1) {
        nextKey = wt + 400;
      }
      // ---- the bot's keystroke ----
      if (!outcome && nextKey !== null && wt >= nextKey) {
        const st = input.getState();
        const want = cw.word[st.typed.length];
        let key;
        if (kind === 'spam') key = LETTERS[Math.floor(rng() * 26)];
        else key = rng() < 0.02 ? LETTERS[(LETTERS.indexOf(want) + 1) % 26] : want;
        const res = input.typeLetter(key);
        if (res.accepted) {
          if (res.complete) outcome = 'clear';
        } else {
          const k = eng.registerWrongKeystroke();
          if (k && k.spamMiss) outcome = 'miss';
          else if (k && k.revealedLetter && input.revealNextLetter().complete) outcome = 'clear';
          if (kind === 'honest') nextKey = wt + 167; // retype the right letter
        }
        if (!outcome) nextKey = wt + (kind === 'spam' ? 100 : 167);
      }
      if (!outcome) wt += TICK;
    }
    if (outcome === 'clear') {
      const r = eng.submitCorrect({ revealed: input.getState().revealed });
      const paid = rules ? r.paidFraction : 1;
      wins += L * paid;
      clears += 1;
      t += wt + CLEAR_PAUSE;
    } else {
      eng.miss();
      t += wt + MISS_PAUSE;
    }
  }
  return { winsPerMin: wins / (t / 60000), clears, words, minutes: t / 60000, gameOver: eng.getState().gameOver };
}

function measure(kind, rules) {
  let wins = 0;
  let minutes = 0;
  let clears = 0;
  let words = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = runBot(kind, { rules, seed: seed * 97 });
    wins += r.winsPerMin * r.minutes;
    minutes += r.minutes;
    clears += r.clears;
    words += r.words;
  }
  return { winsPerMin: wins / minutes, minutes, clears, words };
}

test('spamPaidFraction: typed letters pay, spam-revealed ones do not, half-or-more spam pays 0', () => {
  assert.equal(spamPaidFraction(8, 0), 1);
  assert.equal(spamPaidFraction(8, 1), 7 / 8);
  assert.equal(spamPaidFraction(8, 4), 0);
  assert.equal(spamPaidFraction(5, 3), 0);
  assert.equal(spamPaidFraction(0, 0), 0);
});

test('the second spam reveal in a word is a miss, and every spam reveal zeroes heat', () => {
  const eng = createSatRushEngine({ words: makeWords(mulberry32(5)), rng: mulberry32(6) });
  eng.nextWord();
  const outs = [];
  for (let i = 0; i < 6; i++) outs.push(eng.registerWrongKeystroke());
  assert.equal(outs[2].revealedLetter, true);
  assert.equal(outs[2].spamMiss, false);
  assert.equal(outs[5].spamMiss, true);
  assert.equal(outs[5].revealedLetter, false);
  assert.equal(eng.getState().heat, 0);
});

test('SPAM <= 10% of HONEST wins/min after the fix; HONEST unchanged +-5%', () => {
  const honestBefore = measure('honest', false);
  const honestAfter = measure('honest', true);
  const spamBefore = measure('spam', false);
  const spamAfter = measure('spam', true);
  const table = {
    honestBefore: Math.round(honestBefore.winsPerMin),
    honestAfter: Math.round(honestAfter.winsPerMin),
    spamBefore: Math.round(spamBefore.winsPerMin),
    spamAfter: Math.round(spamAfter.winsPerMin),
    spamBeforeShare: +(spamBefore.winsPerMin / honestBefore.winsPerMin).toFixed(3),
    spamAfterShare: +(spamAfter.winsPerMin / honestAfter.winsPerMin).toFixed(3),
    spamAfterMinutesPerRun: +(spamAfter.minutes / 40).toFixed(2),
    spamBeforeMinutesPerRun: +(spamBefore.minutes / 40).toFixed(2),
  };
  console.log('SAT SPAM ECONOMY', JSON.stringify(table));
  assert.ok(spamBefore.winsPerMin > honestBefore.winsPerMin * 0.5, 'the exploit was real before (spam paid well)');
  assert.ok(spamAfter.winsPerMin <= honestAfter.winsPerMin * 0.1, `spam ${table.spamAfterShare} of honest`);
  assert.ok(Math.abs(honestAfter.winsPerMin / honestBefore.winsPerMin - 1) <= 0.05, 'honest within 5%');
});
