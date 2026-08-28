# JOB 17 — FONT & ASSET PAYLOAD (perf/assets)

The menu is the LCP path and the wordmark is the largest element. Note: the spec named "Anton" but
the app doesn't use it — the real faces are **Bungee** (display titles), **Space Mono** (body/mono),
**Bungee Shade** (the self-hosted wordmark), and **Bangers** + **Dela Gothic One** (occasional decor).

## Every font loaded — bytes + blocking (measured, real Chromium)

| Font | Source | Wire bytes | Blocks first paint? |
|------|--------|-----------|---------------------|
| Bungee Shade (wordmark) | self-hosted woff2, **preloaded** | **10,984** (was 30,368) | no (preload + `font-display:swap`) |
| Bungee | Google (gstatic) woff2 | 14,344 | no (swap; lazy) |
| Space Mono 400 + 700 | Google woff2 ×2 | 16,724 + 16,520 | no (swap; lazy) |
| Bangers | Google | lazy — **unloaded until used** | no |
| Dela Gothic One | Google | lazy — **unloaded until used** | no |
| Google Fonts CSS | googleapis stylesheet | ~15KB gzip (120KB decompressed) | **was render-blocking → now async** |

## Changes shipped
1. **Subset Bungee Shade to the wordmark glyph set** (A–Z, 0–9, punctuation) via `subset-font`
   (harfbuzz). **30,368 → 10,984 bytes (−63.8%, −19KB)** on a *preloaded, LCP-path* font. Verified: the
   "TYPE A WORD" wordmark still renders with its full 3D shade (screenshot); any non-subset glyph falls
   back gracefully to the `'Bungee'` next in the stack.
2. **Google Fonts CSS made non-render-blocking** — `media="print" onload="this.media='all'"` + a
   `<noscript>` fallback. Every family is already `display=swap`, so text paints in the fallback
   immediately; this removes the stylesheet parse from the critical path. Verified all families still
   load + apply, zero errors.
3. **`font-display: swap` audited — already present everywhere** (the Google link's `&display=swap`
   and the self-hosted `@font-face` in index.css / public/landing.css). Nothing missing to add.

## SVGs
Only **4 SVG assets, 2,880 bytes total** (favicon 1,174 / paint-drip 632 / star 585 / starburst 489).
Optimization is negligible at this size (an svgo pass would save well under 1KB), so it was **skipped**
as not worth a dependency — noted rather than done.

## Menu LCP
Measured LCP on the built preview: **188ms** (fast desktop). Because the wordmark is `display=swap`,
LCP already paints in the fallback font, so the subset's win shows up as **less bandwidth (−19KB on a
preloaded font) + a faster final *shaded* wordmark + less CLS**, rather than a big LCP-number delta on
a fast connection. On the slow-3G / Chromebook path (see Job 18's profile) the −19KB preload + the
now-async Google CSS both shave real time off the critical path.

## Follow-up (not done — bigger change)
Self-hosting + subsetting the Google families (Bungee to uppercase, Space Mono kept full since it
renders arbitrary text) would drop the googleapis round-trip entirely. The tooling is proven here
(`subset-font`). Left as `perf/self-host-fonts` in the backlog.
