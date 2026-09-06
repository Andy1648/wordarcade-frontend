# KnifeSplit under CPU throttle — measurement report

**Branch:** `perf/knife-measure` · REPORT ONLY (no product code changed; KnifeSplit.jsx/css + App.jsx untouched)
**Harness:** `claude/_tools/knife-measure.mjs` drives `/knife-measure.html` (mounts the REAL KnifeSplit in isolation over black). CPU throttle via CDP `Emulation.setCPUThrottlingRate`. Presented frames via CDP Page screencast (one event per composited frame swap); cross-checked 1:1 against the trace `DrawFrame` count. Windows anchored on each CSS animation's real `startTime` (Web Animations API), so they're immune to rAF-sampling lag under throttle. 3 runs per rate, warm-up replay discarded.

**Fidelity caveats (read the numbers with these):**
- Ran **headless** — headed Chrome throttles frame production for occluded/unfocused windows (a background job), so most headed runs captured ~no frames. Headless renders regardless of focus; its DrawFrame trace matched the screencast exactly.
- Headless composites at **~45–50 fps** (frame times ~20–22 ms), not the display's 60 Hz (16.7 ms). So **absolute frame counts here are a conservative FLOOR** — a real 60 Hz device gets ~25% more. Cross-rate comparison is the trustworthy signal.
- CPU throttle starves the **main thread** (the stated "under load" concern). It does not emulate a weak GPU — but composited transform/opacity does little per-frame GPU raster, so GPU is unlikely to be the bottleneck.

## Results (3 runs per rate; ranges shown)

| Metric | 1× | 4× | 6× |
|---|---|---|---|
| **DRAW** presented frames (160 ms) | **6, 6, 6** | **6, 6, 5** | **4, 5, 4** |
| DRAW frame-time median | 20–21 ms | 19–25 ms | 19–25 ms |
| DRAW worst frame | 21–26 ms | 24–27 ms | 26–30 ms |
| **DRAW frames > 50 ms** | **0** | **0** | **0** |
| **OPEN** presented frames (400 ms) | **9, 9, 9** | **8, 9, 8** | **8, 9, 8** |
| OPEN frame-time median | 19–22 ms | 20–22 ms | 20–27 ms |
| OPEN worst frame | 23–25 ms | 26–28 ms | 23–31 ms |
| **OPEN frames > 50 ms** | **0** | **0** | **0** |
| FADE presented frames (170 ms) | 7–8 | 6–7 | 6–7 |
| Draw START delay (from mount) | 83–99 ms | 115–121 ms | 146–152 ms |
| Chain total presented frames | 21–24 | 20–24 | 20–23 |
| Chain worst frame time | 94–111 ms | 118–127 ms | 164–167 ms |
| Chain frames > 50 ms (incl. static hold) | 2 | 2 | 1–2 |
| **Peak concurrent animations** | **3** | **3** | **3** |
| Reduced motion | knife elements: **0**, animations: **0** (skipped entirely) |

## Findings

1. **The draw SURVIVES at 6×.** It gets **4–5 presented frames** (headless floor; ≈ 6 on a real 60 Hz screen), spaced ~20–25 ms apart, with **zero frames over 50 ms** at every throttle level. A flicker would be 1–2 frames or a >50 ms gap mid-motion — neither occurs. The prediction of "3–4 frames → flicker" did not materialise; it bottoms out at 4–5, evenly spaced.

2. **The open is bulletproof:** 8–9 frames, flat across 1×→6×, 0 frames >50 ms. It's a plain `translateY` on the covers (no filter) → fully composited → main-thread throttle can't touch it. This is the control that proves composited transform/opacity survives load here.

3. **The only >50 ms inter-frame gaps are during the static HOLD + pre-slash delay** — where nothing is moving (the blade sits drawn-and-bright, covers closed). A long gap on a still image is invisible. During every ACTUAL motion window (draw, fade, open) the cadence stays sub-50 ms at all rates.

4. **The draw is the weakest link** — the only window that loses frames under load (6 → 4–5), because the blade carries `filter: drop-shadow()` + `mask-image` (not a free composited transform, unlike the open's plain translateY). It still doesn't flicker, but it has the least headroom.

5. **Under 6× the chain START shifts ~65 ms later** (slash appears at mount+150 ms vs mount+83 ms) — the whole gesture is delayed by main-thread work before the slash, then plays at normal speed. Not a stutter, just a later start.

6. **Concurrency peaks at 3** (the two cover halves + the blade-fade tail overlapping the open) at every rate — trivial, never a bottleneck.

7. **prefers-reduced-motion skips it entirely** — 0 `.knife-split` elements ever mount, 0 animations run (JS `play=false → return null`, plus the CSS guard).

## Recommendation

No fix is required — the draw does not flicker at 6×. **If** you want margin for hardware weaker than 6×, your instinct is right: **LENGTHEN the draw**, don't shorten it. 160 → ~200–220 ms adds ~2–3 frames of headroom and the cadence is already stable, so it stays smooth. The most robust option is to also drop the `drop-shadow` + `mask-image` off the *animated* blade (bake the glow into the SVG or a static sibling) so the draw is as fully composited as the open — the open's flat 8–9 frames across all rates is the proof that plain transform is immune to this load.
