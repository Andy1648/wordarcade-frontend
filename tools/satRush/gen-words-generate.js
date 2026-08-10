// gen-words-generate.js  — STAGE 1 of the SAT Rush word pipeline.
//
// Mirrors the gen9 Category Blitz shape: generate -> verify -> convert, with a
// persistent exclude list. This stage does NOT judge content. It only:
//   - pulls the authored candidate rows (tools/satRush/candidates/*.js),
//   - normalises whitespace on the string fields,
//   - stably orders them (tier asc, then word asc, case-insensitive),
//   - flags duplicate words WITHIN the candidate batch (first wins),
//   - emits the batch to .scratch/candidates.json for the verify stage.
//
// DEV TOOLING ONLY. Nothing here is imported by src/ — it never ships.
// Run:  node tools/satRush/gen-words-generate.js
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH = join(HERE, '.scratch');
const CAND_DIR = join(HERE, 'candidates');
mkdirSync(SCRATCH, { recursive: true });

// Each candidates/*.json file is an array of authored rows (one file per tier
// batch). Concatenate them all.
const CANDIDATES = readdirSync(CAND_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(join(CAND_DIR, f), 'utf8')));

const lower = (s) => String(s).toLowerCase();
const trim = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : s);

// Normalise the string fields (collapse stray whitespace) without touching
// structure. Leave arrays/objects as authored; verify does the heavy checking.
const normalise = (r) => ({
  word: trim(r.word),
  pos: r.pos,
  tier: r.tier,
  gloss: trim(r.gloss),
  context: trim(r.context),
  root:
    r.root == null
      ? null
      : {
          morpheme: trim(r.root.morpheme),
          meaning: trim(r.root.meaning),
          cousins: Array.isArray(r.root.cousins) ? r.root.cousins.map(trim) : r.root.cousins,
        },
  alts: Array.isArray(r.alts) ? r.alts.map(trim) : r.alts,
});

const rows = CANDIDATES.map(normalise);

// First-wins de-dup within the batch (a hard dup would fail verify anyway; we
// drop it here so the scratch file is clean and the count is honest).
const seen = new Map();
const kept = [];
const dupes = [];
for (const r of rows) {
  const key = lower(r.word);
  if (seen.has(key)) {
    dupes.push(r.word);
    continue;
  }
  seen.set(key, true);
  kept.push(r);
}

// Stable order: tier asc, then word asc (case-insensitive).
kept.sort((a, b) => a.tier - b.tier || lower(a.word).localeCompare(lower(b.word)));

writeFileSync(join(SCRATCH, 'candidates.json'), JSON.stringify(kept, null, 2) + '\n');

const byTier = {};
for (const r of kept) byTier[r.tier] = (byTier[r.tier] || 0) + 1;

console.log(`gen-words-generate: emitted ${kept.length} candidate rows -> .scratch/candidates.json`);
console.log('  per tier:', JSON.stringify(byTier));
if (dupes.length) console.log(`  dropped ${dupes.length} intra-batch duplicate word(s): ${dupes.join(', ')}`);
