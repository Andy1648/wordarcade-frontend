# JOB 13 — Input latency across all modes

Measures **keydown → visible character** and **Enter → visible feedback** in every
reachable mode, at CALM and MAXIMUM PRESSURE, **median of 50 samples**, both
UNTHROTTLED and with **4× CPU throttling** (the number that matters — a mid-range
phone). Product code was not changed.

## Method

- `npx vite build` → `npx vite preview --port 4322` (local production build), targeted
  at `http://localhost:4322/`. Intro skipped by injecting
  `localStorage.setItem('wa_last_seen', Date.now())` via Playwright `addInitScript`.
- Playwright + Chromium 151. Per sample: `performance.now()` captured at the keydown,
  and the visible DOM change detected with a `MutationObserver` + `requestAnimationFrame`
  (so the number includes the wait to the paint frame — i.e. real "visible" latency, not
  just JS time). Median over 50 mutation-producing samples.
- 4× throttle via CDP: `client.send('Emulation.setCPUThrottlingRate', { rate: 4 })`.
- CALM = spaced keystrokes; MAX PRESSURE = back-to-back sustained typing, plus for SAT
  Rush the fastest reveal cadence (`?stage=400&spell=250`) so stage/spell timers fire
  concurrently with typing.
- **Reachable & measured directly (no backend):** SAT Rush (`?satrush=1`, LINEUP),
  CHAIN (`?chain=1`), FUSE (`?fuse=1`). These are keyboard-only solo modes.
- **Measured by code-read only (need a live WebSocket backend):** Word Bomb, Category
  Blitz. Their input path is analysed below; no numbers are invented for them.
- Frame-quantization floor: at 60 fps a keystroke that does trivial work still lands
  ~6–10 ms out because it waits for the next paint. So unthrottled medians clustering
  ~6–10 ms means "sub-frame" — effectively instant.

## Results — MEDIAN of 50 (milliseconds)

### keydown → visible character

| Mode      | Calm · unthrottled | Calm · **4× throttled** | Max · unthrottled | Max · **4× throttled** |
|-----------|:---:|:---:|:---:|:---:|
| SAT Rush  | 8.1 | **30.1** ⚠ (tail 104) | 13.7 | **29.4** ⚠ (tail 100) |
| CHAIN     | 6.5 | 8.3 | 6.1 | 8.1 |
| FUSE      | 6.9 | 8.1 | 5.6 | 7.6 |
| Word Bomb | code-read (native input — see below) |||| 
| Blitz     | code-read (native input — see below) |||| 

### Enter → visible feedback

| Mode      | Calm · unthrottled | Calm · **4× throttled** | Max · unthrottled | Max · **4× throttled** |
|-----------|:---:|:---:|:---:|:---:|
| SAT Rush  | N/A | N/A | N/A | N/A |
| CHAIN     | 9.6 | 18.6 (tail 96) | 9.1 | 19.1 (tail 93) |
| FUSE      | 9.5 | 19.2 (tail 122) | 9.3 | 19.8 (tail 115) |
| Word Bomb | code-read (same-frame local / network — see below) |||| 
| Blitz     | code-read (network round-trip — see below) |||| 

SAT Rush has no Enter/submit: a word commits by typing its final letter, so its
keydown→character number already covers the commit path. "N/A" is literal, not a gap.

## The one over-30 ms case: SAT Rush keydown→character, 4× throttled (~30 ms, tail ~100 ms)

Every other median is ≤ ~20 ms including at 4× throttle. **SAT Rush is the only mode at
or over the 30 ms line, and only when throttled.** The specific cost:

- **The character is drawn by React, not by a native input.** SAT Rush renders each letter
  as a custom `<div class="sr-slot">` (`src/satRush/Slots.jsx:30-40`), fed from
  `getSlots()`. So the typed/rejected letter only becomes visible after a full React
  commit — there is no native-input shortcut. keydown→character *is* the re-render time.
- **Every keystroke calls `force()` and rebuilds the entire view.** The keyboard handler
  (`src/satRush/useSatRushGame.js:433-489`) ends every branch in `force()` (a
  `useReducer` bump, line 48). That re-runs the whole hook and rebuilds `buildView(...)`
  (`useSatRushGame.js:727` → body `788-871`) on **every** keystroke — including
  `slots.map`, `reveals.map`, the LINEUP `suspects.lineup.map`, `effectiveStageIntervalMs(...)`,
  and notably `results: { ...eng.results(), mastered: lexicon.masteredCount(...) }`
  (`useSatRushGame.js:869`) — the run-summary + a scan of the whole lexicon computed on
  each keystroke even though results only matter at game-over.
- **The whole card subtree re-renders unmemoized.** `WordCard` → `Slots`, `Hud`,
  `AnteMeter`, `SpeedLines`, `SuspectLineup` (maps 6 suspects) all re-render per keystroke
  (`src/satRush/WordCard.jsx`, `SatRushGame.jsx:136-156`), plus per-keystroke juice on a
  reject (`registerWrongKeystroke()` + `juice.wrongKey()`, `useSatRushGame.js:473-481`).
