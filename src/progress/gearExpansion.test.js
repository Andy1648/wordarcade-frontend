// gearExpansion.test.js — GEAR EXPANSION (Andy oct21 "more really cool gear … we need to make more"): 15 new gears,
// the first EPIC perks, three conditional LEGENDARY mains (6+ letter words / a win streak / game-word XP) and nine new
// perks. Each perk pays exactly what its card line says, only while its gear is the worn MAIN.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_MARKS, freshState, oneInX, statText, mainTag, perkLine, indexMult, collection, critTotals, markWinsMult,
  markLongWinsPct, markGameXpPct, INDEX_BONUS_PER_PCT, ROLL_STATE_KEY, LONG_WORD_LETTERS,
} from './markRolls.js';
import { MARKS_EQUIPPED_KEY } from './marks.js';
import {
  PERKS, MARK_PERKS, activePerks, wordPerkMult, letterPerkMult, earlyBirdMult, comboKeys, noteRebirthPerks, hasMarkPerk,
  MARK2_STORE_KEY, AFTERPARTY_MIN, FORTUNE_MULT, TRIPLE_MULT, BIG_WORDS_MULT, BIG_WORDS_LETTERS,
} from './markPerks.js';
import { MARK2_KEY } from './v3/store.js';
import { critKeyAt } from './crit.js';
import { overdriveRemaining, OVERDRIVE_KEY } from './overdrive.js';
import { GEMS_KEY } from './gemsCore.js';

const NEW = ['mk-highlighter', 'mk-flashcards', 'mk-firecracker', 'mk-gumball', 'mk-lavalamp', 'mk-alarmclock', 'mk-fortune',
  'mk-hoarder', 'mk-domino', 'mk-longshot', 'mk-hothand', 'mk-arcadestick', 'mk-firebird', 'mk-trident', 'mk-paradox'];

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
const owning = (...ids) => ({ ...freshState(), marks: Object.fromEntries(ids.map((id) => [id, { n: 1 }])) });
const wear = (id, extra = {}) => ({ [ROLL_STATE_KEY]: JSON.stringify(owning(id, ...(extra.own || []))), [MARKS_EQUIPPED_KEY]: id, ...(extra.store || {}) });
const at = (h) => new Date(2026, 9, 21, h, 30).getTime(); // a LOCAL clock hour

test('the 15 new gears are in the pool, painted, each with its own line; the tier odds split, never move', () => {
  for (const id of NEW) {
    const m = ROLL_MARKS.find((x) => x.id === id);
    assert.ok(m, id);
    assert.ok(mainTag(id, null), `${id} prints a main`);
    if (['epic', 'legendary', 'mythic', 'secret'].includes(m.tier)) assert.ok(perkLine(id), `${id} prints its perk`);
  }
  assert.equal(oneInX('mk-domino'), 720);
  assert.equal(oneInX('mk-longshot'), 1200);
  assert.equal(oneInX('mk-trident'), 12000);
  assert.equal(oneInX('mk-paradox'), 30000);
  assert.equal(MARK2_STORE_KEY, MARK2_KEY, 'TWIN SOULS reads the real 2nd-slot key');
  for (const ps of Object.values(MARK_PERKS)) for (const p of ps) assert.ok(PERKS[p] && PERKS[p].line.length <= 40, p);
});

test('the conditional mains print what they touch', () => {
  assert.equal(statText({ kind: 'longWinsPct', value: 400 }), `+400% WINS ON ${LONG_WORD_LETTERS}+ LETTER WORDS`);
  assert.equal(statText({ kind: 'streakWinsPct', value: 300 }), '+300% WINS ON A WIN STREAK');
  assert.equal(statText({ kind: 'gameXpPct', value: 400 }), '+400% XP FROM GAME WORDS');
});

test('LONGSHOT / ARCADE STICK: their stat reaches its reader only while worn', () => {
  withStorage(wear('mk-longshot'), () => {
    near(markLongWinsPct(), ROLL_MARKS.find((m) => m.id === 'mk-longshot').stat.value, 'LONGSHOT long-word %');
    near(markGameXpPct(), 0, 'no game XP');
  });
  withStorage(wear('mk-arcadestick'), () => {
    near(markGameXpPct(), ROLL_MARKS.find((m) => m.id === 'mk-arcadestick').stat.value, 'ARCADE STICK game XP %');
    near(markLongWinsPct(), 0, 'no long-word wins');
  });
});

test('HOT HAND pays WINS only while the save is on a win streak', () => {
  const v = ROLL_MARKS.find((m) => m.id === 'mk-hothand').stat.value;
  withStorage(wear('mk-hothand', { store: { [GEMS_KEY]: JSON.stringify({ v: 1, bal: 0, peak: 1, streak: 0, mig: 1 }) } }), (map) => {
    const s = owning('mk-hothand');
    near(markWinsMult({ state: s }) / indexMult(s), 1, 'no streak');
    map.set(GEMS_KEY, JSON.stringify({ v: 1, bal: 0, peak: 1, streak: 2, mig: 1 }));
    near(markWinsMult({ state: s }) / indexMult(s), 1 + v / 100, 'on a streak');
  });
});

