# QA sweep — fix/qa-sweep — 2026-08-27

Branch `fix/qa-sweep` off main. **NOT merged** (your rule: nothing merges until the §1 matrix is
fully green — it is not yet).

## §1 — The systemic gate (BUILT) + BEFORE matrix
`e2e/viewport-integrity.spec.js` walks **24 screens × 7 viewports = 168 cells**. Per cell it asserts:
(a) root inside viewport, (b) no descendant clipped by a clipping parent, (c) no clipped text, (d) no
body horizontal scroll, (7) no scrollbar on dialogs/preview/game-over cards. Two false-positive classes
were calibrated out (documented in the spec): SVG vector art (a `<g>` exceeding its `<svg>` viewBox is
art, not a bug) and intentionally-scrollable content panels (shop/stats scroll vertically by design —
horizontal scroll is still flagged everywhere).

**BEFORE: 43 / 168 cells FAIL.** (`.` = pass)

```
screen                  2560  1920  1440  1366  1163  390   360
dialog-word-bomb        FAIL  FAIL  .     .     .     .     .
dialog-chain            FAIL  FAIL  .     .     .     .     .
dialog-fuse             FAIL  FAIL  .     .     .     .     .
dialog-category-blitz   FAIL  FAIL  FAIL  FAIL  FAIL  FAIL  FAIL
menu                    FAIL  FAIL  FAIL  FAIL  FAIL  FAIL  FAIL
gameover-word-bomb      FAIL  FAIL  FAIL  FAIL  FAIL  FAIL  FAIL
gameover-category-blitz .     .     .     .     FAIL  .     FAIL
ingame-word-bomb        FAIL  FAIL  FAIL  FAIL  FAIL  FAIL  FAIL
ingame-category-blitz   FAIL  FAIL  FAIL  FAIL  FAIL  FAIL  FAIL
(clean, all 7): splash, locked-chain, locked-fuse, credits, shop, stats, room,
                lobby, browser, ingame-chain, ingame-fuse, gameover-chain,
                gameover-fuse, sat-modeselect, sat-briefing
```

### The real bugs the matrix found (ranked)
1. **[BIG] Word Bomb game-over card overflows HORIZONTALLY +283px** — `.game-over-card.go-card-loss`
   scrollWidth 715 vs clientWidth 432, all 7 viewports. This is your §2 "off-screen" bug. **Not yet fixed.**
2. **[BIG] Category Blitz dialog overflows vertically +465px** — `.mode-dialog-content` 897px tall vs 432
   client (the pack picker), all 7; plus `.ppp-pill-wrap` pack pills exceed `.ppp-window-scroll`
   horizontally. **Not yet fixed.** (§7)
3. **[small] Mode dialogs (WB/CHAIN/FUSE) overflow vertically ~5px** on the two largest viewports only
   (2560/1920) — a hair over a fixed inner height. **Not yet fixed.** (§7)
4. **[small] Category Blitz game-over card scrolls vertically** on short/small viewports (1163×501, 360×640).
   **Not yet fixed.** (§7)
5. **[small] Menu SHOP nav button clips its text 5px** — `.homepage-nav-btn.is-shop` scrollWidth 80 > 75,
   all 7. **Not yet fixed.** (§1/§8-adjacent)
6. **[small] Wins-HUD sits 3px past its clip** — `.wins-hud--gate` right 1908 vs `.view-transition-root`
   clip 1905, in-game WB + Blitz, all 7. **Not yet fixed.**

## §3 — Category Blitz badge — FIXED ✓
`gameData.js` `'SOLO / MULTI'` → `'SOLO/MULTI'` (no spaces, matches Word Bomb, fits the pill). Also aligned
the blitz mode-dialog chip `'SOLO · MULTI'` → `'SOLO/MULTI'`. 282 unit green.

## §6 — CHAIN/FUSE exit audit — VERIFIED, nothing missing ✓
`SoloShell.jsx:76` renders `.solo-exit` (a 44px ✕, `onExit`, `position:absolute; top/right:16px`) at
SHELL level — outside every phase conditional — so it is present in **arm, playing, AND run-over** for
both CHAIN and FUSE. Run-over additionally shows a restart button. No phase lacks a visible exit; nothing
to add.

## §9 — Raise the gates — DONE + MEASURED ✓
`gameData.js`: CHAIN `unlockLevel 15 → 20`, FUSE `22 → 30`. Letters-to-reach under the current XP curve
(xpPerLetter = 10, calibrated exactly against the existing LV15/LV22 anchors):
| gate | level | letters to reach |
|---|---|---|
| CHAIN old | LV15 | 1,088 |
| **CHAIN new** | **LV20** | **3,420** |
| FUSE old | LV22 | 5,371 |
| **FUSE new** | **LV30** | **32,262** |
**Flag:** FUSE LV30 = ~32k letters is a ~6× jump (from 5.4k) — very steep (~100+ sessions). Applied as
instructed; you may want to reconsider the number now that it's measured.

## NOT done this pass (each is real work; the gate now verifies them)
- **§2** Word Bomb game-over horizontal overflow (+283px) — the headline; needs the wide element in
  `.go-card-loss` found and constrained. Gate cell: `gameover-word-bomb`.
- **§4** Bank wins per accepted word in EVERY mode (leaving early keeps earned wins, 3-word min) —
  **TIER-1** (App.jsx WS handlers + wins wiring); needs the harness per-mode test + your 2-device play-test.
- **§5** Connecting/pending state on a cold first Word Bomb submit (≥400ms no response) — needs the 20s-wake
  harness repro + fix.
- **§7** Dialog/preview scrollbars — the mode-dialog + blitz-dialog + blitz-gameover overflows above.
- **§8** Menu bottom spacing (JOIN/DAILY/CREDITS block floating) — not yet measured/fixed.

## Verification so far
`npm run lint` 0 errors; `npm test` 282 unit pass; the gate runs and produces the matrix above. The branch
is intentionally RED on the gate until §2/§7/§8 land. Do not merge until the matrix is green.
