// wordSchema.test.js
// THE CONTRACT for the SAT Rush word list. Every future word batch must
// pass this file unchanged — it encodes the assumptions the mode is built on
// (most load-bearing: every alt is the SAME LENGTH as its word, because the
// fixed letter slots are the only thing that can reject a same-length synonym).
//
// Node's built-in runner, invoked by `npm test` (node --test "src/**/*.test.js").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WORDS = JSON.parse(
  readFileSync(new URL('../data/satRush/words.json', import.meta.url), 'utf8')
);

const POS = new Set(['adj', 'n', 'v', 'adv']);
const lower = (s) => String(s).toLowerCase();
const blankRuns = (s) => String(s).match(/_+/g) || [];
// EVERY length-5 substring of the word (a sliding window across the whole word,
// not just the prefix) — so a leak is caught wherever the shared run sits:
// prefix, interior, or suffix. This is what catches e.g. a "biography" in the
// context of "hagiography" via the shared interior/suffix run "graph"/"raphy",
// which a prefix-only stem check would miss. Empty for words < 5 chars, which
// therefore cannot share a 5-char run by definition.
const substrings5 = (w) => {
  const x = lower(w);
  const out = [];
  for (let i = 0; i + 5 <= x.length; i++) out.push(x.slice(i, i + 5));
  return out;
};
// A stable "row N (word)" label so a failure points at the exact offender.
const at = (i) => `#${i} "${WORDS[i].word}"`;

test('every row is structurally well-formed', () => {
  const bad = [];
  WORDS.forEach((r, i) => {
    if (typeof r.word !== 'string' || !r.word.length) bad.push(`${at(i)}: missing word`);
    if (!POS.has(r.pos)) bad.push(`${at(i)}: bad pos ${JSON.stringify(r.pos)}`);
    if (!Number.isInteger(r.tier) || r.tier < 1 || r.tier > 5)
      bad.push(`${at(i)}: bad tier ${JSON.stringify(r.tier)}`);
    if (typeof r.gloss !== 'string' || !r.gloss.trim()) bad.push(`${at(i)}: missing gloss`);
    if (typeof r.context !== 'string' || !r.context.trim()) bad.push(`${at(i)}: missing context`);
    if (!Array.isArray(r.alts)) bad.push(`${at(i)}: alts is not an array`);
    if (!(r.root === null || (r.root && typeof r.root === 'object')))
      bad.push(`${at(i)}: root must be null or an object`);
  });
  assert.deepEqual(bad, [], `malformed rows:\n${bad.join('\n')}`);
});

test('context has exactly one blank (___)', () => {
  const bad = [];
  WORDS.forEach((r, i) => {
    const runs = blankRuns(r.context);
    if (runs.length !== 1) bad.push(`${at(i)}: ${runs.length} blanks`);
  });
  assert.deepEqual(bad, [], `blank-count violations:\n${bad.join('\n')}`);
});

test('context and gloss do not leak the word (no shared 5-char substring, anywhere)', () => {
  const bad = [];
  WORDS.forEach((r, i) => {
    const ctx = lower(r.context);
    const gloss = lower(r.gloss);
    for (const run of substrings5(r.word)) {
      if (ctx.includes(run)) bad.push(`${at(i)}: run "${run}" leaks into context`);
      if (gloss.includes(run)) bad.push(`${at(i)}: run "${run}" leaks into gloss`);
    }
  });
  assert.deepEqual(bad, [], `word-leak violations:\n${bad.join('\n')}`);
});

test('root is null, or has 2-4 cousins (with morpheme+meaning) none appearing in the context', () => {
  const bad = [];
  WORDS.forEach((r, i) => {
    if (r.root === null) return;
    const { morpheme, meaning, cousins } = r.root;
    if (typeof morpheme !== 'string' || !morpheme.trim())
      bad.push(`${at(i)}: root missing morpheme`);
    if (typeof meaning !== 'string' || !meaning.trim())
      bad.push(`${at(i)}: root missing meaning`);
    if (!Array.isArray(cousins) || cousins.length < 2 || cousins.length > 4) {
      bad.push(`${at(i)}: ${Array.isArray(cousins) ? cousins.length : 'no'} cousins (need 2-4)`);
      return;
    }
    const ctx = lower(r.context);
    for (const c of cousins) {
      if (ctx.includes(lower(c))) bad.push(`${at(i)}: cousin "${c}" appears in context`);
    }
  });
  assert.deepEqual(bad, [], `root violations:\n${bad.join('\n')}`);
});

test('every alt is the same length as its word (the slot invariant)', () => {
  const bad = [];
  WORDS.forEach((r, i) => {
    for (const a of r.alts) {
      if (String(a).length !== r.word.length)
        bad.push(`${at(i)}: alt "${a}" (${String(a).length}) != word length ${r.word.length}`);
    }
  });
  assert.deepEqual(bad, [], `same-length-alt violations:\n${bad.join('\n')}`);
});

test('no alt is itself a headword', () => {
  const headwords = new Set(WORDS.map((r) => lower(r.word)));
  const bad = [];
  WORDS.forEach((r, i) => {
    for (const a of r.alts) {
      if (headwords.has(lower(a))) bad.push(`${at(i)}: alt "${a}" is itself a headword`);
    }
  });
  assert.deepEqual(bad, [], `alt-is-headword violations:\n${bad.join('\n')}`);
});

test('no duplicate words', () => {
  const seen = new Map();
  const bad = [];
  WORDS.forEach((r, i) => {
    const w = lower(r.word);
    if (seen.has(w)) bad.push(`${at(i)}: duplicate word (also ${at(seen.get(w))})`);
    else seen.set(w, i);
  });
  assert.deepEqual(bad, [], `duplicate words:\n${bad.join('\n')}`);
});

test('no duplicate sentences', () => {
  const seen = new Map();
  const bad = [];
  WORDS.forEach((r, i) => {
    const s = lower(r.context).trim();
    if (seen.has(s)) bad.push(`${at(i)}: duplicate sentence (also ${at(seen.get(s))})`);
    else seen.set(s, i);
  });
  assert.deepEqual(bad, [], `duplicate sentences:\n${bad.join('\n')}`);
});
