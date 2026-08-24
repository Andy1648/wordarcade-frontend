# CHAIN / FUSE vertical scale-headroom measurement — 2026-08-24

**Branch:** `measure/solo-scale` (off `main`). **Report only — no game code changed.**

## Method
Playwright drove the built app (`npm run preview`) at each viewport, loading `/?chain=1&portal=1`
and `/?fuse=1&portal=1` (both open the solo mode directly; `.solo-root` is `position:fixed;
inset:0`, so the app-wide `--app-scale` zoom does **not** apply to it). Each mode starts in
`phase:'playing'`, so the prompt, input, and (CHAIN) OUT tile render immediately; the clock is
unarmed, so the `armHint` row is present (the tallest resting state). `deviceScaleFactor` = 1.

Per viewport I measured, on `.solo-root`'s in-flow rows (excluding the absolutely-positioned
`✕` exit button and the FX layer):
- **Largest prompt element** — FUSE: `.solo-center` (the fragment). CHAIN: the larger of the IN
  letter `.solo-center` and the OUT tile `.solo-out-face`.
- **Used vertical height of the rows** = `lastRow.bottom − firstRow.top` (rows + the 20px gaps).
- **fullNeeded** = `lastRow.bottom + padding-bottom` (top of viewport → bottom of content incl.
  the root's 24px vertical padding).
- **Slack** = `innerHeight − fullNeeded` (leftover vertical breathing room).

Row stack per mode: `solo-hud · solo-stage (clock 120px + prompt + supply) · [solo-out (CHAIN)] ·
solo-inputwrap · solo-reason · solo-armhint`.

## CHAIN

| Viewport | Largest prompt (W×H px) | IN `.solo-center` | OUT `.solo-out-face` | Used rows (px) | fullNeeded (px) | Slack (px) | Max scale¹ |
|---|---|---|---|---|---|---|---|
| 1920×1080 | 80×100 (IN) | 80×100 | 66×66 | 630 | 687 | **393** | 1.537 |
| 1440×900 | 52×83 (IN) | 52×83 | 55×55 | 526 | 577 | **323** | 1.518 |
| 1366×768 | 56×71 (IN) | 56×71 | 47×47 | 448 | 496 | **272** | 1.500 |
| 1163×501 | 60×58 (IN) | 60×58 | 38×38 | 364 | 407 | **94** | 1.172 |
| 390×844 | 64×64 (OUT) | 40×55 | 64×64 | 568 | 624 | **220** | 1.314 |
| 360×640 | 64×64 (OUT) | 52×50 | 64×64 | 563 | 619 | **21** ⚠️ | **0.995** |

## FUSE

| Viewport | Largest prompt (W×H px) `.solo-center` | Used rows (px) | fullNeeded (px) | Slack (px) | Max scale¹ |
|---|---|---|---|---|---|
| 1920×1080 | 130×100 | 514 | 571 | **509** | 1.849 |
| 1440×900 | 118×83 | 429 | 481 | **419** | 1.821 |
| 1366×768 | 84×71 | 364 | 412 | **356** | 1.806 |
| 1163×501 | 71×58 | 299 | 342 | **159** | 1.395 |
| 390×844 | 82×55 | 456 | 512 | **332** | 1.601 |
| 360×640 | 69×50 | 452 | 508 | **132** | 1.213 |

¹ Max scale = `(innerHeight − 24) / fullNeeded` — the largest uniform factor that still leaves
≥24px slack **at that viewport**, modelling the scale as applied to the whole occupied vertical
block (conservative: for f<1 the padding shrinks too, freeing slightly more room than shown).

## Result

**Maximum uniform scale factor leaving ≥24px vertical slack at EVERY viewport: `0.995`**
(exactly 616 / 619 = 0.99515; reported as 0.995 so the binding viewport stays ≥24px).

- **Binding constraint: CHAIN @ 360×640** — the only viewport already under target (21px slack).
  Every other viewport has large headroom (94–509px); their caps are 1.17–1.85.
- In practice the layout is **already near-optimal**: the single number is essentially 1.0, and
  only CHAIN on the smallest phone (360×640) needs a ~0.5% shrink to hit the 24px floor. FUSE
  has ≥132px slack everywhere and never binds.
- Because only one viewport/mode drives it, an alternative to a global 0.995 is a CHAIN-only or
  ≤360px-only tweak (e.g. trimming the CHAIN OUT tile / gaps on very short viewports), which
  would let the rest of the range keep full size. Flagged for the apply step — not applied here.

## Not done / caveats
- Measured the resting **playing** state (clock unarmed → `armHint` shown, the tallest row set).
  The `reason` row is empty here (~12–21px); a long reject message won't add a row (fixed slot).
- Font metrics via Chromium headless; ±1–2px rounding per element is possible.
- No horizontal-fit analysis (task asked for vertical headroom only).
- No game code was read-modified; measurement harness was deleted after the run.
