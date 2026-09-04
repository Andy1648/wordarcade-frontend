// scripts/clean-accept-artifacts.mjs
// Strips MALFORMED-inflection artifacts from the ACCEPTANCE-ONLY extension asset
// (src/solo/words.accept-ext.txt). Acceptance-only: this asset validates human input
// and is NEVER used for generation/display (generation = words.recall.txt / fragment
// pools / top-3000 / reveal words — untouched, see build-accept-ext.mjs).
//
// WHY: the audit in claude/dict-quality.md (chore/dict-quality) found ~5% of the obscure
// tail is malformed — the accept-ext list is the raw atebits `word-list` dictionary minus
// the frequency-attested union, so it carries that dictionary's productive OVER-GENERATIONS:
// over-pluralised abstract nouns (fattinesses, genericnesses, invectivenesses) and a few
// broken inflections (petroglyphies, electorially, unperverts). The bot can play these and
// the game ACCEPTS words a human would call wrong.
//
// RULES (deliberately conservative — must NEVER remove a real word):
//   R1  -nesses OVER-PLURALS. A word ending "nesses" is the plural of a "-ness" abstract
//       noun; such abstract/mass nouns do not standardly pluralise. Flag ONLY when BOTH the
//       plural AND its "-ness" singular (word[:-2]) live in this obscure ext tail — i.e. the
//       base -ness noun is itself ultra-rare and word-list-derived. This never touches any
//       -ness noun attested in the frequency corpus (recall/accept): witnesses, businesses,
//       kindnesses, darknesses, happinesses, wickednesses, forgivenesses, etc. all survive
//       (their singular is in recall/accept, not ext). The base -ness singular is KEPT; only
//       the over-plural is dropped.
//   R2  Named broken inflections from the audit that no safe general rule catches:
//       petroglyphies (plural is petroglyphs), electorially (misspelling of electorally),
//       unperverts (impossible verb form). (The audit's `milages` is an attested variant of
//       mileages and `submetacentrics` is a real cytogenetics term — both deliberately KEPT.)
//
// NOT applied: a general "-ies broken plural" rule — every conservative form still caught
// real words (congeries, sanies, bloodies, pirogies, darbies, noughties, sodomies), so it
// is unsafe by the "never remove a real word" bar and is intentionally omitted.
//
// Run:  node scripts/clean-accept-artifacts.mjs
// Rewrites the committed src/solo/words.accept-ext.txt and prints the counts.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOLO = join(ROOT, 'src', 'solo');

const recall = readFileSync(join(SOLO, 'words.recall.txt'), 'utf8').split(' ').filter(Boolean);
const accept = readFileSync(join(SOLO, 'words.accept.txt'), 'utf8').split(' ').filter(Boolean);
const ext = readFileSync(join(SOLO, 'words.accept-ext.txt'), 'utf8').split(' ').filter(Boolean);

const extSet = new Set(ext);

// R1 — -nesses over-plural of an obscure (ext-tier) -ness abstract noun.
const remove = new Set();
for (const w of ext) {
  if (w.endsWith('nesses') && w.length >= 8 && extSet.has(w.slice(0, -2))) remove.add(w);
}

// R2 — audit-named broken inflections (only removed if actually present in ext).
for (const w of ['petroglyphies', 'electorially', 'unperverts']) {
  if (extSet.has(w)) remove.add(w);
}

const kept = ext.filter((w) => !remove.has(w));
writeFileSync(join(SOLO, 'words.accept-ext.txt'), kept.join(' '));

// Report.
const merged = new Set(recall);
for (const w of accept) merged.add(w);
for (const w of kept) merged.add(w);
console.log(`removed:            ${remove.size}`);
console.log(`  R1 (-nesses):     ${[...remove].filter((w) => w.endsWith('nesses')).length}`);
console.log(`  R2 (named):       ${[...remove].filter((w) => !w.endsWith('nesses')).length}`);
console.log(`ext:  ${ext.length} -> ${kept.length}  (floor 150000)`);
console.log(`merged accept:      ${merged.size}  (floor 260000)`);
console.log(`examples: ${[...remove].slice(0, 12).join(', ')}`);
