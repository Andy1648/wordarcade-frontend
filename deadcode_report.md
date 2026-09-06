# Dead Code Inventory — `src/`

**Project:** React + Vite frontend (Node/WebSocket backend lives elsewhere — not in this repo).
**Scope scanned:** all `.js` / `.jsx` / `.css` under `src/` (28 source modules + CSS).
**Method:** read every JS/JSX file; built the import graph by grepping basenames/symbols; collected WS `type` literals from `send('…')` calls and `lastMessage.type === '…'` handlers.

> This is an inventory for human review. Confidence flags (HIGH / MEDIUM / LOW) are given throughout, especially where dynamic usage or the returned-API surface could fool a static grep.

---

## Summary counts

| Section | Count |
|---|---|
| 1. Unused imports | **0** confirmed |
| 2. Unreferenced files | **1** orphaned (`useMascotPose.js`) + entry points noted |
| 3. Unused module-scope vars / functions / exports | **3** (1 dead export `PAINT_SPLATTERS`; 2 unused returned-API members) + 4 same-file-only exports (LOW) |
| 4. WebSocket message types | 16 sent, 22 handled; **6 sent-not-handled-here** (backend handles — expected), **8 handled-not-sent** (backend-originated — expected), **2 one-off / suspicious** |

**Most surprising finding:** `src/hooks/useMascotPose.js` is a complete, well-documented 86-line hook that is **never imported anywhere** — GameScreen.jsx reimplements the same bomb-pose logic inline instead. Strong dead-file candidate.

---

## 1. UNUSED IMPORTS

No unused imports found. Every imported symbol in every file is referenced. Spot-checks of the busiest import lists:

