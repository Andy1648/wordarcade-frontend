# JOB F — 30-minute playthrough (narrative UX review) · REPORT ONLY

Scripted a bot through a realistic session at **mobile 390×844** (the design-priority viewport), seeded
LV30 + wins so every mode/upgrade is reachable: cold menu → menu typing → SHOP (all sections) → STATS →
each mode dialog → FUSE / CHAIN / SAT RUSH in-game → CREDITS → WORD BOMB create→lobby. 28 screenshots in
`claude/playthrough/`. Branch is off `main`, so these are TODAY's shipped states (the JOB C visual fixes
live on `fix/visual-pass-2`, not merged — see below).

## Broken / rough (ranked)

**1 — HIGH · The wordmark is clipped by the SHOP button on the menu.** The title renders "TYPE A WO"
with "RD" running *under* the SHOP button (`01-menu-cold`, `05-back-from-shop`, and ghosted behind every
mode dialog e.g. `08-dialog-word-bomb`). The app's own name is truncated on the primary mobile view.
This is exactly the collision `fix/visual-pass-2` (JOB C) fixes — it just isn't merged. **Secondary
effect:** the SHOP nav button wasn't stably clickable in-harness (needed a forced click); the wordmark
overlapping its left edge is a plausible cause of intercepted taps there on a real phone. Fix = merge
the visual-pass-2 wordmark wrap.

**2 — MEDIUM · Solo-mode input placeholders overflow / clip at 390px.** FUSE shows
`type a word with "ME" in i…` (cut before "in it", `15-fuse-ingame`); CHAIN shows
`start with "D" — min 3 let…` (cut before "letters", `18-chain-ingame`). The placeholder string is wider
than the input at phone width and hard-clips at the right edge, reading as a rendering bug. No info is
lost (the same instruction repeats in full below the input), so the fix is cosmetic: shorten the
placeholder (e.g. `word with "ME"…`) or shrink its font at ≤400px.

**3 — MEDIUM · Only 2 of 5 modes are above the fold on a tall phone.** The one-screen menu shows WORD
BOMB + CATEGORY BLITZ + the "5×" limited card + JOIN ROOM (`01-menu-cold`); CHAIN, FUSE and SAT RUSH sit
below the fold. Since the menu is height-locked (overflow hidden), three of the five modes have reduced
discoverability at 390×844 — a new player may not realize they exist. Worth a scroll affordance or a
tighter card grid on tall-narrow screens.

**4 — LOW-MED · Solo-mode top-right HUD crowds.** The "3 WORDS TO EARN" badge overlaps the "×1.0"
multiplier + "WPM" readout row in both FUSE (`15`) and CHAIN (`18`) — the badge sits on top of the row
rather than clearing it. Tighten the vertical stack in the top-right HUD at phone width.

**5 — LOW · CHAIN in-game shows a small empty dark square** between the required letter and the input
(`18-chain-ingame`) — looks like a missing/loading asset or an empty mascot slot. Verify it's intentional
(it may be an unpainted pooled element in the headless shot).

## Good (nothing wrong — worth keeping)
- **SAT RUSH intro** (`20`) — the cream-paper retro-print style is crisp and on-brand: clear clue→answer
  EXAMPLE (EPHEMERAL), "40 WINS / WORD · 3 LIVES · ENDLESS RUN", PLAY/EXIT. Distinct from the neon house
  style, exactly as DESIGN.md intends.
- **Mode dialogs** (WB `08`, BLITZ `03/10`, CHAIN `12`, FUSE `14`) — consistent, readable, each with an
  EXAMPLE (TRA→TRAIN), a per-word wins line, and the right action set (PLAY / JOIN WITH CODE, or
  CREATE/JOIN). Blitz's PACK PICKER shows "15 PACKS · 403 CATEGORIES LOADED" and toggles cleanly.
- **STATS** (`06`) — PERSONAL RECORDS grid + COLLECTION/ACHIEVEMENTS tabs, all legible; fresh account
  shows tidy locked-placeholder rows.
- **SHOP** (`26`, `28`) — scrolls smoothly through THEMES → KEY POWER → WORD SENSE → POP STYLES → SOUND
  PACKS; every upgrade reachable; buy prices + EQUIP states clear. (An in-harness wheel-scroll didn't
  move the inner scroller — a Playwright quirk, not an app bug; JS/touch scroll reaches everything.)
  Minor IA note: it opens to THEMES (cosmetics); the power upgrades need one scroll.
- **WB lobby** (`25`) — name entry + PRIVATE/PUBLIC visibility + CONTINUE, clean.
- The persistent audio button (corner cluster) rides every screen without colliding (sits *near* BACK TO
  MENU on overlays but clears it).

## Net
One genuine mobile-layout regression on `main` (the wordmark clip — already fixed on a branch, merge it),
plus two contained phone-width polish items (placeholder clipping, top-right HUD crowding) and a
discoverability question (3 modes below the fold). Everything else renders cleanly and on-brand. No
functional breakage, no dead/blank screens, no crashes across all five modes + every overlay.
