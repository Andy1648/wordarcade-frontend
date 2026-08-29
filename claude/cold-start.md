# COLD-START on a school Chromebook (JOB 17)

Branch `perf/cold-start`. Measured a first-time visitor at 390×844 with **4× CPU throttle +
slow-3G (400 kbps, 400 ms RTT) + cold cache** (Playwright CDP `Emulation.setCPUThrottlingRate`
+ `Network.emulateNetworkConditions`), against the production `vite build` bundle.

## The measurement (before → after the cut)
| metric | before | after |
|---|---|---|
| First contentful paint | ~4.6 s | ~4.6 s |
| Menu visible (usable) | ~7.5 s | ~7.5 s |
| Time until typeable | ~7.9 s | ~7.9 s |
| **Bytes on the path to a usable menu** | **4,382 kB** | **197 kB** |
| — of which `firecracker.mp3` | 4,186 kB | 0 kB (deferred) |
| — mascot PNGs | 185 kB | 185 kB |
| — fonts (woff2) | 11 kB | 11 kB |

(JS/CSS transfer sizes read 0 here because `vite preview` serves them without a `content-length`
header — they are in the bundle but not counted in this byte tally; see the JS note below.)

## What was on the path that did not need to be — and the cut
**The 4.1 MB music track was being downloaded on cold start**, before any user gesture and before
sound is even enabled: `useMusicPlayer.js` created the `<audio>` with `preload = 'auto'`. Music
only ever plays on the first user gesture (`startMusicOnGesture → play()`), and `play()` triggers
its own load — so the eager preload bought nothing and cost 4.1 MB (96 % of the cold-start bytes).

**Fix (applied): `audio.preload = 'auto'` → `'none'`.** Cold-start payload **4,382 kB → 197 kB**
(−4.1 MB). Zero UX cost — music still fades in on the first gesture (verified: the
`repeat-visitor-music` e2e, which observes real `<audio>` playback, still passes). This matters
most for exactly the target user: a capped/metered school connection no longer burns 4 MB before
the visitor decides whether to stay.

## What still dominates — and why it wasn't cut here
FCP/menu-visible did NOT improve, because on a 4× CPU device the cold start is **CPU-bound (JS
parse/execute), not byte-bound** — removing the mp3 (which downloaded in parallel, not on the
render-blocking path) frees bandwidth but not main-thread time. The lever for TIME is the
**JavaScript bundle** (the dead-code sweep, JOB 18, reported total dist JS ≈ 3.75 MB across all
chunks). Reducing time-to-interactive means shrinking/splitting the INITIAL chunk — deferring
more off the first-paint path (Sentry ~207 kB is eager by necessity for the ErrorBoundary;
posthog is already lazy; the solo dictionaries are already post-first-run). That is a real
code-splitting investigation with its own regression surface, so it is scoped here, NOT done:
- Audit the initial chunk with `rollup-plugin-visualizer` to see what parses before the menu.
- Candidates to lazy-load behind the first interaction: the mode-dialog/shop/stats overlays, the
  SAT-Rush and solo engines (only needed once a mode is entered).

## Verification
Build exit 0; `repeat-visitor-music` e2e passed (`.last-run.json` status passed). The only source
change is the one-line `preload` cut.
