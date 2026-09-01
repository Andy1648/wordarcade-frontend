# JOB 4 — Full-sweep contact sheet + screen ranking (REPORT ONLY)

Date: 2026-09-01 · Branch: chore/full-sweep (off main) · No code changed.

Captured every reachable surface via the e2e backend mock at **1440×900 (desktop)** and
**390×844 (mobile)**, reduced-motion. 21 surfaces × 2 viewports = 42 shots.
Contact sheets: `claude/full-sweep/contact-desktop.png`, `claude/full-sweep/contact-mobile.png`.
Per-screen shots: `claude/full-sweep/shots/`.

Tools added (dev-only, `claude/_tools/`): `contact-sheet.mjs` (tile PNGs → labeled grid),
`cap-sat-sweep.mjs` (SAT surfaces the generic sweep can't reach — modeselect/briefing/play),
`cap-wbover-settle.mjs` (multi-time settle capture). `cap-screens.mjs` already existed.

## RANKING (best → weakest)

### GOLD STANDARD — the bar every other screen should hit
- **blitz-gameover** — bright, crisp, clear hierarchy, visible REMATCH/LEAVE, celebratory. The model.
- **wb-gameover** (settled) — mascot bomb hero, bright "YOU WIN!", vivid player cards, sticky
  SHARE/IMAGE footer. On par with blitz once its entrance animation finishes (see Finding 3).
- **SAT briefing / modeselect / lineup-choice** — the retro-print manga sub-style is the most
  fully-realized identity in the app: cream page, ink type, WANTED poster, "PICK YOUR BEAT". Distinctive.
- **menu** — vivid poster cards, strong. (Empty band above cards is the one weakness — Finding 4.)

### SOLID — on-brand, no issues
blitz-dialog-packpicker, wb-dialog, chain-locked, fuse-locked (excellent locked previews:
what/example/wins-per-word/unlock level), shop, stats, collection, achievements, room-waiting,
lobby, rooms-browser, credits, sat-play.

### NEEDS WORK
- **chain-death, fuse-death** — see Finding 1. Otherwise well-composed (score ring + multiplier + card).

## FINDINGS (ranked)

**1 — MED · chain-death & fuse-death: decorative letter collides with the title.**
A large cursive glyph sits *inside* the death headline: a cyan "C" crowds between CHAIN and BROKE
(`CHAIN⊂BROKE`), and letters overlap "OUT OF FUSES". It reads as a rendering glitch, not flair —
the one screen pair where the JOB 3 death-card mascot treatment hurts legibility.
Both viewports. Shots: `chain-death-{mobile,desktop}.png`, `fuse-death-*.png`.
Fix candidate (a later code job): move the glyph behind the title as a faint watermark, or drop it.

**2 — LOW-MED · Desktop is unaddressed: every non-menu surface is a phone-width column
floating in a sea of empty dark canvas.** Dialogs, overlays, game-overs, shop, stats, SAT — all
render as a ~420px centered column at 1440px wide. This is a *strategic* gap, not a bug (Type a Word
is phone-first, and typeaword.com traffic is mobile), so it is intentionally low priority — but the
sweep's clearest desktop observation. No action recommended unless desktop becomes a target.

**3 — INFO · WB game-over entrance animation dims the whole card for ~3–5s before settling.**
The 500ms sweep frame caught it mid-entrance: card near-black, faint text, a stray countdown "2"
floating — looked broken. At 5000ms it is fully bright and correct (`wb-gameover-settle-5000.png`).
Not a bug. Two notes: (a) the entrance may *feel* slow to a real player — worth a live gut-check;
(b) any future automated WB-gameover screenshot must wait ≥3s, not 500ms.

**4 — LOW · menu empty band above the cards** — already logged (JOB 12, `wallscene-report.md`).
The ~150px dead space above the poster row remains the menu's weak spot, not the backdrop.

**5 — LOW · wordmark faint/clipped under the SHOP button on the in-game HUD** (visible on the
menu/chain-locked/fuse-locked top strip). This is the JOB C fix (`fix/visual-pass-2`), which is not
merged into these main-based branches. Confirms the fix is still needed on main.

## SUMMARY
No crashes; every surface reached (SAT needed the dedicated reach path). App is visually strong and
coherent on mobile. Exactly **one** genuine cosmetic defect surfaced by the sweep: the death-card
title/glyph collision (Finding 1) — a good candidate for the next fix pass. Everything else is either
intentional (desktop), a capture artifact (WB entrance), or already logged.
