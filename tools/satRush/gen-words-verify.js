// gen-words-verify.js  — STAGE 2 of the SAT Rush word pipeline.
//
// The gate. Every rule in src/satRush/wordSchema.test.js is re-implemented here
// VERBATIM (same helpers, same sliding-5 window) plus extra sanity checks, and
// it validates each candidate against the MERGED world (existing words.json +
// the rest of the batch) so a row that passes here cannot break the contract
// test once convert merges it.
//
// HARD failures -> gen-words-exclude.json (with a reason), so reruns skip them.
// SOFT warnings (inferability / tier-fit / dictionary-shape) are reported but
// do NOT drop a row — they're a spot-check aid.
// Alts are NORMALISED (not failed): non-same-length / headword-colliding /
// duplicate / self alts are dropped so the slot invariant always holds, and the
// drop is reported.
//
// Passing rows (with cleaned alts) -> .scratch/passing.json for convert.
//
// Flags:
//   --reset   rebuild gen-words-exclude.json from scratch (re-check everything,
//             including words excluded on a previous run — use after fixing rows)
//
// Run:  node tools/satRush/gen-words-verify.js [--reset]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH = join(HERE, '.scratch');
const EXCLUDE_PATH = join(HERE, 'gen-words-exclude.json');
const WORDS_PATH = join(HERE, '..', '..', 'src', 'data', 'satRush', 'words.json');
const RESET = process.argv.includes('--reset');

// ---- contract helpers, copied EXACTLY from wordSchema.test.js -------------
const POS = new Set(['adj', 'n', 'v', 'adv']);
const lower = (s) => String(s).toLowerCase();
const blankRuns = (s) => String(s).match(/_+/g) || [];
const substrings5 = (w) => {
  const x = lower(w);
  const out = [];
  for (let i = 0; i + 5 <= x.length; i++) out.push(x.slice(i, i + 5));
  return out;
};

// ---- load inputs -----------------------------------------------------------
const candidates = JSON.parse(readFileSync(join(SCRATCH, 'candidates.json'), 'utf8'));
const existing = JSON.parse(readFileSync(WORDS_PATH, 'utf8'));

let exclude = [];
if (!RESET && existsSync(EXCLUDE_PATH)) {
  exclude = JSON.parse(readFileSync(EXCLUDE_PATH, 'utf8'));
}
const excludedWords = new Set(exclude.map((e) => lower(e.word)));

// Headwords that already exist in the shipped file (case-insensitive).
const existingWords = new Set(existing.map((r) => lower(r.word)));
const existingSentences = new Map();
existing.forEach((r, i) => existingSentences.set(lower(r.context).trim(), `words.json #${i} "${r.word}"`));

// A real English word, roughly. We have no offline dictionary, so this is a
// TYPO / shape guard, not a lexicon: letters only, sane length, has a vowel,
// no run of 3 identical letters. Genuine "is this a word" quality is covered by
// authoring + the quality spot-check, which this flags but never blocks.
const looksLikeWord = (w) => {
  const x = lower(w);
  if (!/^[a-z]+$/.test(x)) return 'non-letter chars';
  if (x.length < 3 || x.length > 18) return `implausible length ${x.length}`;
  if (!/[aeiouy]/.test(x)) return 'no vowel';
  if (/(.)\1\1/.test(x)) return 'triple letter run';
  return null;
};

// Loose tier-fit heuristic: rarity tracks length only very roughly, but a
// tier-5 four-letter word or a tier-1 fifteen-letter word is worth a second
// look. Soft flag only.
const tierFitWarning = (r) => {
  const L = r.word.length;
  if (r.tier <= 2 && L >= 14) return `tier ${r.tier} but ${L} letters (long for an early word)`;
  if (r.tier >= 5 && L <= 5) return `tier ${r.tier} but only ${L} letters (short for a deep cut)`;
  if (r.tier >= 4 && L <= 4) return `tier ${r.tier} but only ${L} letters`;
  return null;
};

// ---- validate --------------------------------------------------------------
const passing = [];
const failures = []; // { word, tier, reasons:[] }
const warnings = []; // { word, tier, notes:[] }
const altDrops = []; // { word, dropped:[{alt,why}] }

