# JOB 16 — EDGE & ERROR STATES (fix/edge-states)

Walked every failure path and checked what the player actually sees. The app is largely
defensively written (guarded storage, a connection-lost overlay, a cold-start indicator), so most
paths already degrade gracefully. **One real dead-end was found and fixed**; the rest are audited
with before/after below.

## The one dead-end — FIXED
**Dictionary / word-data fetch fails (CHAIN + FUSE).** These modes pull their word list as a lazy
chunk (`solo/words.js loadSoloWords` → `import('./wordsData.js')`).
- **BEFORE:** the fetch had no `.catch`. On failure (offline, flaky wifi, a dropped chunk) `data`
  stayed `null` and the mode rendered a bare `…` **forever — no message, and not even an exit
  button.** A hard trap; the player had to reload the page.
- **AFTER:** a `.catch` sets an error state; the screen shows **"COULDN'T LOAD WORDS / Check your
  connection and try again"** with a **RETRY** (re-runs the fetch) and the always-present **✕ EXIT**.
  New `SoloLoadState.jsx`; wired into ChainGame + FuseGame. Verified in-browser by aborting the
  word chunk — the error state + both buttons render.

## The rest — audited, already handled (before = after)
| Path | What the player sees | Verdict |
|------|----------------------|---------|
| **Socket drops mid-round** | The `CONNECTION LOST` overlay slams in (defeat sting + jolt) with a button back to the menu (App.jsx + Transitions.css `.connlost-*`). | Handled — has a way out. |
| **Backend cold & slow** | `ConnectingContent` shows **"WAKING THE SERVER…"** in place of the CREATE/JOIN label while the socket wakes. | Handled. |
| **Empty room / public list** | `PublicRoomsScreen`: **"NO PUBLIC GAMES RIGHT NOW / BE THE ONE WHO STARTS THE PARTY"** + create/refresh actions (never a blank "broken" list; a calm pulse before the first list arrives). | Handled. |
| **localStorage full or blocked** | Every `taw.*` / `wa_*` access is `try/catch`-guarded → reads return fresh defaults, writes silently no-op. The session plays; progress just may not persist. | Graceful (no dead-end). *Enhancement (not a dead-end):* a one-time "storage full — progress may not save" toast — left in the backlog. |
| **Audio context blocked** | `audioCore`/`clack` `ensureCtx()` returns false; every sound is a no-op. Silent, never throws. | Handled (silent). |
| **Corrupt save data** | `loadProgress` / `loadWpm` / `loadCollection` / `getStreak` / etc. all validate + fall back to a fresh zeroed shape on garbage or a parse error. The app runs with reset progress. | Handled (no dead-end). *Note:* the reset is silent — acceptable, but a "save reset" notice is a possible future nicety. |
| **Last player leaving a room** | Backend-driven (`room_closed` / `game_reset`); the frontend returns the remaining/leaving player toward the room or menu. Full behavior needs a 2-device live test (out of these rails). | Frontend path present; flagged for the live regression pass. |

## Notes
- The rarity-index fetch (`rarityIndex.js`) already catches its failure and falls back to an empty
  index — the economy still works, only the rarity bonus/pop is absent until a later load. No change.
- Full test suite 352 green; build clean. The only product change is the solo load-failure state.
