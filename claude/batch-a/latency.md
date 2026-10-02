# BA4 — keystroke → paint latency at 4x CPU (Event Timing API, p95 of every key event)

Measured Oct 2 on a production build. "mock" = the e2e suite's WebSocket mock (adds ~20-30 ms/key of
routing on server-backed modes); "real" = a local copy of the real backend (`zz-lat-real.mjs`).

| mode | before (main) | after (this PR) | gate |
|---|---|---|---|
| CHAIN | p95 32-40 | p95 32 | < 50 ✓ |
| FUSE | p95 48-56 | p95 32 | < 50 ✓ |
| BLITZ (mock) | p95 48-56 | p95 40 | < 50 ✓ |
| WORD BOMB — real backend, reduced motion | p95 **128** | p95 **48** | < 50 ✓ |
| WORD BOMB — real backend, full motion + music | p95 **1,256** | p95 **88** | ✗ open |
| WORD BOMB (mock) | p95 64-72 | p95 72-80 | regression guard < 80 |
| SAT RUSH (real word) | p95 72-80 | p95 56 | ✗ open (guard < 80) |

## What was costing what
1. **The beat shake was App state.** In a game, every music beat called `setShake('light')` then
   `setShake(null)`: two WHOLE-APP re-renders per beat (incl. WallScene's ~22 decor pieces × letters),
   then a class restyle of the whole tree. With music on that dominated (p95 1.26 s at 4x). It is now
   one finite WAAPI transform on the wrapper — zero React renders.
2. **The word being typed was GameScreen state**, so every key re-rendered the whole Word Bomb screen.
   It now lives in a tiny store (`useSyncExternalStore`); only the input and my seat's live typing line
   subscribe.
3. **LiveStack** (the HUD rate chip) re-read the whole payout stack from storage every render → memo.
4. **WallScene / its decor panes** were unmemoised → memo.

## Still open
- WORD BOMB with music: ~20-25 ms/key of style recalc (~130 elements) + ~5 ms layout at 4x remain.
- SAT RUSH: `force()` re-renders the whole poster subtree (Hud, WordCard, Slots, Lineup, AnteMeter)
  on every key; needs the same store/memo split.
