# Mobile Layout Audit — TYPE A WORD

- **Branch/commit audited:** `main` @ `379af8a` (checked out for this run)
- **Method:** production build (`vite build`) served on `vite preview --port 4187`, driven with Playwright/Chromium. Menu/solo/SAT/shop/stats/rebirth run offline; multiplayer screens driven through the e2e WebSocket mock (`e2e/support/backendMock.js`). Idle animations frozen before measuring.
- **Viewports (6):** 360×640, 390×844, 412×915 (portrait) + 640×360, 844×390, 915×412 (landscape).
- **Per screen×viewport measured:** page scrollWidth vs innerWidth (h-scroll), scrollHeight vs innerHeight, off-viewport element rects, interactive touch targets < 44px, fixed-chrome overlap, console/page errors.

## Headline
- **No horizontal page scroll anywhere.** `document.scrollingElement.scrollWidth === innerWidth` on all 18 screens × 6 viewports. No vertical page overflow on any measured screen. No real console/page errors (only blocked-network noise from the hermetic mock).
- **One HIGH:** in **landscape**, the fixed corner-nav overlaps and steals taps from the rightmost menu card (**FUSE**) — FUSE is unlaunchable and tapping it fires STATS instead.
- Remaining issues are touch-target sizes in the cramped landscape multiplayer-setup screens (MEDIUM) and a few small secondary controls / a caption bleed (LOW).

---

## HIGH

### H1 — Landscape corner-nav overlaps the rightmost game card (FUSE); mode unlaunchable, tap fires STATS
- **Where:** Homepage menu, **landscape only** — 640×360, 844×390, 915×412. (Portrait is fine: 2-column grid, FUSE sits lower-center, dialog opens normally.)
- **Evidence (refutation-tested — static, animations frozen, all 3 landscape widths, element is app chrome inside `#root`, not a preview artifact):**
  - In landscape the 5 mode cards are forced into a single row; the 5th (FUSE) lands under the top-right fixed cluster.
  - `document.elementFromPoint(fuseCardCenterX, centerY)` returns `.homepage-nav-btn.is-stats` / `.homepage-corner-nav` — **not** the card — at 640×360 (center 535,155), 844×390 (716,202), 915×412 (779,215). `card.contains(topEl) === false` at all three.
  - A real (non-force) Playwright tap on the FUSE card **times out** ("element is obscured") at all three widths. A forced dispatch also fails to open the dialog because browser hit-testing routes the event to the nav. CHAIN (4th card) and word-bomb open their dialogs normally at the same viewport — only the rightmost card is affected.
- **Impact:** In landscape a user cannot start FUSE; tapping where FUSE is shown instead triggers STATS (wrong destructive-ish navigation). This is exactly the "orphan fixed UI collision" class called out in CLAUDE.md (audio-vs-CREDITS, footer overflow).
- **Likely cause:** menu landscape reflow packs all `GAMES.length` cards into one row (`.game-card-magnet` at ~75×101 in 640-wide), pushing the last card under `.homepage-corner-nav`, which is `position:fixed` top-right with its own coordinates and no layout relationship to the card row.

---

## MEDIUM

### M1 — Landscape multiplayer-setup controls fall below the 44px touch-target minimum
Portrait versions of these controls are ≥44px; landscape (360–412px tall) compresses them. Measured (width×height, px):
- **Lobby (`.lobby-wrap`)** @ 640×360 / 844×390 / 915×412: `lobby-continue-btn` 198×**37**, `lobby-toggle-btn` 96×**33**, `lobby-input` 198×**31**, `lobby-back-btn` 54×**27**.
- **Browse/Join (`.browser-wrap`)** @ landscape: `browser-row` 203×**41**, `browser-code-input` 148×**34**, `browser-code-join-btn` 49×**33**, `browser-name-input` 203×**31**, `browser-refresh-btn` 57×**27**, `browser-back-btn` 45×**27**.
- **Room/waiting (`.room-wrap`)** @ landscape: 5 controls in the 27–41px band (leave / difficulty / start cluster).
- **Impact:** primary CTAs (continue, join, start) and text inputs under the 44px min in landscape; harder to hit, and inputs under the 44px/16px input rule. Portrait unaffected.

---

## LOW

### L1 — Persistent sub-44 secondary controls (both orientations)
- `homepage-credits-link` 82×**12** (menu footer link), `menu-xp-rank` button 62×**21** (menu), `solo-exit` **40×40** (CHAIN + FUSE in-game exit — borderline), `sr-brief-exit` 284×**32** (SAT briefing exit). Secondary/exit/link controls, not primary play actions.

### L2 — In-game spotlight caption slightly wider than a 360px viewport
- WB & CB in-game, **portrait 360×640**: `.spotlight-caption-text` ("TYPE A WORD WITH THESE LETTERS" / round caption) measures 388px wide, rect left **−14**, right **374** — bleeds ~14px past each edge. `overflow:visible`, so **no page scroll**; worst case the first/last glyph kisses the screen edge. Only at 360 width (fits at 390/412).

### L3 — Decorative wall art bleeds past the right edge (NOT a defect — noted for completeness)
- `.wall-splatter` / `.wall-graffiti-tag` sit 2–20px past the right edge on essentially every screen (e.g. R=382 at vw=360). This is the intentional "overspray" background aesthetic; the body clips it and it produces **zero** horizontal scroll. Excluded from findings — listed so the recurring `offRight` measurement isn't mistaken for overflow.

---

## Matrix (screen × viewport → PASS / issue)
P = portrait, L = landscape. Blank = PASS (no h-scroll, no clipping, no overlap, targets ≥44 or only decorative).

| Screen | 360P | 390P | 412P | 640L | 844L | 915L |
|---|---|---|---|---|---|---|
| Splash | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Menu (home) | ✔ | ✔ | ✔ | **H1** | **H1** | **H1** |
| Mode dialog | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Pack picker | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Lobby | ✔ | ✔ | ✔ | M1 | M1 | M1 |
| Browse/Join | ✔ | ✔ | ✔ | M1 | M1 | M1 |
| Room (waiting) | ✔ | ✔ | ✔ | M1 | M1 | M1 |
| Word Bomb in-game | L2 | ✔ | ✔ | ✔ | ✔ | ✔ |
| Word Bomb game-over | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Category Blitz in-game | L2 | L2 | ✔ | ✔ | ✔ | ✔ |
| Category Blitz game-over | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| SAT briefing | L1 | L1 | L1 | L1 | L1 | L1 |
| SAT play | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| CHAIN in-game | L1 | L1 | L1 | L1 | L1 | L1 |
| FUSE in-game* | L1 | L1 | L1 | L1 | L1 | L1 |
| Shop | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Stats | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Rebirth | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

\* FUSE **in-game** measured via the `?fuse=1` route (the card path is blocked in landscape by H1). In-game FUSE is clean at every viewport: fills the window (e.g. 610×344 in 640×360), all 26 alphabet tiles present, no h-overflow. The only FUSE defect is the H1 launch overlap.

## Notes / coverage caveats
- SAT Rush **game-over** not driven (requires losing lives; SAT owns its own clock with no dev over-cap). Briefing + play covered; both clean apart from the L1 exit-button size.
- FUSE launch via the menu card in landscape is broken by H1, so FUSE in-game landscape was reached through the shipped `?fuse=1` flag route instead.
- All "off-right" element hits in raw measurements were decorative wall art (L3); no interactive control was found off-screen or clipped.