// Build the full set of headwords that WILL exist after merge (existing + every
// non-excluded candidate), so the "alt is a headword" check sees the whole world.
const mergedHeadwords = new Set(existingWords);
for (const c of candidates) {
  if (!excludedWords.has(lower(c.word))) mergedHeadwords.add(lower(c.word));
}

// Track sentences/words seen among candidates for intra-batch collision checks.
const candWordFirst = new Map();
const candSentenceFirst = new Map();

for (const r of candidates) {
  const w = lower(r.word);
  if (excludedWords.has(w)) continue; // stays excluded until --reset

  const reasons = [];
  const notes = [];

  // --- structural (mirrors "every row is structurally well-formed") ---
  if (typeof r.word !== 'string' || !r.word.length) reasons.push('missing word');
  if (!POS.has(r.pos)) reasons.push(`bad pos ${JSON.stringify(r.pos)}`);
  if (!Number.isInteger(r.tier) || r.tier < 1 || r.tier > 5) reasons.push(`bad tier ${JSON.stringify(r.tier)}`);
  if (typeof r.gloss !== 'string' || !r.gloss.trim()) reasons.push('missing gloss');
  if (typeof r.context !== 'string' || !r.context.trim()) reasons.push('missing context');
  if (!Array.isArray(r.alts)) reasons.push('alts is not an array');
  if (!(r.root === null || (r.root && typeof r.root === 'object'))) reasons.push('root must be null or an object');

  // --- exactly one blank ---
  const runs = blankRuns(r.context);
  if (runs.length !== 1) reasons.push(`${runs.length} blanks (need exactly 1)`);

  // --- no 5-char leak into context or gloss (sliding window) ---
  if (typeof r.context === 'string' && typeof r.gloss === 'string') {
    const ctx = lower(r.context);
    const gloss = lower(r.gloss);
    for (const run of substrings5(r.word)) {
      if (ctx.includes(run)) reasons.push(`run "${run}" leaks into context`);
      if (gloss.includes(run)) reasons.push(`run "${run}" leaks into gloss`);
    }
  }

  // --- root: null, or morpheme+meaning + 2-4 cousins, none in context ---
  if (r.root && typeof r.root === 'object') {
    const { morpheme, meaning, cousins } = r.root;
    if (typeof morpheme !== 'string' || !morpheme.trim()) reasons.push('root missing morpheme');
    if (typeof meaning !== 'string' || !meaning.trim()) reasons.push('root missing meaning');
    if (!Array.isArray(cousins) || cousins.length < 2 || cousins.length > 4) {
      reasons.push(`${Array.isArray(cousins) ? cousins.length : 'no'} cousins (need 2-4)`);
    } else {
      const ctx = lower(r.context || '');
      for (const c of cousins) if (ctx.includes(lower(c))) reasons.push(`cousin "${c}" appears in context`);
    }
  }

  // --- duplicate word (vs existing + earlier candidate) ---
  if (existingWords.has(w)) reasons.push('duplicate word (already in words.json)');
  if (candWordFirst.has(w)) reasons.push(`duplicate word (also candidate "${candWordFirst.get(w)}")`);
  else candWordFirst.set(w, r.word);

  // --- duplicate sentence (vs existing + earlier candidate) ---
  const sKey = lower(r.context || '').trim();
  if (sKey) {
    if (existingSentences.has(sKey)) reasons.push(`duplicate sentence (also ${existingSentences.get(sKey)})`);
    if (candSentenceFirst.has(sKey)) reasons.push(`duplicate sentence (also candidate "${candSentenceFirst.get(sKey)}")`);
    else candSentenceFirst.set(sKey, r.word);
  }

  // --- dictionary / shape sanity (hard for the word itself) ---
  const shape = looksLikeWord(r.word);
  if (shape) reasons.push(`word fails shape check: ${shape}`);

  // If any HARD rule tripped, exclude the whole row.
  if (reasons.length) {
    failures.push({ word: r.word, tier: r.tier, reasons });
    continue;
  }

  // --- normalise alts (never a row failure; clean + report drops) ---
  const cleanAlts = [];
  const dropped = [];
  for (const a of r.alts) {
    const al = lower(a);
    if (String(a).length !== r.word.length) dropped.push({ alt: a, why: `len ${String(a).length} != ${r.word.length}` });
    else if (al === w) dropped.push({ alt: a, why: 'equals the word' });
    else if (mergedHeadwords.has(al)) dropped.push({ alt: a, why: 'is itself a headword' });
    else if (cleanAlts.some((x) => lower(x) === al)) dropped.push({ alt: a, why: 'duplicate alt' });
    else cleanAlts.push(a);
  }
  if (dropped.length) altDrops.push({ word: r.word, dropped });

  // --- soft warnings (spot-check aids) ---
  const shapeNote = null; // word already passed shape
  const tf = tierFitWarning(r);
  if (tf) notes.push(tf);
  // inferability: enough context words around the blank to guess from?
  const ctxWords = (r.context || '').split(/\s+/).filter(Boolean).length;
  if (ctxWords < 9) notes.push(`thin context (${ctxWords} words) — check the blank is inferable`);
  if (shapeNote) notes.push(shapeNote);
  if (notes.length) warnings.push({ word: r.word, tier: r.tier, notes });

  passing.push({ ...r, alts: cleanAlts });
}

