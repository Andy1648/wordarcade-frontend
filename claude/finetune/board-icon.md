# Board icon: trophy → PODIUM (Andy oct3 11:42)

Branch `feat/board-icon` (off `feat/audit-leftovers`). One component, `src/components/PodiumIcon.jsx` (+ `.css`),
replaces `TrophyIcon` everywhere: desktop golden button (`.homepage-board-hero`), phone golden button
(`.hp-m-board-hero`), LeaderboardScreen header (`.lb-head-podium`), the RANK UP card (`.lb-rankup-podium`), the
claim prompt's "find it under ▢ on the menu" (bare, 26px). `TrophyIcon.jsx` is deleted.

## Round 1 (3 versions, `?biv=a|b|c`) → verdict

Round 1 shot a = CSS bars, b = SVG + one shadow layer, c = cream die-cut sticker (−6°), with a dark "plate" for
a/b on gold hosts. NOTE: every round-1 frame was in the FALLBACK font — `installBackendMock` aborts Google Fonts
unless `SHOT_FONTS` is set; the shot script now sets it.

**Verdict: a HYBRID — b's SVG with c's die-cut drawn inside it, no plate.** On gold the black shadows/strokes
read; on the dark plate they vanished and the plate shrank the golden button to a thin rim. Versions a and c, the
plate and the `?biv=` switch are deleted.

## The glyph now (one inline SVG, 100×100 viewBox)

- Three FILLED steps in podium order **2-1-3** — cyan / **gold centre, tallest** / orange — on a dark plinth; flat
  fills, darker-shade outlines (`#14a594`, `#a8800f`, `#b8431f`, `#0d0618`).
- The sticker: a cream (`#F0EAD9`) die-cut around every shape (4 units), a black keyline (3 units), ONE hard black
  shadow (4,4) under the whole silhouette. Tilted **−2°** (the wordmark's pose), not −6°.
- **Your #rank stands on the gold step**, drawn in the SVG in Bungee: pink fill, 3-unit black stroke outside the
  fill, a **4-unit cream keyline** + 2-unit black edge, and a black offset copy. The number's keyline/shadow layers
  are drawn WITH the sticker's (under the steps), so its die-cut fuses with the step's instead of a black blob.
- Unranked → a pink star in the same layers. The RANK UP card's podium wears the star too (its `#to` is the line
  right under it — no second "#9").
- Labels: `#9` … `#999`, then compact without "#" (`1.2K`, `12K`) — max 4 characters. Size in viewBox units:
  `min(46, 92 / (len × 0.74))` → 2 chars 46, 3 chars 41.4, 4 chars 31.1.
- **13px floor on the RENDERED size**: the icon measures its own box with a ResizeObserver (mount + resize only,
  never per frame) when no numeric `size` is passed; a number that would render under 13px shows the star; under
  32px the glyph goes bare. The rendered px is exposed as `data-num-px` (the shot script reads it).

## Sizes (computed from the CSS — the shots confirm)

The podium now FILLS the button's content box (its viewBox carries the die-cut + shadow margin; no headroom).

| viewport | button | vs STATS (area) | podium | `#9` | `#42` | `#800` / `1.2K` | --fs-panel |
|---|---|---|---|---|---|---|---|
| 390x844 (phone) | 72px (was 64) | 1.09× (5,184 vs ~4,752) | 66 | 30.4px | 27.3 | 20.5 | 20 |
| 360x740 (phone) | 72px | ~1.20× | 66 | 30.4 | 27.3 | 20.5 | 20 |
| 1280x551 | 93.7px (was 82) | ~1.45× (was 1.11) | 86 | 39.7 | 35.7 | 26.8 | 28 |
| 1366x625 | 101px | — | 93 | 42.8 | 38.5 | 28.9 | 28 |
| 1920x1080 | 142px | — | 131 | 60.1 | 54.1 | 40.6 | 34 |
| 2560x1440 | 176px (cap, was 168) | — | 162 | 74.5 | 67.0 | 50.4 | 40 |
| LB header ≤420px | 44px | — | 44 | 20.2 | 18.2 | 13.7 | 20 |

Desktop dial: `--hb: clamp(68px, min(7.4vw, 17vh), 176px)` (was 6.4vw / 168). The 17vh short-window guard is
unchanged and is what binds at 1280x551. Every 2–3 char label clears --fs-panel on the golden buttons; the 4-char
labels clear it except at 1280x551 (26.8 vs 28) — the widest label that fits the box there.

## Motion (finite only — MENU MOTION LAW holds)

- **Glint:** ONE white sweep across the steps (clipped to them), 640ms, ~2.2s after mount (after the arrival
  wipe). Rising edge only; a falling prop never cuts it; skipped on a rank-up visit. Not looped (Andy's "every
  ~8 s" would be an idle loop on the menu).
- **Rank up (boardNews):** announced through `src/lib/moments.js` (`id: 'rank-up'`, `PRIORITY.REWARD`, maxMs
  6000 + a safety clear of the held old rank). The icon shows the OLD rank until the RANK UP card's `#to` pops
  (`RankUpMoment` `onPop`), then **punches** and the number ticks `#12 → #11 → #10 → #9` (≤ 8 steps, 75ms apart).
  - 680ms, LINEAR overall with per-keyframe easing: swell to `scale(1.18) rotate(5°)` at **30% = 204ms**
    (`BUMP_PEAK_MS`, also `data-bump-peak-ms` on the icon), squash `scale(1.06, .92)` at 55%, settle.
  - It grows from the icon's TOP edge and never travels up: at 1280x551 the button's top (28px) already sits on
    the rebirth stars' baseline (stars y 10–28 from x 70), so an upward jump would hit them. The +5° tilt lifts
    only the left corner (~4px), over the frame ornament the button already overlaps at rest. The shot script
    freezes on the peak and lists any frame element it crosses (`crosses`).
  - will-change is per element and ref-counted: cleared only when the LAST overlapping tick pop on the number ends.
- transform/opacity only; no CSS will-change; no infinite animation; nothing plays under reduced motion.

## e2e hooks

Unchanged: `.homepage-nav-btn.is-board`, `.hp-m-navbtn.is-board`, the aria-label (`Open leaderboard — you're #N`
/ `— your rank went up`; it reads the real rank, not the ticking display), `.lb-rankup*` and its timings.

## Screenshots

`node claude/finetune/board-icon-shots.mjs [url] [sizes]` (build with the e2e Supabase env first — see the
header). Writes `claude/finetune/board-icon/`: menu + corner crops at 6 sizes × {#9, unranked}; corner crops for
#42 / #800 / 1.2K at 390, 360, 1280x551; the LB header at 1920 / 390 / 360; the rank-up punch frozen at its peak
at 1280x551 / 1920 / 390; `measure.json`.

## Still open

- Everything above is computed from the CSS; the round-2 shots (with Bungee loaded) confirm or correct it.
- The phone title row now carries a 72px button. Check that "TYPE A / WORD" and the audio controls still fit at
  360.
