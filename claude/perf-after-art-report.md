# JOB 15 — Menu perf after the art-led poster cards (REPORT ONLY)

Date: 2026-09-01 · Branch: perf/after-art (off main) · No code changed.
Question: the recent ART-LED v2 poster cards (`GameArt.jsx`, live in `GameCard`) are the biggest
recent menu change. Did they cost anything? Measured the menu at 1366×768, LV40.

## RESULT: the art cards cost ~nothing. Menu perf is excellent.

| Metric | Value | Verdict |
|---|---|---|
| Warm LCP (3 loads, steady) | **148 ms** (312 / 196 / 148) | Excellent — far under any concern |
| Running animations at rest | **0** (total, not just infinite) | Menu-motion-law ideal |
| Card art delivery | inline SVG in `GameArt.jsx`, **13 KB source, ~65 SVG nodes / 5 posters** | 0 extra network requests |
| Menu DOM nodes | 897 | Light |
| Card SVGs in DOM | 5 (one per card) | As expected |

### Why the art is cheap
`GameArt.jsx` is **inline SVG bundled into the JS** (eager-imported by `GameCard`), not five PNG/SVG
network fetches — so it adds nothing to LCP (confirmed: 148 ms) and only a modest ~13 nodes/card of
DOM. The five full-bleed poster scenes cost ~65 SVG structural elements total. This is the right call
per the ART-vs-MOTION rule (real vector art) done in the cheapest possible way.

### The JOB 6 card-idle-loop concern is GONE
JOB 6 (perf-audit-2, 2026-08-27) flagged 3 infinite idle loops on the menu cards
(cb-throb / cb-illuminate / sr-caret-blink) as a doc-tension smell. **`document.getAnimations()` now
reports ZERO running animations on the menu at rest** — total, infinite included. The menu is fully
static at rest, exactly as the MENU MOTION LAW prescribes ("idle removed, beat kept"; motion only on
`html[data-beat]`). Whatever those loops were, they no longer run at rest. Nothing to convert.

## ONE THING TO EYEBALL (not perf — design-rule)
`GameArt.jsx` contains 2 `Gradient`/`filter` references. The house rule is "flat colors ONLY, no
gradients." SVG poster art with personality may legitimately warrant them, but flagging for a design
check that these are intentional art detail, not stray CSS-style gradients. Zero perf impact either
way (composited).

## RELATED (quantified here, owned elsewhere)
Reading order top-px: wordmark 22 < xp bar 123 < **cards 274**. The cards start at 274px while the
wordmark+bar region ends ~140px → the **~130px empty band** (JOB 12) is confirmed and measured. That's
a layout issue for a menu-layout job, not a perf one.

## BOTTOM LINE
The art-led cards are a perf non-event: 148 ms LCP, inline-SVG delivery, 0 idle animations, light DOM.
No regression, nothing to fix. Report only.
