// node --test — the ACCEPTANCE EXTENSION (fix/solo-dict): the ~182k-word extension closes
// the "real word rejected as NOT IN OUR WORD LIST" gap, and — critically — HEAT still defeats
// the CHAIN memorised s→s bank exploit against the much deeper sink the bigger list creates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChainEngine } from './chain.js';
import { mulberry32 } from './shared.js';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const recall = read('./words.recall.txt').split(' ');
const union = new Set(recall); // the CURRENT shipped accept set (RECALL ∪ words.accept.txt)
for (const w of read('./words.accept.txt').split(' ')) union.add(w);
const ext = read('./words.accept-ext.txt').split(' ').filter(Boolean);
const merged = new Set(union); // accept set AFTER the extension merges in
for (const w of ext) merged.add(w);
const topCommon = recall.slice(0, 3000);

test('the extension is a real INCREMENT — every ext word is new (not already accepted)', () => {
  assert.ok(ext.length > 150000, `ext only ${ext.length} words`);
  for (let i = 0; i < ext.length; i += 997) {
    assert.equal(union.has(ext[i]), false, `${ext[i]} was already in the union`);
    assert.ok(/^[a-z]{3,15}$/.test(ext[i]), `${ext[i]} not a 3-15 a-z word`);
  }
  assert.ok(merged.size > 260000, `merged accept only ${merged.size}`);
});

test('generation dict is UNTOUCHED (recall still ~31.5k, frequency-ordered)', () => {
  assert.ok(recall.length >= 31000 && recall.length <= 32000, `recall ${recall.length}`);
});

test('a formerly-rejected real word validates once the extension is merged', () => {
  // Pick a real ext word starting with a CHAIN opener so validate reaches the membership
  // check (not BAD_START). It must be rejected by the OLD set and accepted by the merged one.
  const sample = ext.find((w) => 'abcdefghilmnoprstw'.includes(w[0]) && w.length >= 3);
  assert.ok(sample, 'no suitable sample ext word');
  const before = createChainEngine({ accept: union, topCommon, rng: mulberry32(1) });
  before.state.requiredLetter = sample[0];
  assert.equal(before.validate(sample), 'not_in_list'); // real word, wrongly rejected today
  const after = createChainEngine({ accept: merged, topCommon, rng: mulberry32(1) });
  after.state.requiredLetter = sample[0];
  assert.equal(after.validate(sample), null); // now accepted
});

// ---- HEAT vs the deeper s→s sink -----------------------------------------------------
// Replicates chain.test.js runBot(endOnS=true): a full-vocabulary bank bot answering the
// shortest unused word ending in 's', at a deterministic 1500 + 220·len ms. Heat is the
// only limiter. Run against the ENLARGED accept set.
function byFirst(words, sort) {
  const m = new Map();
  for (const w of words) {
    const c = w[0];
    let a = m.get(c);
    if (!a) m.set(c, (a = []));
    a.push(w);
  }
  if (sort) for (const a of m.values()) a.sort(sort);
  return m;
}
const endSByFirst = byFirst([...merged].filter((w) => w[w.length - 1] === 's'), (a, b) => a.length - b.length);
const BOT_REACT = 1500;
const BOT_PER_CHAR = 220;
function runBankBot(rng) {
  const eng = createChainEngine({ accept: merged, topCommon, rng });
  let links = 0;
  for (let g = 0; g < 20000; g++) {
    const bucket = endSByFirst.get(eng.state.requiredLetter) || [];
    const word = bucket.find((w) => !eng.state.used.has(w));
    if (!word) break;
    if (BOT_REACT + BOT_PER_CHAR * word.length > eng.currentTMax()) break;
    if (!eng.submit(word).ok) break;
    links += 1;
  }
  return links;
}

test('SIM: the memorised s→s bank exploit stays <= 25 links against the bigger list (heat holds)', () => {
  const sink = [...merged].filter((w) => w[0] === 's' && w[w.length - 1] === 's').length;
  assert.ok(sink > 8000, `s→s sink only ${sink} — expected the deeper (~12k) sink`);
  const rng = mulberry32(999); // same seed as the shipped guard
  let worst = 0;
  for (let i = 0; i < 500; i++) worst = Math.max(worst, runBankBot(rng));
  assert.ok(worst <= 25, `s→s bank bot reached ${worst} links (> 25 — heat broken by the bigger dict?)`);
});
