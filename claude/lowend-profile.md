# JOB 18 — Low-End Device Profile (4× CPU throttle + slow-3G)

Target: a school Chromebook — the mode's real audience. Measured against a production
`vite build` served by `vite preview` on `http://localhost:4323/`, driven by Playwright
(Chromium) with, on every page:

- **CPU throttle 4×** — CDP `Emulation.setCPUThrottlingRate {rate:4}`
- **Slow 3G** — CDP `Network.emulateNetworkConditions` `download/upload ≈ 400 kbps (51.2 KB/s)`, `latency 400 ms`
- Intro skipped via `addInitScript` (`wa_last_seen = now`).

Frame time = median of `requestAnimationFrame` `performance.now()` deltas sampled in-page
during the activity window. Branch `perf/lowend` off `origin/main` @ `d498f59`.

### How to read the median (important caveat)
Under a CDP CPU throttle, `requestAnimationFrame` stays **vsync-paced (~16.7 ms) whenever the
main thread is idle** — the compositor is not throttled, only JS. So a **median at ~16.7 ms means
"held 60 fps"**, and only a median **above 16.7 ms** proves the main thread actually missed frames.
The `p95` / `max` columns are included because they expose **tail jank even where the median is
clean** (a screen can sit at 60 fps but drop an 80 ms frame on every word-submit).

---

## Frame-time table (per screen/state)

| Screen / state | median ms @4× | >16.7ms? | p95 / max ms | frames sampled | Cost / notes |
|---|---|---|---|---|---|
| **Menu — idle** (3 s) | **16.7** | No (vsync-bound) | 18.4 / 20.9 | 180 / 3 s | At rest the main thread is ~empty. Confirms the MENU MOTION LAW (no idle loops) is holding — nothing loops at rest, so rAF stays pinned to vsync. |
| **Menu — 30 keys/s burst** (3 s) | **35.2** | **YES (~28 fps)** | 93.1 / 132.5 | 69 / 3 s | Every credited keystroke runs `useXpCapture` (pop) **plus a React state update to the XP bar**. At 30/s the per-key React re-render can't fit a 16.7 ms frame under 4× CPU. See `src/progress/useXpCapture*` + the XP-bar render in `Homepage.jsx`. |
| **SAT Rush — active run, fast typing** (4 s) | **31.0** | **YES (~32 fps)** | 75.5 / 116.0 | 111 / 4 s | **Heaviest reachable screen.** The WANTED-poster `WordCard` (`src/satRush/WordCard.jsx`) re-renders the whole poster — reveal state, HEAT, caret, mugshot slots — on every keystroke. Only 111 frames landed in 4 s (~28 fps effective). Chunk is also the biggest lazy JS on any single screen (194 KB / 64 KB gz). |
| **CHAIN — fast typing + submits** (4 s) | **15.2** | No (median) | 32.1 / 79.1 | 234 / 4 s | Median under budget, but each **word-submit (Enter)** spikes to ~79 ms — accept/HUD/particle work on the submit path (`src/solo/ChainGame.jsx` + `SoloShell`). Steady keystrokes are cheap; the event frames are the jank. |
| **FUSE — fast typing + submits** (4 s) | **15.0** | No (median) | 32.7 / 83.8 | 233 / 4 s | Same shape as CHAIN — clean median, ~84 ms submit spikes (`src/solo/FuseGame.jsx`). |
| **Shop — all 5 themes owned** (3 s) | **16.7** | No | 28.6 / 64.2 | 171 / 3 s | Injected save (`taw.themesOwned` = all, `taw.wins` huge) so every theme card renders. Static grid; the one-off 64 ms `max` is the open transition + swatch paint, then it settles to 60 fps. |
| **Word Bomb / Category Blitz** | n/a | — | — | — | **Not measured** — both require a live WebSocket room and the backend (`chain-reaction-backend`) is not runnable in this harness. Flag for a follow-up pass with a backend: their `GameScreen` is the 2nd-largest bundle (68 KB JS + 72 KB CSS) and shares the per-keystroke render pattern, so it is a likely offender. |

**Screens over the 16.7 ms median line @4×:** Menu-under-burst (35.2) and SAT Rush active run (31.0).
CHAIN/FUSE pass on median but drop ~80 ms frames on every submit.

---

## Slow-3G first paint (4× CPU + 400 kbps / 400 ms latency)

Measured from `performance.getEntriesByType('paint')` + navigation timing on a cold load:

| Metric | Value |
|---|---|
| First Paint | **5.88 s** |
| **First Contentful Paint (FCP)** | **6.09 s** |
| DOMContentLoaded | 5.90 s |
| **Load event (fully loaded)** | **22.4 s** |

**Why:** the critical render path is ~**147 KB gzip** before anything paints —
`index.js` 56 KB + `react-vendor` 46 KB + `sentry` 29 KB + `index.css` 16 KB — which at
~51 KB/s plus 400 ms round-trips is ~6 s to FCP. The 22 s full-load tail is dominated by the
**lazy dictionary chunks**: `wordsAcceptExt` (1.9 MB raw / ~600 KB gz) and `wordsData`
(565 KB), fetched for the game modes after paint. Total shipped JS is **3.6 MB raw**.

---

## What to fix first for the Chromebook audience

Ordered by payoff-per-effort:

1. **Get Sentry off the critical path (cheapest win).** 29 KB gz of error-reporting SDK loads
   *before* first paint on a device that takes 6 s to paint. Lazy-init it after `load` (or after
   first interaction). Cuts ~0.5 s straight off FCP for zero UX change.

2. **Fix the SAT Rush per-keystroke re-render (worst interactive screen, 31 ms median).**
   `WordCard.jsx` re-renders the entire bounty poster (LAST SEEN / DESCRIPTION / KNOWN ALIASES /
   mugshots / REWARD) on every keydown. Split the volatile bits (revealed letters + caret + HEAT)
   into a memoized leaf so the static poster fields don't re-render while typing. This is the one
   screen a kid actually spends a run on.

3. **Coalesce the menu XP-bar update (35 ms burst median).** The pooled WAAPI pop is fine; the
   cost is a React state update to the XP bar on *every* credited key. rAF-coalesce the bar's
   `frac`/level state (one update per frame, not per key) so 30 keys/s can't force 30 React
   commits/s.

4. **Kill the CHAIN/FUSE submit spikes (~80 ms).** Median is fine, but every word-accept drops a
   frame. Audit the submit path for a layout read (`getBoundingClientRect`/`offsetWidth`) in the
   accept/particle burst and pool the burst — per the ANIMATION BUDGET "no layout reads in any
   per-keystroke path" rule.

5. **Shrink the 22 s full load — the 1.9 MB accept-list dictionary is the tail.** `wordsAcceptExt`
   (~600 KB gz) is the single biggest download. Consider a compressed binary trie / packed bitset,
   or a server-side membership check, so a Chromebook on school Wi-Fi isn't pulling ~1.9 MB just to
   validate words.

6. **(Follow-up) Re-run Word Bomb + Category Blitz with a backend** — unmeasured here, and their
   `GameScreen` (68 KB JS / 72 KB CSS) shares the per-keystroke render pattern that made SAT Rush
   the worst screen.
