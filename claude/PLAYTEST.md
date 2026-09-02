# PLAYTEST — integration/all-held (one 2-device sitting)

Nine held branches, folded into **one** test session. Run top to bottom once, on **two
hard-refreshed devices** (laptop = A, phone = B). Each step is ordered to exercise as many
branches at once as possible. For every step: **DO**, **EXPECT**, **BROKEN IF**.

**In this build (8 branches merged):** fix/card-polish · fix/logic-and-onboarding ·
fix/logic-pass · feat/optimistic-input · feat/reconnect · feat/offline · feat/game-fill-2 ·
fix/loading-states.

**EXCLUDED — do NOT test:** `feat/router` (clean-URL deep links `/sat-rush` `/chain` `/fuse`).
Left out because its own router.spec is red in isolation — those routes render the **menu**,
not the mode. So do not judge deep-link URLs here; they are not in this build. (See WORKLOG.)

Preview URL: _(filled in when the branch is pushed — newest Ready Preview for integration/all-held)_

---

## STEP 0 — Cold load + offline install  ·  offline, loading-states, card-polish
**DO:** On A, open the preview URL in a fresh tab and hard-refresh. Watch the load. Then open
DevTools → Application → Service Workers.
**EXPECT:** Splash → menu with no blank white gap during load (a branded RouteFallback covers any
slow chunk, and only after a short delay — fast loads show no fallback flash). Menu cards show the
**new art** — forged-chain / braided-rope motifs, double-rule frames, stamp ribbons — not flat
old cards. A service worker is **registered + activated**.
**BROKEN IF:** white screen for >1s on load; cards look like the old flat style; no SW registered;
red console errors.

## STEP 1 — First-run onboarding  ·  logic-and-onboarding, card-polish, logic-pass
**DO:** Use a clean profile (incognito, or clear site data) on A. Open a mode dialog and the pack
picker (Category Blitz → choose packs). Move the mouse over the menu cards.
**EXPECT:** Pack picker is **full height**, no phantom **"N MORE"** pager label with nothing behind
it. First-run spotlights appear **one step at a time**, not stacked on top of each other. Card
**hover is clean** — a single smooth response, no jitter or double-trigger.
**BROKEN IF:** a "N MORE" ghost; two+ spotlights visible at once; pack picker clipped / not full
height; hover flickers or fires twice.

## STEP 2 — Word Bomb, 2 devices, live  ·  reconnect, optimistic-input, game-fill-2, logic-pass
**DO:** A → CREATE ROOM. B → JOIN by code. A → START Word Bomb. Both type words each turn (try a
real word, a 2-letter word, a word missing the fragment, and a repeat).
**EXPECT:** **Both** devices enter the game — no freeze, no dark screen, non-host is NOT kicked back
to waiting (functional-setView + FIFO-queue traps). Your own accepted word and the three local
rejects (**TOO SHORT / MUST CONTAIN [fragment] / ALREADY USED**) show **instantly, same-frame**
(optimistic input); only a dictionary reject round-trips to the server. The WB board **fills ~90%
of the width with no horizontal overflow or clipping**, on both phone and laptop. Turn passes
correctly A↔B.
**BROKEN IF:** non-host stuck on waiting/starting; visible lag before your own word appears;
board overflows, clips, or leaves a big empty margin; turn doesn't advance.

## STEP 3 — Reconnect  ·  reconnect
**DO:** Mid-Word-Bomb on B (phone), background the app ~3–5s, then foreground it.
**EXPECT:** The app **attempts to reconnect** (backoff) — NOT the old instant "CONNECTION LOST →
BACK TO MENU" dead-end. A waiting/finished room rejoins cleanly. A **live** game that cannot restore
the seat drops you to a **wins-preserved landing** — your banked wins are safe. _(True live-seat
resume needs a backend `rejoin_room` change that is NOT in this build, so a live-game drop landing
wins-preserved is the EXPECTED behavior, not a bug.)_
**BROKEN IF:** instant game-over with no reconnect attempt; banked wins lost; app frozen/blank.

## STEP 4 — Game-over  ·  game-fill-2, card-polish
**DO:** End or leave the WB game to reach the game-over screen on both devices.
**EXPECT:** Game-over card is composed and fits — REMATCH / LEAVE actions are **visible on screen,
not below the fold**; no play screen bleeding through the sides.
**BROKEN IF:** actions below the fold / off-screen; card overflows; screen bleed-through.

## STEP 5 — Solo modes, fully offline  ·  offline, game-fill-2, loading-states
**DO:** On A, enable airplane mode (kill wifi + data). Open CHAIN, then FUSE, then SAT RUSH, and
play a few words in each.
**EXPECT:** All three **load and play with no network** (the SW precached their word chunks on the
first visit). Each board **fills the screen** (game-fill-2). Any slow chunk shows the branded
RouteFallback, never a blank.
**BROKEN IF:** a "no internet" / needs-connection error; blank screen; a board that's tiny,
overflowing, or clipped.

## STEP 6 — Integrity sweep  ·  all branches
**DO:** On both devices, open the console. Rotate the phone portrait↔landscape on the menu, an
in-game screen, and a game-over screen.
**EXPECT:** 0 red console errors, **0 React key-collision warnings**, on both devices. No clipping,
overflow, or collisions in either orientation at phone width.
**BROKEN IF:** any red error, any key-collision warning, or any screen that clips/overflows in
either orientation.

---

### If a step fails
That step names the branch(es) it exercises — the failure is in one of those. The three most
dangerous regressions to watch (all in STEP 2) are the documented Tier-1 traps: non-host kicked to
waiting (functional `setView` guard / FIFO message queue) and any freeze on game entry. If STEP 2
regresses, treat it as the priority before anything cosmetic.