test('per-word perks: TRIPLE THREAT counts each released word, FORTUNE draws per word, BIG WORDS, NIGHT OWL by the clock', () => {
  const p = (...ids) => new Set(ids);
  near(wordPerkMult({ released: 1, nowWords: 3, perks: p('tripleThreat') }), TRIPLE_MULT, 'the 3rd word');
  near(wordPerkMult({ released: 1, nowWords: 4, perks: p('tripleThreat') }), 1, 'the 4th word');
  near(wordPerkMult({ released: 3, nowWords: 3, perks: p('tripleThreat') }), (3 + TRIPLE_MULT - 1) / 3, 'the gate releases 1–3: only the 3rd is ×3');
  near(wordPerkMult({ released: 1, perks: p('fortune'), rng: () => 0 }), FORTUNE_MULT, 'a fortune hit');
  near(wordPerkMult({ released: 1, perks: p('fortune'), rng: () => 0.5 }), 1, 'a miss');
  near(wordPerkMult({ wordLength: BIG_WORDS_LETTERS, perks: p('bigWords') }), BIG_WORDS_MULT, 'a 10-letter word');
  near(wordPerkMult({ wordLength: BIG_WORDS_LETTERS - 1, perks: p('bigWords') }), 1, 'a 9-letter word');
  near(wordPerkMult({ now: at(23), perks: p('nightOwl') }), 2, '11 PM');
  near(wordPerkMult({ now: at(3), perks: p('nightOwl') }), 2, '3 AM (wraps midnight)');
  near(wordPerkMult({ now: at(12), perks: p('nightOwl') }), 1, 'noon');
  near(wordPerkMult({ perks: p() }), 1, 'no perk');
});

test('EARLY BIRD: ×2 XP per key from 6 to 10 AM, only while the ALARM CLOCK is worn', () => {
  withStorage(wear('mk-alarmclock'), () => {
    near(earlyBirdMult(at(7)), 2, '7 AM');
    near(earlyBirdMult(at(10)), 1, '10 AM');
    assert.ok([1, 2].includes(letterPerkMult()), 'the live key rate carries it');
  });
  withStorage(wear('mk-lavalamp'), () => near(earlyBirdMult(at(7)), 1, 'not worn'));
});

test('HOARD: MAGPIE triples the INDEX bonus', () => {
  const s = owning('mk-hoarder', 'mk-smith', 'mk-nova');
  const pct = collection(s).pct;
  withStorage(wear('mk-hoarder', { own: ['mk-smith', 'mk-nova'] }), () => near(indexMult(s), 1 + INDEX_BONUS_PER_PCT * pct * 3, 'worn'));
  withStorage(wear('mk-smith', { own: ['mk-hoarder', 'mk-nova'] }), () => near(indexMult(s), 1 + INDEX_BONUS_PER_PCT * pct, 'not worn'));
});

test('COMBO: DOMINO makes a crit drag the next 2 keys; critKeyAt honours the owed keys', () => {
  withStorage(wear('mk-domino'), () => {
    assert.equal(comboKeys(), 2);
    assert.equal(critTotals().combo, 2);
  });
  withStorage(wear('mk-smith'), () => assert.equal(critTotals().combo, undefined));
  const never = () => 0.99;
  assert.equal(critKeyAt(1, 10, { rate: 0, power: 3 }, never, 2).gain, 30, 'an owed combo key crits');
  assert.equal(critKeyAt(1, 10, { rate: 0, power: 3 }, never, 0).gain, 10, 'none owed');
});

test('AFTERPARTY: a rebirth starts a 5-minute OVERDRIVE while FIREBIRD is worn', () => {
  withStorage(wear('mk-firebird'), (map) => {
    map.delete(OVERDRIVE_KEY);
    assert.equal(noteRebirthPerks(), true);
    const left = overdriveRemaining();
    assert.ok(left > (AFTERPARTY_MIN * 60000) - 5000 && left <= AFTERPARTY_MIN * 60000, `${left} ms`);
  });
  withStorage(wear('mk-hydra'), (map) => {
    map.delete(OVERDRIVE_KEY);
    assert.equal(noteRebirthPerks(), false);
    assert.equal(overdriveRemaining(), 0);
  });
});

test('TWIN SOULS: PARADOX turns the 2nd slot gear\'s perks on; without it the 2nd slot never carries perks', () => {
  withStorage(wear('mk-paradox', { own: ['mk-leviathan'], store: { [MARK2_STORE_KEY]: 'mk-leviathan' } }), () => {
    assert.ok(hasMarkPerk('twinSouls') && hasMarkPerk('letters2') && hasMarkPerk('freeOd'), [...activePerks()].join());
  });
  withStorage(wear('mk-eclipse', { own: ['mk-leviathan'], store: { [MARK2_STORE_KEY]: 'mk-leviathan' } }), () => {
    assert.ok(hasMarkPerk('winner2') && !hasMarkPerk('letters2'));
  });
  withStorage(wear('mk-paradox', { store: { [MARK2_STORE_KEY]: 'mk-leviathan' } }), () => {
    assert.ok(!hasMarkPerk('letters2'), 'a 2nd gear the save does not own carries nothing');
  });
});
