# MOBILE, SYSTEMATICALLY (JOB 14)

Branch `fix/mobile-deep`. Every mobile fix so far was reactive; this checks the whole phone range
at once. Harness: `e2e/_mobile.spec.js` (repeatable). Widths **320×568, 360×640, 375×667, 390×844,
412×915, 430×932** portrait + **568×320, 667×375, 844×390** landscape, across menu / mode-dialog /
shop / stats / room / in-game.

## Matrix result — the mobile axis is genuinely solid
| check | result |
|---|---|
| **Horizontal scroll** | **0 at every width AND every landscape size** — no h-overflow anywhere. |
| **Landscape fit** | Menu **fits** (no h- or v-overflow) at 568×320 / 667×375 / 844×390. The "landscape is probably broken" assumption was wrong — it holds up. |
| **Primary controls ≥44px** | Corner nav SHOP/STATS/REBIRTH are `height:44px` (`Homepage.css:119`); the in-game and room screens have **0** sub-44 targets. |

This is the headline: contrary to the "reactive fixes / probably bad" premise, the responsive layout
is clean across the whole range on the axes that usually break (overflow, landscape, primary hit
size). No fit failures to fix.

## Genuine sub-44px tap targets (2) — REPORTED, not blind-changed
Both are documented design choices, so they're flagged for an owner call rather than overridden:
1. **Overlay close ✕ = 40×40** (shop/stats/mode-dialog/lp). 4px under the 44px touch minimum, but
   this is CLAUDE.md's *canonical* close size (deliberately unified at 40×40). Bumping to 44×44
   would change that canonical across every overlay — a design decision. Recommend 44×44 if strict
   44 is wanted; it's a one-value change in the shared close rule.
2. **Wins chip = ~42×12** on the menu (the balance that also opens the shop). Short because it sits
   inline in the tuned one-line XP bar. It is a SECONDARY entry — the primary shop door is the 44px
   SHOP corner button right above it — so it's low-risk, but a strict-44 pass would give it a larger
   hit area (padding / an invisible `::before` tap region) without changing the XP-bar height.

## Notes / limits (honest)
- The "42px" readings for the nav buttons in the mode-dialog rows are an ARTIFACT: when a dialog is
  open the menu behind it gets the `.is-dimmed` scale-back transform, so its 44px buttons *measure*
  ~42. On the live (undimmed) menu they are 44px. Not a real failure.
- NOT machine-checked here (needs a real device / manual pass): whether the on-screen KEYBOARD
  covers the text input on the room-join / name screens (the emulator has no soft keyboard), and
  whether any control relies on HOVER to be discovered (the card art reveal is `:hover`, but the
  card itself is tappable, so discovery isn't hover-gated — worth a manual confirm).
- Thumb-reach: the primary actions (cards, PLAY, JOIN, BACK-TO-MENU) sit in the lower/centre of the
  screen; the corner nav is top-right (a stretch on a 932-tall phone one-handed) — acceptable for
  secondary nav, flagged.

## Conclusion
No mobile fit/overflow/landscape failures to fix — the layout is systematically sound across
320→430 portrait and landscape. The only sub-44 tap targets are two documented, secondary controls,
reported for an owner decision rather than changed unilaterally.
