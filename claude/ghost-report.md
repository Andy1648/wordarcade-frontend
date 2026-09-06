# JOB 13 — ghost of your best run (feat/ghost)

Race the ghost of your own best CHAIN / FUSE run. No server, no account — a self-ghost lives in
localStorage. Gate: build 0, lint 0 errors, unit **445/445** (6 new ghost tests), solo-dict e2e green.

## What it does
- **`src/solo/ghost.js`** — records a compact replay of a run's ACCEPTED words on a timeline
  (`word` + ms-from-first-word), keeps only the SINGLE best run per mode as the ghost, and answers
  "how many words had the ghost typed by elapsed T?" for a live pace race.
- **CHAIN + FUSE** (`ChainGame.jsx` / `FuseGame.jsx`): on run start a fresh recorder is created and the
  stored best ghost is loaded; each accepted word is recorded; on run over the run is offered to the
  store (kept only if it beat the best). While playing, the HUD readout swaps `BEST n` for a live
  **`GHOST n`** that turns **green while you're ahead** of your best self and **red while behind** — so
  the ghost's progress on the same timeline is visible against yours in real time.

## Measured replay size (the reported bytes)
The stored replay is `{ s:score, d:durationMs, e:[[tDeciseconds,"word"],…] }` — timestamps are
100ms-quantised to save bytes.
- **20-word CHAIN run: 301 bytes.**
- **40-word FUSE run: 580 bytes.**
So a real run is ~0.3–0.6 KB.

## Cap
**One ghost per mode** — only the best run is kept (a new best overwrites it), so the whole feature's
footprint is 2 keys (`taw.ghost.chain`, `taw.ghost.fuse`) at well under 1 KB each — the smallest
possible cap. A single replay is additionally hard-capped at `MAX_EVENTS = 400` words so a pathological
run can never bloat the key. All storage access is guarded; a blocked store just disables the feature.

## Tests (`ghost.test.js`, 6, all green)
record→finish→load round-trips the timeline (t relative to first word, 100ms-quantised); only a BETTER
run overwrites; an empty run never saves; a replay is capped at MAX_EVENTS; `ghostWordsAt`/`ghostWordAt`
report the correct pace at a given elapsed time; corrupt/missing storage reads back null without throwing.

## Scope note (faithful to the race)
The replay records ACCEPTED words only — a ghost is the trail of your successful words, and only an
accept advances it, so a reject wouldn't move the ghost anyway. The pace race compares on the mode's
run metric (CHAIN links / FUSE words solved). Both clocks start at each run's FIRST accepted word, so
the race is apples-to-apples ("at T seconds past your first word, the ghost had N, you have M").
