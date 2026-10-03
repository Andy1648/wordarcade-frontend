# Board icon: trophy → PODIUM (Andy oct3 11:42)

Branch `feat/board-icon` (off `feat/audit-leftovers`). One component, `src/components/PodiumIcon.jsx` (+ `.css`),
replaces `TrophyIcon` everywhere: desktop golden button (`.homepage-board-hero`), phone golden button
(`.hp-m-board-hero`), LeaderboardScreen header (`.lb-head-podium`, NEW), the RANK UP card (`.lb-rankup-podium`,
NEW), the claim prompt's "find it under ▢ on the menu" (bare, 26px). `TrophyIcon.jsx` is deleted.

## The glyph (shared by all three versions)

- Three FILLED steps in podium order **2-1-3**: cyan (silver) / **gold centre, tallest** / orange (bronze), on a
  dark plinth. Each fill has a darker-shade outline (`#14a594`, `#a8800f`, `#b8431f`, `#0d0618`) and the hard
  black offset — no gradients, no glow.
- **Your #rank stands ON the top step**, as part of the icon: Bungee, the wordmark's ink (pink `#FF4FA3`, black
  stroke outside the fill) with a black offset COPY for depth (the LayeredWord rule — depth is a layer, not a
  text-shadow). The separate `.homepage-board-rank` / `.hp-m-board-rank` badges are gone.
- **Unranked → a pink star** on the top step (not a "1": a 1 would read as "you're #1").
- Ranks ≥ 1,000 print compact without the "#" (`1.2K`, `12K`), so the widest label is 4 characters; a FIXED small
  size that would print the number under 13px shows the star instead.
- Everything is sized off the icon's own box (`container-type: inline-size` + `cqw`), so the steps, outlines,
  shadows and number scale together from 26px to 168px. The number shrinks with its length (`#9` 40cqw →
  `#800` 28cqw → `#1,234` 23cqw). Below 32px the icon goes **bare** (no number/star) so nothing renders under 13px.
- Sizes: desktop podium = 84% of the `--hb` button (≈69px at 1280x551, ≈103 at 1920x1080, ≈138 at 2560x1440);
  phone button 60 → **64px**, podium 54px (`#9` ≈ 22px tall). LB header 52–64px. Rank-up card 64px.

## The three versions (`?biv=a|b|c`, default a)

| | a — pure-CSS bars | b — SVG + shadow layer | c — sticker |
|---|---|---|---|
| Build | 4 `<span>` rects, each its own border + box-shadow | one `<svg>`: a black silhouette group offset (4,4), then the outlined rects, number as `<text>` | cream die-cut (union of expanded rects) with a black keyline + one shadow, steps printed flat on it, tilted −6° |
| Depth | each step casts its OWN shadow — the gold step throws a black slab onto the bronze one: the most "stacked" | ONE union shadow under the whole silhouette — reads as one object, the LayeredWord look | the sticker casts the shadow; the steps lie flat on cream |
| On the gold button | `plate`: a dark rounded plate behind the steps (gold step on panel-dark) | same `plate` | its own cream die-cut separates the gold step; no plate |
| Small sizes | crisp; outlines ≥ 1px down to 26px | crispest (vector, number is SVG text) | the die-cut margin eats ~18% → smallest steps |
| Personality | chunky, a bit blocky | clean, graphic | tilt + die-cut = the menu-sticker voice (asymmetry rule) |

## Motion (finite only — MENU MOTION LAW holds)

- Andy's "gentle glint every ~8 s" was **not** looped (it would be a new idle loop on the menu). Instead ONE glint:
  a white bar swept across the podium silhouette (clipped to it), 640ms, ~2.2s after mount (after the arrival
  wipe, same settle clock as `wallWait`). Skipped on a rank-up visit and under reduced motion.
- **Rank up (boardNews):** the menu's rank check now announces the rank-up through `src/lib/moments.js`
  (`id: 'rank-up'`, `PRIORITY.REWARD`), so it never paints over another queued heavy moment. The podium keeps
  showing the OLD rank until the RANK UP card's `#to` pops (`RankUpMoment` `onPop`, 1600 + 36% of 2200 ms), then
  it bounces (680ms: jump + tilt, squash, settle) and the number ticks down `#12 → #11 → #10 → #9` (≤ 8 steps,
  75ms apart, each a 140ms pop on the one number node). transform/opacity only; `will-change` set by JS for the
  life of each animation and cleared on finish; no animation under reduced motion (the final rank just shows).
- No infinite animations added; no CSS `will-change` added.

## e2e hooks

Unchanged: `.homepage-nav-btn.is-board`, `.hp-m-navbtn.is-board`, the aria-label
(`Open leaderboard — you're #N` / `— your rank went up`; it reads the real rank, not the ticking display),
`.lb-rankup` / `-from` / `-to` / `-sub` and its timings (the queue is empty on menu load, so the card starts
exactly as before). No e2e selector referenced `board-rank`, `TrophyIcon` or the trophy svg, so no spec changed.

## Screenshots

`node claude/finetune/board-icon-shots.mjs` (build with the e2e Supabase env first — see the script header).
Writes `claude/finetune/board-icon/`: menu + corner crops at the 5 sizes × {#9, unranked} × {a,b,c}, the 360px
phone, the LB header, the rank-up bounce frozen mid-flight, and `measure.json` (button / podium / number px,
area ratio vs STATS and SHOP, overlaps, infinite-animation count).

## Recommendation

**b — the SVG podium with one shadow layer, plated on gold hosts.** Pending Andy's screenshots, but on the code:

- One union shadow under the whole silhouette is the same idea as the wordmark's layered depth (a layer, not
  per-piece noise). a's per-step cast shadows read busier at 54px.
- The number has an explicit SVG baseline (`y=31`), so it stands on the top step regardless of font metrics or a
  late font load. In a/c the HTML numeral's foot depends on Bungee's ascent/descent under `line-height: .82` and
  can sit off the step until Bungee loads; check that in the shots.
- It's one node instead of 8–12 positioned spans.

c is the runner-up: the cream die-cut solves gold-on-gold by itself and has the most personality. But its −6° tilt
competes with the wordmark's own −2° pose, and the 15cqw keyline fills the numeral counters below ~60px.

### Adversarial review (code-level; screenshots not yet run)

Fixed before commit:
1. **4-digit ranks under 13px.** Compact label (`1.2K`), plus a star fallback at fixed small sizes.
2. **Gold step vanishing on the gold button and card.** Added the `plate` for a/b on gold hosts.
3. **LB header overflow at 360px.** The podium drops to 44px at ≤420px.
4. **Glint.** It now uses one shared flag for both menu trees, starts only on the rising edge, and only unmount cancels it.
5. **Queue `maxMs` vs the lazy card chunk.** Raised to 6s, and a safety timer clears the held old rank.
6. **c numeral oversized against its inset stage.** `--pi-k` scales it (the plated stage uses the same fix).
7. **Claim-prompt `vertical-align` lost on CSS order.** The selector is more specific now.

Still open: the a/c numeral's dependence on font metrics (above).
