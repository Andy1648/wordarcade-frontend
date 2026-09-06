# JOB D — perf/js-split: menu TTI at 4× CPU + Slow-3G

**TL;DR.** Menu time-to-interactive under 4× CPU throttle + Slow-3G is **~9.6s median, and it is
CPU-/latency-bound, not byte-bound.** Proven three ways below. Code-splitting bytes off the menu
therefore does **not** move menu-TTI, so the `<5s` target is **not reachable by splitting** — the
only lever that would move it is cutting the entry's parse cost (the App.jsx bundle), which is a
Tier-1 refactor (`refactor/app-split`) and out of scope for an unsupervised run. What this branch
**does** ship is a real, low-risk fix to a separate problem the investigation surfaced: the menu was
eagerly pre-fetching the entire route graph on every connection.

## Harness
- `claude/perf/menu-tti.ruler.mjs` — playwright spec: seeds `wa_last_seen` (skip the once-per-session
  intro), stubs `navigator.connection.effectiveType='3g'` (a real Slow-3G device reports this; CDP
  throttling alone does not), CDP `setCPUThrottlingRate(4)` + `emulateNetworkConditions` (Slow-3G:
  400 kb/s, 400 ms RTT), then times until `.homepage-corner-nav` is visible + hit-testable. Median of 3.
- `claude/perf/measure_gz.ruler.mjs` — standalone (owns a gzip static server + drives chromium), used
  to test the gzipped/production-representative path without vite-preview's uncompressed serving.
- Both live under `claude/perf/` (NOT `e2e/`) on purpose: at 4× CPU each cold load is ~15–50s and the
  absolute number drifts with machine load, so they are manual rulers, not build-failing gates.

## Measurements (median of 3, back-to-back under identical machine load)

| Build / serving                         | Menu TTI (median) |
|-----------------------------------------|-------------------|
| main (uncompressed vite preview)        | **9597 ms**       |
| warm-guard (uncompressed vite preview)  | 9706 ms           |
| warm-guard (GZIP server, prod-like)     | **9651 ms**       |

Gzip vs uncompressed is a **wash** (9651 vs 9706) — the decisive result. It says the wire bytes are
not the bottleneck at Slow-3G here; the 400 ms RTT on the dependency chain (html → entry → react-vendor)
plus 4× main-thread parse/exec of react-vendor (143 kB) + entry (197 kB) is. Waterfall confirms it:
the entry finishes downloading at ~6.3s but corner-nav doesn't paint until ~10s — ~3.7s of pure
4×-CPU boot after the bytes are already in.

Two byte-level experiments that (correctly) did NOT help, and were reverted:
- **Defer Sentry off the critical path** (custom error boundary + lazy `@sentry/react`, `resolveDependencies`
  to drop it from modulepreload). It removed 86 kB (29 kB gz) from the critical path but **TTI got
  *worse*** (perturbed chunk priority so react-vendor/entry landed later). Byte-bound it is not. Reverted.
- **gzip serving** (above): no change. Reverted to reporting only.

## What surfaced and IS shipped: the route-warm cascade

`App.jsx` warms the deferred screen chunks on idle after first paint (so navigation is instant). Its
`requestIdleCallback(..., { timeout: 2500 })` **fires mid-load on a slow device** and pulls the whole
route graph during menu boot:

```
GameScreen / RoomScreen / LobbyScreen / PublicRoomsScreen / StatsScreen / ShopScreen
+ PlayerDot / CopyResultButton / ShareBar + all their CSS   ≈ 225 kB raw (~62 kB gz)
```

On a fast link that's free idle bandwidth. On a **slow or metered (Save-Data)** link it's 225 kB the
menu never needed yet, competing with first paint and ignoring the user's data preference.

**Fix (this branch):** gate the warm on `navigator.connection` — skip it entirely when `saveData` is
set or `effectiveType` is `2g`/`3g`. Navigation then lazy-loads on demand (the screen-wipe + null
Suspense fallback already cover the brief fetch). Fast/unknown connections are **unchanged**. This is
strictly conservative: it only ever *removes* work on links that were being harmed by it.

- Does it move menu-TTI in the ruler? **No** — those chunks were downloading in parallel *after* the
  entry, so they weren't gating corner-nav in this CPU-bound scenario. The win is **data cost +
  contention** on metered/slow connections (225 kB not spent, Save-Data honored), not the timestamp.

## The only lever that would hit <5s (NOT done here — deferred)
Menu-TTI is dominated by parsing/executing **react-vendor (143 kB, irreducible — it's React)** and the
**entry/App.jsx bundle (197 kB)** at 4× CPU. React is fixed; the entry is not — App.jsx carries every
WebSocket handler, the economy, and all view logic, all parsed even to show the menu. Splitting the
menu shell away from the in-game/WS machinery so the menu route parses a fraction of the entry is the
one change that would cut the 4×-CPU boot. **But App.jsx is Tier-1** (WS messages, view/state
lifecycle, the documented stale-`view` / FIFO-queue traps), so it needs the one-task, diagnose-first,
supervised-review workflow — it is the separate `refactor/app-split` backlog job, not an unsupervised
8-hour-run edit. Flagged, not attempted.

## Verdict
- Shipped: connection-gated route warm (real fix for metered/slow users; ~225 kB / Save-Data respected).
- Not shipped (reverted, evidence above): Sentry-defer and gzip — proven not to move a CPU-bound TTI.
- `<5s` target: not achievable by splitting; requires the Tier-1 App.jsx entry-split (deferred).
