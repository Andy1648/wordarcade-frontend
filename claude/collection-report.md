# JOB 3 — THE WORD COLLECTION (feat/collection)

Rarity used to only multiply wins. Now every DISTINCT word you accept is permanently recorded with
its rarity tier, the first mode you found it in, and the first date — and accumulates into a
Collection with milestone payouts.

**Build note:** the spec said "records.js already tracks a distinct set — build on it." That module
lived on the unmerged `feat/record-surface` branch and is **absent from main**, so this is a
from-scratch store (`src/progress/collection.js`) — which is the substance of the job regardless.

## What shipped
- `collection.js` — the distinct-word store. Compact encoding: `taw.collection = { v, seq, w:{ word:
  [bandIdx, modeIdx, dayEpoch, recency] }, ms:[claimed] }`. Guarded; session-cached (invalidated on
  localStorage-identity change, so tests stay isolated while the browser keeps it warm).
- `recordAcceptedWord(word, {mode, band})` wired into all 5 accept sites (Word Bomb, Blitz, SAT Rush,
  CHAIN, FUSE). **Never records a word the player didn't personally type**, and normalises like the
  rarity/used-word paths (trim + lowercase).
- `CollectionScreen` — a read-only overlay (StatsScreen register). Reached from a new **COLLECTION**
  footer link on the menu. Shows total distinct, a per-TIER grid, milestone progress, the milestone
  ladder, and your **rarest finds listed with the actual words** (OBSCURE then RARE, newest first).

## Milestone amounts (chosen — scaled to stay meaningful late)
Base wins, **× the live rebirth multiplier at grant time** so they don't go trivial at high rebirth:

| Distinct words | Base wins |
|----------------|-----------|
| 100   | 5,000 |
| 500   | 50,000 |
| 1,000 | 250,000 |
| 2,500 | 2,000,000 |
| 5,000 | 20,000,000 |

Reasoning: the ramp is ~exponential so the 5,000-word grant is a genuine late-game windfall (20M ×
rebirth ≈ a KEY POWER T7 chunk), while the 100-word grant (5,000) is a welcome early nudge. Collecting
5,000 DISTINCT words is a massive vocabulary feat — most players never reach it.

## LRU cap + footprint (measured)
- Cap **5,000** words, **LRU eviction** (least-recently-*seen* word drops when a new word arrives at
  the cap; re-seeing a word refreshes its recency).
- **Measured bytes at cap: 142,615 bytes (139.3 KB)** for a realistic ~9-char-key mix (test MEASURE).
  Well under any localStorage limit.

## Notes / flagged
- Per-accepted-word cost: `recordAcceptedWord` writes the whole store (stringify) on each new/updated
  word. At gameplay rate (~1 word/sec) this is a few ms even near the 5,000 cap; the session cache
  removes the read-parse. Not on the keystroke/render path. If it ever matters on a low-end phone with
  a full collection, a debounced/batched write is the follow-up.
- Menu self-test words are NOT collected (only in-game *accepted* words), matching "every distinct
  word ever accepted."
- Tests: `collection.test.js` (7, incl. the byte MEASURE + LRU). Full suite 368 green. Screen verified
  via seeded screenshot.
