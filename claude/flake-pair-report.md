# JOB — the flake pair (fix/flake-pair)

Diagnosis-first, per instruction. BOTH failures are **test timing too tight, NOT a component that can
miss on a slow device.** Evidence and fixes below.

## `purchase-feel-perf.spec.js:61` — TIMEOUT, not a component fault
- The test has **no frame-time assertion** (removed earlier as vacuous — headless rAF is vsync-bimodal
  and never correlates with tier). Its only can-fail gates are: (a) the infinite-animation count is the
  same at every tier (always **46**), and (b) peak concurrent animations `< 200`.
- Gate (b) is **load-independent**: per-keystroke effects reuse a FIXED WAAPI pool, so peak is bounded
  by pool size no matter how fast you type or how starved the CPU is. Measured peak stays ~66–107.
- The failure was purely that the run hit **exactly 2.0m = its `setTimeout(120000)`**. 6 tiers × 3
  measured runs = **18 page-load-and-type cycles**; under 3-worker full-suite load each cycle's
  wall-clock inflates and the total overran 120s. → **the timeout budget was too tight.** The component
  is fine on a slow device.
- **Fix (test-only):** sample **3 representative tiers (0/3/5) × 2 runs** instead of 6×3. The two gates
  are tier-independent, so 3 tiers prove them just as well, and the lighter test both fits its budget
  and stops adding contention to the whole suite.

## `sat-rush.spec.js:37` — fixed waits racing real-time timers, not a component fault
- The death sequence gave up 3 words with blind `Escape` + `waitForTimeout(1900)` ×3; the code comment
  already warned "waiting out each pause so the next Escape isn't swallowed."
- SAT Rush's engine owns **real-time pauses** (the between-word + re-encode-beat timers — by design the
  hook owns the clock). Under load those run in wall-clock while the page is CPU-starved, so a fixed
  1900ms can land an `Escape` mid-pause, where it's swallowed → fewer than 3 lives drain → `.sr-respage`
  never appears → the assertion times out.
- This is **test fragility**: a real player responds to the VISIBLE state, not a fixed clock — the
  component's timers are correct. Not a slow-device bug.
- **Fix (test-only):** replace the fixed-wait loop with a **state-driven poll** — press Escape + a
  beat-skip key and re-check `.sr-respage` until it appears (25s budget). Tolerant of any pause length.

## Verdict
Neither is a real component bug. Both are test-timing issues in the E2E harness; fixes are test-only,
no `src/` change. Verified: both specs pass in isolation (5/5) and the perf test now runs ~2× faster.
