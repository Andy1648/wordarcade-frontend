# SAT Rush word pipeline (dev tooling — never shipped)

Repeatable `generate → verify → convert` pipeline for growing
`src/data/satRush/words.json`, mirroring the gen9 Category Blitz shape with a
persistent exclude list. Nothing here is imported by `src/`, so it stays out of
the bundle while living in the repo.

## The contract

`src/satRush/wordSchema.test.js` is the spec. It is load-bearing: a failing
schema test is a hard stop — fix the data, never the test. `gen-words-verify.js`
re-implements every rule in that file verbatim (same helpers, same sliding-5
window) and validates each candidate against the **merged** world (existing
`words.json` + the rest of the batch), so anything it passes cannot break the
contract test after `convert` merges it.

Row shape:

```json
{
  "word": "candid", "pos": "adj", "tier": 1,
  "gloss": "short plain-language definition",
  "context": "one vivid sentence with exactly one ___ blank",
  "root": { "morpheme": "cand-", "meaning": "to glow, be white", "cousins": ["candor", "candle"] },
  "alts": ["<same-length synonyms only>"]
}
```

Key invariants (see the test for the exact rules):
- `context` has **exactly one** blank, a run of underscores (`___`).
- No 5-char substring of `word` may appear in `context` or `gloss` (sliding
  window across the whole word — prefix, interior, or suffix).
- `root` is `null` or `{morpheme, meaning, cousins:[2–4]}`; no cousin may appear
  in `context`.
- Every `alt` is the **same length** as `word` (the game's slot invariant),
  is not itself a headword, and is not the word.
- No duplicate `word` and no duplicate `context` across the whole file.

## Files

- `candidates/*.json` — authored candidate rows, one file per tier batch. This
  is where new words are drafted.
- `gen-words-generate.js` — normalises whitespace, de-dupes within the batch,
  stably orders (tier asc, word asc), emits `.scratch/candidates.json`.
- `gen-words-verify.js` — the gate. Full contract rules + extras (word shape /
  typo guard, cross-file duplicate word & sentence, tier-fit and inferability
  soft flags). Hard failures → `gen-words-exclude.json` (with a reason).
  Alts are **normalised** (bad ones dropped, reported) rather than failing the
  row. Passing rows → `.scratch/passing.json`.
- `gen-words-convert.js` — merges `.scratch/passing.json` into `words.json`,
  sorted stably, with a belt-and-braces duplicate guard.
- `gen-words-exclude.json` — persistent skip list `[{word, tier, reason}]`. Rows
  here are not resurfaced on reruns.
- `.scratch/` — ephemeral intermediates (git-ignored).

## Run it

```bash
node tools/satRush/gen-words-generate.js
node tools/satRush/gen-words-verify.js        # writes failures into the exclude list
node tools/satRush/gen-words-convert.js
npm test                                       # wordSchema.test.js must stay green
npx vite build --logLevel error                # must exit 0
```

While iterating on a batch, re-run verify with `--reset` to rebuild the exclude
list from scratch (re-checks words that failed a previous run, e.g. after you
fix a leak):

```bash
node tools/satRush/gen-words-verify.js --reset
```

Only run `convert` once verify shows the batch clean (0 hard failures you still
care about). `convert` re-checks for duplicate words/sentences and aborts rather
than write a file that would fail the contract test.