- **Under MAX pressure the tail worsens** (max 100 ms): the stage timer and the
  spell-along tick each also call `force()` (`useSatRushGame.js:386, 405-419`) on the fast
  `?stage=400/?spell=250` cadence, so a keystroke can land in the same frame as a
  timer-driven re-render + its juice.

Unthrottled this is invisible (8–14 ms). At 4× it sits right at the perceptible edge.
Fix direction if it ever needs one: memoize the static card chrome and stop recomputing
`results`/`masteredCount` per keystroke — move them to the game-over path.

## Why CHAIN / FUSE stay ~8 ms even at 4× (and why the throttle barely moves them)

The character goes into a **native controlled `<input>`** (`src/solo/SoloShell.jsx:108-121`).
The browser inserts and paints the typed glyph on the native input event *before* React's
`onChange → setInput → re-render` runs (`src/solo/useSoloGame.js:159-169`); React's
synchronous re-render then writes back the same value, so **the visible character never
waits on the React commit.** The per-keystroke React work still happens —
`ChainInner`/`FuseInner` re-render, and CHAIN recomputes `engine.supply()` twice per
keystroke (`src/solo/ChainGame.jsx:203-220`, scan in `src/solo/chain.js:88-97`) — but it
is bucketed by first letter and sub-ms, and it does **not** gate the glyph's paint. Hence
near-frame-floor latency regardless of CPU throttle.

CHAIN/FUSE **Enter→feedback** (~9 ms → ~19 ms at 4×) *is* React-gated: the reject sill is a
keyed remount and the reason line is state, so the feedback waits on a re-render
(`src/solo/useSoloGame.js:199-205` `setReason`/`setSillKey`; `SoloShell.jsx:122-131`).
The solo tree is light, so even throttled it stays well under 30 ms (median ~19; rare
~100 ms tails when a countdown-rAF frame collides with the submit re-render).

## Word Bomb / Category Blitz — code-read (need a live socket for an end-to-end number)

These mount only inside a room/game over a WebSocket to the Render backend, which cannot
be started here. Reasoning about the input path:

**keydown → character — native, not React-gated (so effectively ~frame-floor, like CHAIN/FUSE):**
Both use a native controlled `<input value={draft}>` (Word Bomb `GameScreen.jsx:2926-2930`;
Blitz `GameScreen.jsx:4046-4054`), so the glyph paints natively before React runs.
Per-keystroke work on the *non-visible* path, at speed, is where cost hides:
- **Word Bomb `onChange` (`GameScreen.jsx:2931-2968`)** does `sound.keystroke()`,
  `setDraft(value)` (re-renders the large GameScreen), and **`onTypingUpdate(value)` →
  `send('typing_update', {text})` on EVERY keystroke** (`App.jsx:1744-1745`) — a
  JSON.stringify + `ws.send` per key (fire-and-forget, off the visible-char path, but real
  main-thread + network work while typing fast). The optional floater (the one
  `getBoundingClientRect` layout read, line 2940) is **gated OFF** by `JUICE.FLOATERS`
  default-false, so no per-keystroke layout read normally occurs.
- A prior whole-App re-render on the first key of each word (which touched the ~250-node
  `WallScene`) was deliberately removed — the handler now sets a ref
  (`dismissedResultRef`, `GameScreen.jsx:2955-2964`) instead of clearing App state. Good;
  that was the real risk and it is already mitigated.
- **Blitz `onChange` (`GameScreen.jsx:4049-4054`)** is lighter still: `sound.keystroke()` +
  `setDraft` only — no typing relay, no floater.

**Enter → feedback:**
- **Word Bomb local rejects** (`too_short` / `missing_combo` / `already_used`) are surfaced
  **same-frame** with no network: `submit()` → `onLocalWordResult(setLastWordResult)`
  (`GameScreen.jsx:2466-2478`, `App.jsx:1801`), which re-renders App + GameScreen and
  shows the buzz/shake/toast. This is React-gated (App + a big GameScreen re-render), so
  expect it a bit heavier than the solo ~19 ms at 4×, but still same-frame. A live socket
  is needed to put a real number on it.
- **Word Bomb dictionary check (`not_a_word`) and every accept, and ALL of Category Blitz**
  go to the server (`onSubmitWord`/`onSubmitAnswer` → `send(...)`), so the verdict is a
  **network round-trip to Render** — latency dominated by RTT (tens–hundreds of ms), not
  client input latency, and not measurable here without the backend.

## Bottom line

- Slowest mode/condition: **SAT Rush, keydown→character, 4× throttled** — median ~30 ms
  (calm 30.1, max 29.4), tail ~100 ms.
- **Only SAT Rush reaches the 30 ms line, and only under 4× throttle.** Everything else —
  CHAIN/FUSE keydown (~8 ms), all Enter feedback (≤ ~20 ms), and (by construction) the
  native Word Bomb / Blitz character inputs — stays comfortably under 30 ms even throttled.
- Main cost in the SAT Rush path: the letters are React-drawn `<div>` slots, so every
  keystroke waits on a full `force()` re-render that rebuilds the entire view (incl.
  `eng.results()` + `lexicon.masteredCount()` needlessly per keystroke) and re-renders the
  unmemoized card subtree — with the tail worsened by concurrent stage/spell `force()`
  timers under max pressure.