// ---- persist exclude list --------------------------------------------------
// Merge new failures into the exclude set (keyed by word, latest reason wins).
const excludeMap = new Map(exclude.map((e) => [lower(e.word), e]));
for (const f of failures) {
  excludeMap.set(lower(f.word), { word: f.word, tier: f.tier, reason: f.reasons.join('; ') });
}
const nextExclude = [...excludeMap.values()].sort((a, b) => lower(a.word).localeCompare(lower(b.word)));
writeFileSync(EXCLUDE_PATH, JSON.stringify(nextExclude, null, 2) + '\n');

// ---- write passing + report ------------------------------------------------
passing.sort((a, b) => a.tier - b.tier || lower(a.word).localeCompare(lower(b.word)));
writeFileSync(join(SCRATCH, 'passing.json'), JSON.stringify(passing, null, 2) + '\n');
writeFileSync(join(SCRATCH, 'failures.json'), JSON.stringify(failures, null, 2) + '\n');
writeFileSync(join(SCRATCH, 'warnings.json'), JSON.stringify(warnings, null, 2) + '\n');

const byTier = {};
for (const r of passing) byTier[r.tier] = (byTier[r.tier] || 0) + 1;
// projected merged totals
const mergedByTier = {};
for (const r of existing) mergedByTier[r.tier] = (mergedByTier[r.tier] || 0) + 1;
for (const r of passing) mergedByTier[r.tier] = (mergedByTier[r.tier] || 0) + 1;

console.log(`gen-words-verify${RESET ? ' (--reset)' : ''}:`);
console.log(`  candidates in: ${candidates.length}   excluded (skipped): ${candidates.length - passing.length - failures.length}`);
console.log(`  PASS: ${passing.length}   FAIL: ${failures.length}   warnings: ${warnings.length}   alt-drops: ${altDrops.length}`);
console.log('  passing per tier:', JSON.stringify(byTier));
console.log('  projected words.json per tier:', JSON.stringify(mergedByTier), 'total', existing.length + passing.length);

if (failures.length) {
  console.log('\n  --- HARD FAILURES (excluded) ---');
  for (const f of failures) console.log(`  [t${f.tier}] ${f.word}: ${f.reasons.join('; ')}`);
}
if (altDrops.length) {
  console.log('\n  --- ALT DROPS (row still passes) ---');
  for (const d of altDrops) console.log(`  ${d.word}: ${d.dropped.map((x) => `"${x.alt}" (${x.why})`).join(', ')}`);
}
if (warnings.length) {
  console.log(`\n  --- SOFT WARNINGS (${warnings.length}, review not required) ---`);
  for (const wn of warnings) console.log(`  [t${wn.tier}] ${wn.word}: ${wn.notes.join('; ')}`);
}
console.log('');