- `src/App.jsx:2` — `useState, useEffect, useRef, useMemo` all used; all 14 component/hook imports rendered/called.
- `src/components/Homepage.jsx:6-11` — `PaintSplatter1..4` all rendered (lines 115-118). (Note: `PaintSplatter5` is intentionally NOT imported here — it's used by WallScene instead.)
- `src/components/WallScene.jsx:15-20` — imports `PaintSplatter1, 2, 3, 5` and all four are used in `WALL_SPLATTERS`.
- `src/components/GameScreen.jsx:2-5` — `useEffect, useRef, useState`, `useSound`, `Mascot`, `ImposterWordScreen` all used.

Confidence: **HIGH**.

---

## 2. UNREFERENCED FILES

### Orphaned — true dead file
- **`src/hooks/useMascotPose.js`** — exports `useMascotPose(...)`. Grep for `useMascotPose` across `src/` returns **only its own definition** (lines 1, 16); no `import`. The functionality (mascot pose derived from game state) was re-implemented inline inside `GameScreen.jsx` (`bombPose`/`flashBombPose`) and `CategoryBlitzScreen`/`ImposterWordScreen`, so this standalone hook is dead.
  Confidence: **HIGH**.

### Entry points / referenced-by-non-JS (NOT dead)
- `src/main.jsx` — app entry, referenced by `index.html:30` (`<script type="module" src="/src/main.jsx">`). Entry point.
- `src/index.css` — imported by `main.jsx:4`.
- `src/App.jsx` — imported by `main.jsx:3`.
- `src/Transitions.css` — imported by `App.jsx:22`. (Sole import; verify the rules inside are still used by current class names if doing a CSS pass — not analyzed here.)

### All other files are referenced
Every remaining component/hook/context is imported at least once. CSS files are each imported by their sibling component (e.g. `GameScreen.css` ← `GameScreen.jsx`, `ImposterWord.css` ← `ImposterWordScreen.jsx`, `GameCardArt.css` ← `GameArt.jsx`, etc.). Decor (`GraffitiTag`, `Stickers`, `PaintSplatters`) all consumed by `WallScene.jsx` / `Homepage.jsx`.

> NOTE (out of scope but flagged): `dist/` contains a built copy of `index.html` — build artifact, ignore.

---

## 3. UNUSED VARIABLES / FUNCTIONS / EXPORTS

### Dead export (declared, exported, never imported)
- **`src/components/decor/PaintSplatters.jsx:208` — `export const PAINT_SPLATTERS`** — an array bundling `PaintSplatter1..5`. Grep shows it appears **only at its definition** (line 208); nothing imports `PAINT_SPLATTERS`. Consumers import the individual `PaintSplatterN` components directly instead. Dead.
  Confidence: **HIGH**.

### Returned-API members never consumed by any caller
These are part of a hook's returned object but no call site reads them. Safe to consider trimming, but LOW because they're a deliberate public surface.
- **`src/hooks/useMusicPlayer.js:252` — `pause`** (the `useCallback` at line 198). The hook returns `pause`, but `App.jsx` (the only consumer) uses `music.play / setVolume / fadeTo / isPlaying / isMuted / toggleMute / getFrequencyData` — never `music.pause`. Confidence: **MEDIUM** (clearly unused by the only consumer).
- **`src/hooks/useBeatSync.js:130` — `isAnalysing`** (state at line 48). Returned in `{ beatCount, isAnalysing }`, but `App.jsx:219` destructures only `{ beatCount }`. `isAnalysing` is never read. The `useState(false)` + `setIsAnalysing(...)` calls (lines 48, 67) become dead bookkeeping if removed. Confidence: **MEDIUM**.

### Exported but used ONLY within the same file (not true dead code, but unnecessary `export`)
In `src/components/GameScreen.jsx`, these are declared `export function` yet only referenced inside `GameScreen.jsx` itself (no external importer):
- `CountdownOverlay` (`:327`) — used at lines 1672, 2365 (same file).
- `ConfettiEffect` (`:385`) — used at 1964, 2043, 2288 (same file).
- `CountUp` (`:487`) — used at 935, 945, 974, 990, 2056, 2313 (same file).
- `WobbleText` (`:518`) — used at 2293 (same file).
These are **not dead** (they render), but the `export` keyword is superfluous — nothing outside the module imports them. Confidence: **LOW** (cleanup-only; harmless).

### Checked and NOT flagged (conventional / genuinely used)
- `GameCard.jsx` prop `topper` — used (lines 26, 60). Fine.
- `WaveText.jsx` prop `step` — used (line 17). Fine.
- `PaintSplatters.jsx` helper `darken` — used by every splatter. Fine.
- `Stickers.jsx` inner components (`Skull`, `Bolt`, …) — all dispatched by `StickerInner`. Fine.
- `EMPTY_STATS`, `SCREEN_ACCENT`, `TRANSITION_WORDS`, `PRESELECTABLE_GAMES` in `App.jsx` — all referenced.
- No stray unused locals spotted in the large `GameScreen.jsx` / `App.jsx` effect bodies.

---

## 4. WEBSOCKET MESSAGE TYPES

Frontend-only visibility. All sends are `send('<type>', …)` in `App.jsx`; all receives are `lastMessage.type === '<type>'` handlers in `App.jsx` (the single WS hub — `useWebSocket.js` just relays raw messages).

### Types SENT by the frontend (16) — `App.jsx`
`join_room` (711), `create_room` (713), `set_game_type` (719, 734), `leave_room` (725), `set_difficulty` (730), `start_game` (738, 754), `rematch` (744), `reroll_category` (760), `submit_word` (764), `submit_answer` (768), `submit_vote` (776), `skip_turn` (780), `typing_update` (786), `spectator_reaction` (791).

### Types HANDLED by the frontend (22) — `App.jsx`
`connected` (252), `room_update` (256), `game_reset` (268), `game_started` (274), `typing_update` (298), `spectator_reaction` (303), `turn_update` (317), `timer_tick` (383), `word_result` (387), `turn_timeout` (436), `turn_skipped` (440), `round_start` (446), `imposter_answer` (498), `vote_phase_start` (504), `vote_count` (518), `vote_result` (523), `vote_results` (528), `answer_result` (533), `player_progress` (541), `round_end` (547), `game_over` (562), `error` (580).

### (a) SENT but NOT handled here — the BACKEND handles these (expected, NOT dead)
These are client→server commands; the server acts on them. No frontend handler is expected.
- `join_room` (App.jsx:711) — backend.
- `create_room` (App.jsx:713) — backend.
- `set_game_type` (App.jsx:719, 734) — backend.
- `leave_room` (App.jsx:725) — backend.
- `set_difficulty` (App.jsx:730) — backend.
- `start_game` (App.jsx:738, 754) — backend.
- `rematch` (App.jsx:744) — backend.
- `reroll_category` (App.jsx:760) — backend.
- `submit_word` (App.jsx:764) — backend.
- `submit_answer` (App.jsx:768) — backend.
- `submit_vote` (App.jsx:776) — backend.
- `skip_turn` (App.jsx:780) — backend.

(Two — `typing_update` and `spectator_reaction` — are BOTH sent and handled: the client sends them and the server relays them back to other clients, which then handle them. Not dead.)

Label: **backend-handled**, not frontend dead code.

### (b) HANDLED but NEVER sent by the frontend — BACKEND-ORIGINATED (expected, NOT dead)
These are server→client broadcasts/notifications; the frontend only ever receives them.
- `connected` (App.jsx:252) — backend-originated.
- `room_update` (App.jsx:256) — backend-originated.
- `game_reset` (App.jsx:268) — backend-originated.
- `game_started` (App.jsx:274) — backend-originated.
- `turn_update` (App.jsx:317) — backend-originated.
- `timer_tick` (App.jsx:383) — backend-originated.
- `word_result` (App.jsx:387) — backend-originated.
- `turn_timeout` (App.jsx:436) — backend-originated.
- `turn_skipped` (App.jsx:440) — backend-originated.
- `round_start` (App.jsx:446) — backend-originated.
- `imposter_answer` (App.jsx:498) — backend-originated.
- `vote_phase_start` (App.jsx:504) — backend-originated.
- `vote_count` (App.jsx:518) — backend-originated.
- `vote_result` (App.jsx:523) — backend-originated.
- `vote_results` (App.jsx:528) — backend-originated.
- `answer_result` (App.jsx:533) — backend-originated.
- `player_progress` (App.jsx:541) — backend-originated.
- `round_end` (App.jsx:547) — backend-originated.
- `game_over` (App.jsx:562) — backend-originated.
- `error` (App.jsx:580) — backend-originated.

Label: **backend-originated**, expected, not dead.

### (c) Type strings appearing exactly once total (suspicious — verify against backend)
A type that is handled but never sent (or vice-versa) and appears only once in the frontend is worth a quick cross-check with the backend contract. Genuinely single-occurrence and easy to typo:
- **`game_reset`** — handled once (App.jsx:268), never sent. Confirm the backend actually emits the literal `game_reset` (the rematch flow comment says it drives game→room). Suspicious only in that a backend rename would silently break it. Confidence the type is real: **MEDIUM**.
- **`connected`** — handled once (App.jsx:252). Standard server hello; relied on for `myId`. Confirm backend emits exactly `connected`. **MEDIUM**.
- **`vote_result`** (singular, App.jsx:523) vs **`vote_results`** (plural, App.jsx:528) — two DISTINCT, similarly-named handlers, each appearing once. This near-collision is the highest-risk item: easy to confuse `vote_result` (self-vote bounce → unlock) with `vote_results` (the reveal). Verify the backend sends both spellings exactly as written. Confidence both are intentional: **MEDIUM** (intentional per code/comments, but flag-worthy).

Every other handled type also technically appears "once" as a handler, but that's the normal shape of this dispatcher (one `if` per type), so only the genuinely fragile/near-duplicate names above are called out.

> Caveat: full sent-vs-handled correctness can only be confirmed against the backend repo (`chain-reaction-backend`), which is NOT in this workspace. Nothing in section 4 is dead frontend code — the asymmetry is the normal client/server split.

---

## Quick action list (highest-confidence dead code first)
1. **DELETE** `src/hooks/useMascotPose.js` — orphaned file, never imported. (HIGH)
2. **REMOVE** `export const PAINT_SPLATTERS` (`PaintSplatters.jsx:208`) — dead export. (HIGH)
3. **TRIM** `pause` from `useMusicPlayer`'s return, and `isAnalysing` (+ its `useState`/`setIsAnalysing`) from `useBeatSync` — returned but never consumed. (MEDIUM)
4. **OPTIONAL** drop the `export` keyword on `CountdownOverlay` / `ConfettiEffect` / `CountUp` / `WobbleText` in `GameScreen.jsx` (used same-file only). (LOW)
5. **VERIFY against backend** the literals `game_reset`, `connected`, and the `vote_result` vs `vote_results` pair. (MEDIUM)
