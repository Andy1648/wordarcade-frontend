# JOB 5 — Fix pass (BROKEN + LOOKS UNFINISHED from Job 4)

**Branch:** `fix/picky-pass`. Highest severity first. All changes are Tier-2/3 (component CSS);
**no App.jsx / WS / game-state code touched.** Before/after pairs in `claude/picky-pass/shots/`.
Full gate run at the end. **6 of 8 fixed; 2 deferred with rationale** (logged in DECISIONS.md).

---

## BROKEN — all three fixed

### 1. CATEGORY BLITZ pack chips broke mid-word → FIXED
- Before: `shots/blitz-before.png` ("MOVIE/S", "GAMIN/G", "ANIMA/LS") · After: `shots/blitz-after.png`
- `PackPicker.css`: grid `minmax(128px→200px)` (2 wide columns on the capped-width desktop dialog,
  still 1 on mobile) + label `overflow-wrap:normal; word-break:keep-all`.
- After: MOVIES / GAMING / FOOD / ANIMALS each sit on ONE line. No mid-word break at any width.

### 2. Mode-card SOLO/MULTI badge clipped at short height → FIXED
- Before: `shots/badge-before-1568x675.png` (badge sliced off) · After: `shots/badge-after-1568x675.png`
- `GameCard.css`: added `@media (max-height:700px) and (min-width:601px){ .game-card-payout{display:none} }`.
  At ~675px height the card is ~200px — too short for icon+title+payout+badge but above the 168px
  `@container` shed. Dropping just the payout preview there frees the badge to sit fully inside.
- After: `SOLO/MULTI` fully visible at 1568×675; normal desktop/mobile untouched (payout stays).

### 3. FUSE death "PLAY AGAIN" read as a dead/disabled button → FIXED
- Before: `shots/fuse-btn-before.png` (near-invisible) · After: `shots/fuse-btn-after.png` (legible)
- `Solo.css` `.solo-restart`: the UNARMED state was `color:#0d0618` (near-black) on `#3a2b52` (dark
  purple) at `opacity:0.6` — unreadable + looked disabled. Now light text (`#ede2ff`) at `opacity:0.92`;
  the ARMED state still pops to the mode accent with dark text.
- After: "PLAY AGAIN" is clearly legible in its pre-armed beat; CHAIN/FUSE now consistent.

---

## LOOKS UNFINISHED — 3 fixed

### 5. ACHIEVEMENTS grey-wall locked cards → FIXED
- Before: `shots/ach-before.png` (flat 12%-white-bordered grey boxes) · After: `shots/ach-after.png`
- `AchievementsScreen.css` `.ach-card`: `border:3px solid #000` + `box-shadow:3px 3px 0 #000` +
  `background:#1c0d33`, dim `0.5→0.72`, grayscale `0.6→0.4`.
- After: locked cards read as real house-style dimmed silhouettes with hard offset shadows, not a
  skeleton wall.

### 4. STATS new-player skeleton bars → FIXED
- Before: `shots/stats-before.png` (solid grey bars = looks half-loaded) · After: `shots/stats-after.png`
- `StatsScreen.css` `.rec-silhouette`: solid `#2a1f3d` fill → **dashed hollow "to-earn" track**
  (`background:transparent; border:2px dashed #43335f`).
- After: empty records read as intentional "record waiting to be set" slots, not a loading skeleton.

### 6. SHOP locked themes looked dead → FIXED (with a correction)
- Before: `shots/shop-before.png` · After: `shots/shop-after.png`
- **Audit correction:** on close inspection the shop cards ALREADY carry the house outline + hard
  shadow — my Job-4 "no house style" claim was over-stated. The real defect was the `0.5` locked
  dim reading as disabled. `ShopScreen.css` `.shop-card.is-locked` `0.5→0.62` (matching the mode-card
  / achievement dim), so a level-gated theme reads "coming later", not broken.

---

## Deferred (2) — logged, not silently skipped

### 7. CHAIN/FUSE death card "empty lower half" — DEFERRED
`.solo-over` is already `flex` + `justify/align:center`; the empty band is the **dimmed play field
above** the death card (intentional context), not a mis-centered card. Restructuring the solo
over-screen risks the `solo-deathcard` e2e flow. Flagged for a supervised layout pass.

### 8. ROOMS BROWSER "scanning" void — DEFERRED
A **transient loading state** — it fills when public games arrive. The `browser-wrap` sits on the
JOIN→WebSocket path (Tier-1 adjacent), so an unsupervised layout change there is against this run's
rails. Flagged for a supervised pass.

---

**Stranger, after:** "the pack names read right, nothing's clipped, and the locked/empty screens
look deliberate instead of half-built."

Gate: full `npm run gate` (see commit); `.last-run.json` read.
