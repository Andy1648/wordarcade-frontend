# fix/ingame-pass — BE-PICKY report (in-game screens)

Branch `fix/ingame-pass` off `main`. Every claim carries a before/after pair in
`claude/ingame-pass/shots/{before,after}/`. Largest-empty-rectangle numbers are MEASURED
(`claude/_tools/measure-empty.mjs` — rasterises the card, marks content-bearing elements,
finds the largest all-empty axis-aligned rectangle; flat colour counts as empty), not eyeballed.
Capture harness: `claude/_tools/cap-pass.mjs` (e2e backend mock, real motion).

Widths: desktop 1440×900, mobile 390×844. SAT is keyboard-mode → desktop only.

---

### CHAIN — play — LOOKS UNFINISHED → COMPOSED
- Before: `shots/before/chain-play-desktop.png` · `chain-play-mobile.png`
  After: `shots/after/chain-play-desktop.png` · `chain-play-mobile.png`
- Largest empty rectangle: **desktop 35%+ → 15.5%**, **mobile 35%+ → 11.1%** (both now < 18%).
- Reads in order: 1) required letter + clock  2) the input  3) YOUR CHAIN running across the lower half.
- Fixed: #1 (empty lower half) — the accepted-word chain is now the composition: a full-width
  scaffold of linked chips (join-letters cyan, connector links between them) that fills as words
  land, backed by a faint chain-link motif. #14 (orphan chips) — see cross-cutting.
- Stranger: "type a word, watch the chain build across the bottom."

### FUSE — play — LOOKS UNFINISHED → COMPOSED (desktop soft)
- Before: `shots/before/fuse-play-desktop.png` · `fuse-play-mobile.png`
  After: `shots/after/fuse-play-desktop.png` · `fuse-play-mobile.png`
- Largest empty rectangle: **desktop 35%+ → 20.4%** (soft), **mobile 35%+ → 15.2%** (composed).
- Reads in order: 1) fragment + clock  2) input  3) the three lives as burning fuse cords + the
  big A–Z letters-used strip.
- Fixed: #1 — the lives are drawn as burning fuse cords (the death card literally reads OUT OF
  FUSES) and the letters strip is enlarged into a real band; both occupy the lower half. FUSE
  desktop sits in the "soft" band because its input rides higher than CHAIN's (no OUT tile) — the
  cords/strip block is centred below it with a whisper of air above; noted, not failing.
- Stranger: "three fuses left, and I can see which letters I've spent."

### CHAIN / FUSE — game-over — LOOKS UNFINISHED → COMPOSED
- Before: `shots/before/chain-over-desktop.png` · `fuse-over-desktop.png` (+ mobile)
  After: `shots/after/chain-over-desktop.png` · `fuse-over-desktop.png` (+ mobile)
- Fixed: the death card used to float over the *abandoned play stage bleeding through a thin
  scrim* (frozen clock/letter visible) with a big dark void below. Now the overlay fully masks the
  stage (dim 0.86 → 0.965) AND carries the mode motif as a composed backdrop, and a z-index fix
  stops the stage's clock/letter painting over the dim. The exit ✕ stays reachable (z-60). Brought
  toward the Blitz model (a composed page, not a lone card in a void).
- Stranger: "clean results page, not a card stranded over a dead screen."

### SAT RUSH — wanted poster / cover / PICK YOUR BEAT — surround LOOKS UNFINISHED → IMPROVED
- Before: `shots/before/sat-play-desktop.png` · `sat-cover-desktop.png` · `sat-beat-desktop.png`
  After: `shots/after/sat-play-desktop.png` · `sat-cover-desktop.png` · `sat-beat-desktop.png`
- Fixed: the poster/cover/beat cards floated in RAW BLACK (#111). The void now carries a faint
  paper screentone — SAT's own manga tone language, strictly two-hue (paper dots on ink), static —
  so the page reads as pinned TO a toned board/desk. Crucially it lets the page's hard offset
  shadow REGISTER (black-on-black was invisible), giving real depth. Poster/cover/beat untouched;
  only the surround changed. Honoured the locked SAT sub-style (no neon, quiet-by-default).
- Stranger: "the wanted poster is on a desk now, not hanging in space."

### WORD BOMB — play — POLISH → POLISH (tightened)
- Before: `shots/before/wb-play-desktop.png`  After: `shots/after/wb-play-desktop.png`
- Fixed: SKIP's cost was 7px black-on-yellow (invisible → SKIP read as free); it's now a red
  "-1 LIFE" badge that reads. The bomb was enlarged (150 → 180px) so it commands more of its row,
  reducing the dead-purple flanks. The wide side margins are inherent to the full-width versus
  board (player bars top, combo box bottom) — improved, not eliminated; rated POLISH.
- Stranger: "type a word with STR — and SKIP will cost me a life."

### WORD BOMB — game-over under reduced motion — VERIFY → FIXED (real bug)
- Before: `shots/before/wb-over-rm-desktop.png` (a frozen yellow "2" countdown digit sits OVER the
  YOU WIN! panel) · `wb-over-rm-mobile.png`
  After: `shots/after/wb-over-rm-desktop.png` · `wb-over-rm-mobile.png` (clean panel, no digit)
- Reproduced and fixed: the 3-2-1-GO! turn-start `CountdownOverlay` rendered on `showCountdown`
  alone, so a `game_over` landing mid-countdown left it ticking over the results (worst under
  reduced motion, where nothing else moves to distract). Now gated on `showCountdown && !gameOver`
  at BOTH render sites (Word Bomb + Category Blitz), so game-over dismisses it instantly.

### Cross-cutting — orphan HUD chips — BE-PICKY #14 → FIXED
- The "3 WORDS TO EARN" wins pill + "×1.0 WIN COMBO" + WPM chips were `position:fixed` in the
  viewport's top-right corner — OUTSIDE the bounded solo card (over the WallScene), and crowding
  the score row on mobile. They now JOIN the in-card HUD cluster as a second row (positioning
  neutralised to static, scoped to `.solo-root`), keeping the shared component but re-homing it.
  The stat row also gained side padding so the right-aligned lives/links clear the exit ✕.

---

## Still not perfect (honest)
- **FUSE play desktop (~18–21%)** — "soft", not "composed". Its input rides higher than CHAIN's,
  leaving a thin air band above the cord/strip block. Reduced with extra deck spread; the residual
  band is faint (motif-textured) and below the FAIL line.
- **WORD BOMB flanking** — the versus board keeps side margins around the central bomb by design;
  the bomb is bigger but the flanks are inherent to the full-width player-bar layout. Rated POLISH.
- **SAT surround** — deliberately restrained (the locked manga sub-style is quiet-by-default). The
  board is a whisper, not a rendered desk; the poster still sits in a large field, now a *toned*
  one. Pushing further would risk the locked look.

## Gate
- lint: 0 errors. unit: 408/408 pass. e2e: **1033/1033 pass** (clean run) after fixing the FUSE
  360×640 strip overflow (`repeat(13,1fr)` → `minmax(0,1fr)` + border-box).
- TIER-1 note: the Word Bomb / Blitz `!gameOver` countdown guard touches GameScreen live render.
  It was reproduced + verified fixed via the e2e mock (game_over injected mid-countdown) and the
  full gate; per the REGRESSION CHECKLIST a live 2-device pass is the standard before MERGE to main.

## Commit
- `079b062` on `fix/ingame-pass` (pushed, verified at HEAD SHA). 7 src files.
